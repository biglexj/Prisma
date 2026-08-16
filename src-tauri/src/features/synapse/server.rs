use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::app::state::{MusicLibraryState, VisualLibraryState};
use super::deep_link::{parse_prisma_uri, url_decode};
use super::model::{
    SynapseActionResponse, SynapseFileReceivedEvent, SynapseHandoffPayload, SynapseOpenMediaEvent,
    SynapseStatusResponse,
};

#[allow(dead_code)]
pub struct SynapseServer {
    running: Arc<AtomicBool>,
}

impl SynapseServer {
    pub fn start(app: AppHandle) -> Self {
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        std::thread::Builder::new()
            .name("synapse-server-thread".into())
            .spawn(move || {
                let port = 49288;
                let listener = match TcpListener::bind(format!("0.0.0.0:{port}")) {
                    Ok(l) => {
                        let _ = l.set_nonblocking(true);
                        l
                    }
                    Err(e) => {
                        eprintln!("[Synapse Server] No se pudo vincular al puerto {port}: {e}");
                        return;
                    }
                };

                while running_clone.load(Ordering::Relaxed) {
                    match listener.accept() {
                        Ok((stream, _addr)) => {
                            let app_handle = app.clone();
                            std::thread::spawn(move || {
                                handle_client(stream, app_handle);
                            });
                        }
                        Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            std::thread::sleep(Duration::from_millis(50));
                        }
                        Err(e) => {
                            eprintln!("[Synapse Server] Error al aceptar conexión: {e}");
                            std::thread::sleep(Duration::from_millis(100));
                        }
                    }
                }
            })
            .expect("No se pudo iniciar el hilo del servidor Synapse");

        Self { running }
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }
}

fn handle_client(mut stream: TcpStream, app: AppHandle) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));

    let mut reader = BufReader::new(stream.try_clone().unwrap_or_else(|_| stream.try_clone().unwrap()));

    let mut first_line = String::new();
    if reader.read_line(&mut first_line).is_err() || first_line.is_empty() {
        return;
    }

    let trimmed_first_line = first_line.trim();

    // ── Soporte de Deep Link / Raw IPC string (prisma://... o aurora-synapse://...) ──
    if trimmed_first_line.starts_with("prisma://")
        || trimmed_first_line.starts_with("aurora-synapse://")
    {
        if let Some(parsed) = parse_prisma_uri(trimmed_first_line) {
            bring_main_window_to_front(&app);
            let event = SynapseOpenMediaEvent {
                path: parsed.path,
                current_time: parsed.current_time_sec,
                autoplay: Some(parsed.autoplay),
                title: parsed.title,
                artist: parsed.artist,
            };
            let _ = app.emit("prisma://open-media", event);
            let _ = stream.write_all(b"OK\r\n");
            let _ = stream.flush();
        }
        return;
    }

    // ── Servidor HTTP ──
    let mut parts = trimmed_first_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_uppercase();
    let raw_path = parts.next().unwrap_or("");
    let path = raw_path.split('?').next().unwrap_or("");

    // Leer cabeceras HTTP
    let mut headers = std::collections::HashMap::new();
    loop {
        let mut header_line = String::new();
        if reader.read_line(&mut header_line).is_err() || header_line.trim().is_empty() {
            break;
        }
        if let Some((k, v)) = header_line.split_once(':') {
            headers.insert(k.trim().to_lowercase(), v.trim().to_string());
        }
    }

    let content_length: usize = headers
        .get("content-length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    // Manejo de CORS preflight (OPTIONS)
    if method == "OPTIONS" {
        send_http_response(
            &mut stream,
            200,
            "application/json",
            b"{\"success\":true,\"message\":\"CORS OK\"}",
        );
        return;
    }

    match (method.as_str(), path) {
        // ── GET /api/v1/synapse/status (Health Check) ──
        ("GET", "/api/v1/synapse/status") | ("GET", "/status") => {
            let device_name = std::env::var("COMPUTERNAME")
                .or_else(|_| std::env::var("HOSTNAME"))
                .unwrap_or_else(|_| "PC-Biglex".to_string());

            let resp = SynapseStatusResponse {
                success: true,
                message: "Nodo Prisma Synapse Activo y Operativo.".to_string(),
                target_app: "prisma".to_string(),
                synapse_version: "1.0".to_string(),
                device_name,
            };
            let json = serde_json::to_vec(&resp).unwrap_or_default();
            send_http_response(&mut stream, 200, "application/json", &json);
        }

        // ── POST /api/v1/synapse/handoff (Continuidad Multimedia) ──
        ("POST", "/api/v1/synapse/handoff") | ("POST", "/handoff") => {
            let mut body = vec![0u8; content_length];
            if content_length > 0 {
                let _ = reader.read_exact(&mut body);
            }

            let handoff: SynapseHandoffPayload = match serde_json::from_slice(&body) {
                Ok(h) => h,
                Err(e) => {
                    let err_resp = SynapseActionResponse {
                        success: false,
                        message: format!("Payload JSON inválido: {e}"),
                        saved_path: None,
                    };
                    let json = serde_json::to_vec(&err_resp).unwrap_or_default();
                    send_http_response(&mut stream, 400, "application/json", &json);
                    return;
                }
            };

            let resolved_path = resolve_local_media_path(&app, &handoff);
            bring_main_window_to_front(&app);

            let current_time = handoff.position_ms.map(|ms| ms as f64 / 1000.0);
            let autoplay = handoff.is_playing.or(Some(true));

            let event = SynapseOpenMediaEvent {
                path: resolved_path,
                current_time,
                autoplay,
                title: handoff.title.clone(),
                artist: handoff.artist.clone(),
            };

            let _ = app.emit("prisma://open-media", event);

            let resp = SynapseActionResponse {
                success: true,
                message: "Reproducción transferida a Prisma".to_string(),
                saved_path: None,
            };
            let json = serde_json::to_vec(&resp).unwrap_or_default();
            send_http_response(&mut stream, 200, "application/json", &json);
        }

        // ── POST /api/v1/synapse/upload (Recepción de Archivos LAN) ──
        ("POST", "/api/v1/synapse/upload") | ("POST", "/upload") => {
            let raw_file_name = headers
                .get("x-file-name")
                .cloned()
                .unwrap_or_else(|| {
                    let timestamp = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis())
                        .unwrap_or(0);
                    format!("synapse_file_{timestamp}.bin")
                });

            let file_name = sanitize_file_name(&url_decode(&raw_file_name));
            let media_type = headers
                .get("x-media-type")
                .or_else(|| headers.get("content-type"))
                .cloned()
                .unwrap_or_else(|| "application/octet-stream".to_string());

            let download_dir = app
                .try_state::<super::config::SynapseState>()
                .map(|s| s.get_downloads_dir())
                .unwrap_or_else(get_prisma_downloads_dir);
            let _ = std::fs::create_dir_all(&download_dir);

            let target_path = get_unique_destination(&download_dir, &file_name);

            // Leer cuerpo del archivo y guardar en disco
            let mut file_data = vec![0u8; content_length];
            if content_length > 0 {
                let _ = reader.read_exact(&mut file_data);
            }

            match std::fs::write(&target_path, &file_data) {
                Ok(_) => {
                    let saved_path_str = target_path.to_string_lossy().to_string();

                    // Notificar a la UI para que actualice la biblioteca o muestre toast
                    let file_event = SynapseFileReceivedEvent {
                        file_name: file_name.clone(),
                        saved_path: saved_path_str.clone(),
                        media_type: media_type.clone(),
                        size_bytes: file_data.len() as u64,
                    };
                    let _ = app.emit("prisma://file-received", file_event);

                    let resp = SynapseActionResponse {
                        success: true,
                        message: "Archivo recibido correctamente".to_string(),
                        saved_path: Some(saved_path_str),
                    };
                    let json = serde_json::to_vec(&resp).unwrap_or_default();
                    send_http_response(&mut stream, 200, "application/json", &json);
                }
                Err(e) => {
                    let resp = SynapseActionResponse {
                        success: false,
                        message: format!("Error guardando archivo en disco: {e}"),
                        saved_path: None,
                    };
                    let json = serde_json::to_vec(&resp).unwrap_or_default();
                    send_http_response(&mut stream, 500, "application/json", &json);
                }
            }
        }

        _ => {
            let resp = SynapseActionResponse {
                success: false,
                message: format!("Ruta o método no encontrado: {method} {path}"),
                saved_path: None,
            };
            let json = serde_json::to_vec(&resp).unwrap_or_default();
            send_http_response(&mut stream, 404, "application/json", &json);
        }
    }
}

fn send_http_response(stream: &mut TcpStream, status_code: u16, content_type: &str, body: &[u8]) {
    let status_text = match status_code {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        500 => "Internal Server Error",
        _ => "OK",
    };

    let response_headers = format!(
        "HTTP/1.1 {status_code} {status_text}\r\n\
        Content-Type: {content_type}; charset=utf-8\r\n\
        Content-Length: {}\r\n\
        Access-Control-Allow-Origin: *\r\n\
        Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
        Access-Control-Allow-Headers: Content-Type, X-File-Name, X-Media-Type\r\n\
        Connection: close\r\n\r\n",
        body.len()
    );

    let _ = stream.write_all(response_headers.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

fn bring_main_window_to_front(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Resuelve la ruta local de un medio a partir de los metadatos de Handoff.
/// Si el archivo existe directamente en disco, lo usa. Si es una ruta móvil (ej. /storage/emulated/0/...),
/// busca en las bibliotecas de Prisma por coincidencia de nombre de archivo o título/artista.
fn resolve_local_media_path(app: &AppHandle, handoff: &SynapseHandoffPayload) -> String {
    if let Some(ref path) = handoff.path {
        let p = Path::new(path);
        if p.is_file() {
            return path.clone();
        }

        // Extraer nombre de archivo base (ej. "cancion.mp3")
        let file_name = path
            .replace('\\', "/")
            .rsplit('/')
            .next()
            .unwrap_or("")
            .to_lowercase();

        if !file_name.is_empty() {
            // Buscar en carpetas registradas de música
            if let Some(music_state) = app.try_state::<MusicLibraryState>() {
                if let Ok(paths) = music_state.paths() {
                    if let Some(found) = find_file_in_folders(&paths, &file_name) {
                        return found;
                    }
                }
            }

            // Buscar en carpetas registradas de visuales (vídeos e imágenes)
            if let Some(visual_state) = app.try_state::<VisualLibraryState>() {
                if let Ok(video_paths) = visual_state.paths(crate::features::visual_library::VisualMediaKind::Video) {
                    if let Some(found) = find_file_in_folders(&video_paths, &file_name) {
                        return found;
                    }
                }
                if let Ok(image_paths) = visual_state.paths(crate::features::visual_library::VisualMediaKind::Image) {
                    if let Some(found) = find_file_in_folders(&image_paths, &file_name) {
                        return found;
                    }
                }
            }

            // Buscar también en la carpeta de descargas de Prisma
            let downloads_dir = get_prisma_downloads_dir();
            if let Some(found) = find_file_in_folders(&[downloads_dir.to_string_lossy().to_string()], &file_name) {
                return found;
            }
        }
    }

    // Fallback: devolver la ruta original recibida
    handoff.path.clone().unwrap_or_default()
}

/// Busca recursivamente un archivo por nombre en una lista de carpetas base
fn find_file_in_folders(folders: &[String], target_file_name: &str) -> Option<String> {
    let lower_target = target_file_name.to_lowercase();
    for folder in folders {
        let dir = Path::new(folder);
        if !dir.is_dir() {
            continue;
        }
        let direct_candidate = dir.join(target_file_name);
        if direct_candidate.is_file() {
            return Some(direct_candidate.to_string_lossy().to_string());
        }
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if name.to_lowercase() == lower_target {
                            return Some(path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

/// Sanitiza un nombre de archivo para evitar Directory Traversal y caracteres inválidos en Windows.
fn sanitize_file_name(name: &str) -> String {
    let clean = name
        .replace('\\', "/")
        .rsplit('/')
        .next()
        .unwrap_or("archivo")
        .replace([':', '*', '?', '"', '<', '>', '|'], "_");

    let clean = clean.trim_matches('.').trim();
    if clean.is_empty() {
        "archivo_recibido.bin".to_string()
    } else {
        clean.to_string()
    }
}

/// Obtiene el directorio de descargas de Prisma (Downloads/Prisma).
fn get_prisma_downloads_dir() -> PathBuf {
    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        PathBuf::from(user_profile).join("Downloads").join("Prisma")
    } else if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join("Downloads").join("Prisma")
    } else {
        std::env::temp_dir().join("Prisma").join("Downloads")
    }
}

/// Genera un nombre de archivo único si ya existe uno con el mismo nombre.
fn get_unique_destination(dir: &Path, file_name: &str) -> PathBuf {
    let initial = dir.join(file_name);
    if !initial.exists() {
        return initial;
    }

    let path_obj = Path::new(file_name);
    let stem = path_obj.file_stem().and_then(|s| s.to_str()).unwrap_or("archivo");
    let ext = path_obj.extension().and_then(|e| e.to_str());

    for i in 1..1000 {
        let candidate_name = match ext {
            Some(e) => format!("{stem} ({i}).{e}"),
            None => format!("{stem} ({i})"),
        };
        let candidate = dir.join(candidate_name);
        if !candidate.exists() {
            return candidate;
        }
    }

    dir.join(format!("{stem}_{}", std::time::SystemTime::now().elapsed().unwrap_or_default().as_millis()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_file_name() {
        assert_eq!(sanitize_file_name("../../../secret/song.mp3"), "song.mp3");
        assert_eq!(sanitize_file_name("C:\\Users\\admin\\pic:1.png"), "pic_1.png");
        assert_eq!(sanitize_file_name("cool_track.flac"), "cool_track.flac");
        assert_eq!(sanitize_file_name(""), "archivo_recibido.bin");
    }

    #[test]
    fn test_unique_destination() {
        let temp_dir = std::env::temp_dir().join("prisma_synapse_test_unique");
        let _ = std::fs::create_dir_all(&temp_dir);
        let first = temp_dir.join("test.txt");
        let _ = std::fs::write(&first, b"hello");

        let dest = get_unique_destination(&temp_dir, "test.txt");
        assert_eq!(dest, temp_dir.join("test (1).txt"));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
