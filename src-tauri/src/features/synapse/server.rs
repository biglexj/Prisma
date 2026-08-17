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
    SynapseRemoteCommandPayload, SynapseStatusResponse,
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

fn handle_client(stream: TcpStream, app: AppHandle) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(60)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(60)));

    let mut reader = BufReader::new(stream);

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
            let _ = reader.get_mut().write_all(b"OK\r\n");
            let _ = reader.get_mut().flush();
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
            reader.get_mut(),
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
            send_http_response(reader.get_mut(), 200, "application/json", &json);
        }

        // ── GET /api/v1/synapse/playback (Estado de Reproducción Actual) ──
        ("GET", "/api/v1/synapse/playback") | ("GET", "/playback") => {
            let mut status = app
                .try_state::<super::config::SynapseState>()
                .map(|s| s.get_playback_status())
                .unwrap_or_default();

            if status.path.is_some() && !status.is_video && !status.title.trim().is_empty() {
                let cache_bust = (status.position_ms / 15_000) ^ (status.title.len() as u64);
                status.artwork_url = Some(format!("/api/v1/synapse/artwork?t={cache_bust}"));
            }

            let json = serde_json::to_vec(&status).unwrap_or_default();
            send_http_response(reader.get_mut(), 200, "application/json", &json);
        }

        // ── GET /api/v1/synapse/artwork (Carátula de Álbum en Tiempo Real) ──
        ("GET", "/api/v1/synapse/artwork") | ("GET", "/artwork") => {
            let status = app
                .try_state::<super::config::SynapseState>()
                .map(|s| s.get_playback_status())
                .unwrap_or_default();

            if let Some(ref path_str) = status.path {
                let p = Path::new(path_str);
                if p.is_file() {
                    if let Some((bytes, mime)) = crate::infrastructure::artwork::load_music_artwork_raw_bytes(p) {
                        send_http_response(reader.get_mut(), 200, mime, &bytes);
                        return;
                    }
                }
            }

            send_http_response(reader.get_mut(), 404, "text/plain", b"No artwork available");
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
                    send_http_response(reader.get_mut(), 400, "application/json", &json);
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
            send_http_response(reader.get_mut(), 200, "application/json", &json);
        }

        // ── POST /api/v1/synapse/remote (Mando a Distancia LAN) ──
        ("POST", "/api/v1/synapse/remote") | ("POST", "/remote") => {
            let mut body = vec![0u8; content_length];
            if content_length > 0 {
                let _ = reader.read_exact(&mut body);
            }

            let cmd: SynapseRemoteCommandPayload = match serde_json::from_slice(&body) {
                Ok(c) => c,
                Err(e) => {
                    let err_resp = SynapseActionResponse {
                        success: false,
                        message: format!("Payload de comando inválido: {e}"),
                        saved_path: None,
                    };
                    let json = serde_json::to_vec(&err_resp).unwrap_or_default();
                    send_http_response(reader.get_mut(), 400, "application/json", &json);
                    return;
                }
            };

            // Manejo de eventos nativos de Trackpad / Mouse en Windows
            #[cfg(windows)]
            match cmd.command.as_str() {
                "mouse_move" => {
                    use windows::Win32::Foundation::POINT;
                    use windows::Win32::UI::WindowsAndMessaging::{GetCursorPos, SetCursorPos};
                    let mut pt = POINT::default();
                    unsafe {
                        if GetCursorPos(&mut pt).is_ok() {
                            let dx = cmd.dx.unwrap_or(0.0) as i32;
                            let dy = cmd.dy.unwrap_or(0.0) as i32;
                            let _ = SetCursorPos(pt.x + dx, pt.y + dy);
                        }
                    }
                }
                "mouse_click" => {
                    use windows::Win32::UI::Input::KeyboardAndMouse::{
                        mouse_event, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
                    };
                    unsafe {
                        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                    }
                }
                "mouse_right_click" => {
                    use windows::Win32::UI::Input::KeyboardAndMouse::{
                        mouse_event, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP,
                    };
                    unsafe {
                        mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
                        mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
                    }
                }
                "mouse_double_click" => {
                    use windows::Win32::UI::Input::KeyboardAndMouse::{
                        mouse_event, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
                    };
                    unsafe {
                        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                        std::thread::sleep(std::time::Duration::from_millis(50));
                        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                    }
                }
                "mouse_scroll" => {
                    use windows::Win32::UI::Input::KeyboardAndMouse::{mouse_event, MOUSEEVENTF_WHEEL};
                    let delta = (cmd.dy.unwrap_or(0.0) * 120.0) as i32;
                    unsafe {
                        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, delta, 0);
                    }
                }
                _ => {
                    bring_main_window_to_front(&app);
                }
            }

            let _ = app.emit("prisma://remote-command", &cmd);

            let resp = SynapseActionResponse {
                success: true,
                message: format!("Comando '{}' procesado", cmd.command),
                saved_path: None,
            };
            let json = serde_json::to_vec(&resp).unwrap_or_default();
            send_http_response(reader.get_mut(), 200, "application/json", &json);
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

            // Leer cuerpo del archivo por chunks exactos
            let mut file_data = Vec::with_capacity(content_length);
            if content_length > 0 {
                let mut chunk = vec![0u8; 64 * 1024];
                let mut bytes_left = content_length;
                while bytes_left > 0 {
                    let to_read = std::cmp::min(bytes_left, chunk.len());
                    match reader.read(&mut chunk[..to_read]) {
                        Ok(0) => {
                            eprintln!("[Synapse Server] EOF prematuro: esperados {content_length} bytes, recibidos {}", file_data.len());
                            let resp = SynapseActionResponse {
                                success: false,
                                message: format!("Error: transferencia incompleta (esperados {content_length} bytes, recibidos {})", file_data.len()),
                                saved_path: None,
                            };
                            let json = serde_json::to_vec(&resp).unwrap_or_default();
                            send_http_response(reader.get_mut(), 400, "application/json", &json);
                            return;
                        }
                        Ok(n) => {
                            file_data.extend_from_slice(&chunk[..n]);
                            bytes_left -= n;
                        }
                        Err(e) => {
                            eprintln!("[Synapse Server] Error al leer socket: {e}");
                            let resp = SynapseActionResponse {
                                success: false,
                                message: format!("Error de socket al transferir: {e}"),
                                saved_path: None,
                            };
                            let json = serde_json::to_vec(&resp).unwrap_or_default();
                            send_http_response(reader.get_mut(), 400, "application/json", &json);
                            return;
                        }
                    }
                }
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

                    // Traer ventana al frente y previsualizar directamente
                    bring_main_window_to_front(&app);
                    let open_event = SynapseOpenMediaEvent {
                        path: saved_path_str.clone(),
                        current_time: Some(0.0),
                        autoplay: Some(true),
                        title: Some(file_name.clone()),
                        artist: None,
                    };
                    let _ = app.emit("prisma://open-media", open_event);

                    let resp = SynapseActionResponse {
                        success: true,
                        message: "Archivo recibido correctamente".to_string(),
                        saved_path: Some(saved_path_str),
                    };
                    let json = serde_json::to_vec(&resp).unwrap_or_default();
                    send_http_response(reader.get_mut(), 200, "application/json", &json);
                }
                Err(e) => {
                    let resp = SynapseActionResponse {
                        success: false,
                        message: format!("Error guardando archivo en disco: {e}"),
                        saved_path: None,
                    };
                    let json = serde_json::to_vec(&resp).unwrap_or_default();
                    send_http_response(reader.get_mut(), 500, "application/json", &json);
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
            send_http_response(reader.get_mut(), 404, "application/json", &json);
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
            // Buscar en carpetas registradas de música recursivamente
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

    // Búsqueda por título si la ruta no coincidió exactamente
    if let Some(ref title) = handoff.title {
        let lower_title = title.to_lowercase().trim().to_string();
        if !lower_title.is_empty() {
            if let Some(music_state) = app.try_state::<MusicLibraryState>() {
                if let Ok(paths) = music_state.paths() {
                    for folder in &paths {
                        if let Some(found) = search_dir_by_name_part(Path::new(folder), &lower_title, 0, 4) {
                            return found;
                        }
                    }
                }
            }
        }
    }

    // Si la ruta original es de Android o no existe en Windows, devolver cadena vacía
    // para evitar que libmpv intente abrir /storage/emulated/0/... y falle con Raw(-10)
    if let Some(ref raw_path) = handoff.path {
        if raw_path.starts_with("/storage/") || raw_path.starts_with("content://") || (!raw_path.contains(":\\") && !raw_path.starts_with("\\\\")) {
            return String::new();
        }
    }

    handoff.path.clone().unwrap_or_default()
}

/// Busca recursivamente un archivo por coincidencia de nombre exacto (hasta 4 niveles)
fn find_file_in_folders(folders: &[String], target_file_name: &str) -> Option<String> {
    let lower_target = target_file_name.to_lowercase();
    for folder in folders {
        let dir = Path::new(folder);
        if !dir.is_dir() {
            continue;
        }
        if let Some(found) = search_dir_recursive(dir, &lower_target, 0, 4) {
            return Some(found);
        }
    }
    None
}

fn search_dir_recursive(dir: &Path, lower_target: &str, current_depth: usize, max_depth: usize) -> Option<String> {
    if current_depth > max_depth {
        return None;
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
            } else if path.is_dir() {
                if let Some(found) = search_dir_recursive(&path, lower_target, current_depth + 1, max_depth) {
                    return Some(found);
                }
            }
        }
    }
    None
}

fn search_dir_by_name_part(dir: &Path, lower_part: &str, current_depth: usize, max_depth: usize) -> Option<String> {
    if current_depth > max_depth {
        return None;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    let lower_name = name.to_lowercase();
                    if lower_name.contains(lower_part) {
                        return Some(path.to_string_lossy().to_string());
                    }
                }
            } else if path.is_dir() {
                if let Some(found) = search_dir_by_name_part(&path, lower_part, current_depth + 1, max_depth) {
                    return Some(found);
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
