use std::fs::File;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpStream, UdpSocket};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

use super::model::SynapseBeaconPayload;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SynapseDiscoveredDevice {
    pub device_id: String,
    pub device_name: String,
    pub device_type: String,
    pub ip_address: String,
    pub port: u16,
    pub os: String,
    pub target_app: String,
    pub capabilities: Vec<String>,
    pub last_seen_ms: u64,
}

#[derive(Clone)]
pub struct SynapseDiscoveryService {
    devices: Arc<Mutex<Vec<SynapseDiscoveredDevice>>>,
    running: Arc<AtomicBool>,
}

impl SynapseDiscoveryService {
    pub fn start() -> Self {
        let devices: Arc<Mutex<Vec<SynapseDiscoveredDevice>>> = Arc::new(Mutex::new(Vec::new()));
        let devices_clone = devices.clone();
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        std::thread::Builder::new()
            .name("synapse-discovery-thread".into())
            .spawn(move || {
                let port = 49289;

                // Crear socket UDP para recibir beacons de broadcast de la red local
                let socket = match UdpSocket::bind(format!("0.0.0.0:{port}")) {
                    Ok(s) => {
                        let _ = s.set_read_timeout(Some(Duration::from_millis(1500)));
                        s
                    }
                    Err(e) => {
                        eprintln!("[Synapse Discovery] No se pudo vincular al puerto UDP {port}: {e}");
                        return;
                    }
                };

                let mut buf = [0u8; 4096];

                while running_clone.load(Ordering::Relaxed) {
                    match socket.recv_from(&mut buf) {
                        Ok((size, src)) => {
                            if let Ok(json_str) = std::str::from_utf8(&buf[..size]) {
                                if let Ok(beacon) = serde_json::from_str::<SynapseBeaconPayload>(json_str) {
                                    let ip_address = src.ip().to_string();

                                    // Ignorar beacons propios emitidos por esta misma app Prisma en PC
                                    if !beacon.device_id.starts_with("prisma_desktop_") {
                                        let now = SystemTime::now()
                                            .duration_since(UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_millis() as u64;

                                        let node = SynapseDiscoveredDevice {
                                            device_id: beacon.device_id,
                                            device_name: beacon.device_name,
                                            device_type: beacon.device_type,
                                            ip_address,
                                            port: beacon.port,
                                            os: beacon.os,
                                            target_app: beacon.target_app,
                                            capabilities: beacon.capabilities,
                                            last_seen_ms: now,
                                        };

                                        if let Ok(mut dev_list) = devices_clone.lock() {
                                            if let Some(idx) = dev_list.iter().position(|d| d.device_id == node.device_id || d.ip_address == node.ip_address) {
                                                dev_list[idx] = node;
                                            } else {
                                                dev_list.push(node);
                                            }

                                            // Limpiar dispositivos con más de 60 segundos de inactividad
                                            dev_list.retain(|d| now.saturating_sub(d.last_seen_ms) < 60_000);
                                        }
                                    }
                                }
                            }
                        }
                        Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut || e.kind() == std::io::ErrorKind::WouldBlock => {
                            // Timeout normal de lectura
                        }
                        Err(_) => {
                            std::thread::sleep(Duration::from_millis(200));
                        }
                    }
                }
            })
            .expect("No se pudo iniciar el hilo de descubrimiento Synapse");

        Self { devices, running }
    }

    pub fn get_devices(&self) -> Vec<SynapseDiscoveredDevice> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        if let Ok(mut list) = self.devices.lock() {
            list.retain(|d| now.saturating_sub(d.last_seen_ms) < 60_000);
            list.clone()
        } else {
            Vec::new()
        }
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }
}

/// Envía un archivo local por streaming HTTP hacia un dispositivo Synapse (ej. Super Gallery en Android).
pub fn send_file_to_device_sync(
    app: &AppHandle,
    target_ip: &str,
    target_port: u16,
    file_path: &Path,
) -> Result<String, String> {
    if !file_path.is_file() {
        return Err(format!("El archivo no existe: {}", file_path.display()));
    }

    let file_name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "archivo".to_string());

    let mut file = File::open(file_path).map_err(|e| format!("No se pudo abrir el archivo: {e}"))?;
    let file_size = file.metadata().map(|m| m.len()).unwrap_or(0);

    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let media_type = match ext.as_str() {
        "mp3" | "flac" | "wav" | "aac" | "ogg" | "opus" | "m4a" | "wma" => "audio",
        "mp4" | "mkv" | "avi" | "mov" | "webm" | "flv" | "wmv" | "m4v" => "video",
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "avif" | "svg" => "image",
        "pdf" | "epub" | "cbr" | "cbz" | "txt" | "md" => "document",
        _ => "application/octet-stream",
    };

    let encoded_file_name = urlencoding_encode(&file_name);

    let addr = format!("{target_ip}:{target_port}");
    let mut stream = TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("Dirección IP inválida: {e}"))?,
        Duration::from_secs(5),
    )
    .map_err(|e| format!("No se pudo conectar con {addr}: {e}"))?;

    let _ = stream.set_write_timeout(Some(Duration::from_secs(60)));
    let _ = stream.set_read_timeout(Some(Duration::from_secs(60)));

    let request_header = format!(
        "POST /api/v1/synapse/upload HTTP/1.1\r\n\
        Host: {addr}\r\n\
        X-File-Name: {encoded_file_name}\r\n\
        X-Media-Type: {media_type}\r\n\
        Content-Type: application/octet-stream\r\n\
        Content-Length: {file_size}\r\n\
        Connection: close\r\n\r\n"
    );

    stream
        .write_all(request_header.as_bytes())
        .map_err(|e| format!("Error enviando encabezado HTTP: {e}"))?;

    let mut buffer = [0u8; 32 * 1024];
    let mut sent_bytes: u64 = 0;

    while sent_bytes < file_size {
        let n = file
            .read(&mut buffer)
            .map_err(|e| format!("Error leyendo archivo de disco: {e}"))?;
        if n == 0 {
            break;
        }

        stream
            .write_all(&buffer[..n])
            .map_err(|e| format!("Error enviando bytes de archivo: {e}"))?;
        sent_bytes += n as u64;

        let progress = if file_size > 0 {
            (sent_bytes as f64) / (file_size as f64)
        } else {
            1.0
        };

        let _ = app.emit(
            "prisma://upload-progress",
            serde_json::json!({
                "fileName": file_name,
                "sentBytes": sent_bytes,
                "totalBytes": file_size,
                "progress": progress
            }),
        );
    }

    stream.flush().map_err(|e| format!("Error al finalizar envío: {e}"))?;

    // Leer respuesta HTTP
    let mut reader = BufReader::new(stream);
    let mut status_line = String::new();
    reader
        .read_line(&mut status_line)
        .map_err(|e| format!("Error leyendo respuesta del dispositivo: {e}"))?;

    if status_line.contains("200") {
        Ok(format!("\"{}\" enviado a Super Gallery exitosamente", file_name))
    } else {
        Err(format!("El dispositivo móvil respondió con error: {}", status_line.trim()))
    }
}

fn urlencoding_encode(s: &str) -> String {
    let mut result = String::new();
    for byte in s.bytes() {
        match byte {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(byte as char);
            }
            _ => {
                result.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    result
}
