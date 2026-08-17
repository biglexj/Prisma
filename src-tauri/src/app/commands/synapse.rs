use serde::{Deserialize, Serialize};
use tauri::State;

use crate::features::synapse::{
    send_file_to_device_sync, SynapseDiscoveredDevice, SynapseDiscoveryService, SynapseState,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SynapseStatusInfo {
    pub beacon_active: bool,
    pub server_active: bool,
    pub port: u16,
    pub beacon_port: u16,
    pub device_name: String,
    pub downloads_dir: String,
}

#[tauri::command]
pub fn synapse_get_status(state: State<'_, SynapseState>) -> SynapseStatusInfo {
    let device_name = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "PC-Biglex".to_string());

    SynapseStatusInfo {
        beacon_active: true,
        server_active: true,
        port: 49288,
        beacon_port: 49289,
        device_name,
        downloads_dir: state.get_downloads_dir().to_string_lossy().to_string(),
    }
}

#[tauri::command]
pub fn synapse_set_downloads_dir(
    new_dir: String,
    state: State<'_, SynapseState>,
) -> Result<String, String> {
    state.set_downloads_dir(new_dir)
}

#[tauri::command]
pub fn synapse_get_downloads_dir(state: State<'_, SynapseState>) -> String {
    state.get_downloads_dir().to_string_lossy().to_string()
}

#[tauri::command]
pub fn synapse_get_discovered_devices(
    discovery: State<'_, SynapseDiscoveryService>,
) -> Vec<SynapseDiscoveredDevice> {
    discovery.get_devices()
}

#[tauri::command]
pub async fn synapse_send_file_to_device(
    app: tauri::AppHandle,
    target_ip: String,
    target_port: u16,
    file_path: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = std::path::Path::new(&file_path);
        send_file_to_device_sync(&app, &target_ip, target_port, p)
    })
    .await
    .map_err(|e| format!("Error en tarea de envío: {e}"))?
}

#[tauri::command]
pub fn synapse_update_playback(
    status: crate::features::synapse::SynapsePlaybackStatus,
    state: State<'_, SynapseState>,
) -> Result<(), String> {
    state.set_playback_status(status);
    Ok(())
}

#[tauri::command]
pub async fn launch_luna_fetch(
    url: Option<String>,
    format: Option<String>,
    quality: Option<String>,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;

            // 1. Si se envía una URL, intentar lanzar vía protocolo lunafetch:// con parámetros
            if let Some(ref target_url) = url {
                let trimmed = target_url.trim();
                if !trimmed.is_empty() {
                    let mut proto = format!("lunafetch://download?url={}", trimmed);
                    if let Some(ref fmt) = format {
                        if !fmt.trim().is_empty() {
                            proto.push_str(&format!("&format={}", fmt.trim()));
                        }
                    }
                    if let Some(ref q) = quality {
                        if !q.trim().is_empty() {
                            proto.push_str(&format!("&quality={}", q.trim()));
                        }
                    }
                    if let Ok(mut child) = Command::new("cmd").args(["/C", "start", "", &proto]).spawn() {
                        let _ = child.wait();
                        return Ok(true);
                    }
                }
            }

            // 2. Comprobar ejecutables instalados de LunaFetch
            let mut candidates = Vec::new();
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                candidates.push(std::path::PathBuf::from(&local_app_data).join("Programs").join("LunaFetch").join("LunaFetch.exe"));
                candidates.push(std::path::PathBuf::from(&local_app_data).join("LunaFetch").join("LunaFetch.exe"));
            }
            if let Ok(prog_files) = std::env::var("ProgramFiles") {
                candidates.push(std::path::PathBuf::from(&prog_files).join("LunaFetch").join("LunaFetch.exe"));
                candidates.push(std::path::PathBuf::from(&prog_files).join("Luna Fetch").join("LunaFetch.exe"));
            }
            // Ubicación del repositorio en desarrollo
            candidates.push(std::path::PathBuf::from(r"D:\Proyectos\biglexj\Luna---Fetch\release\LunaFetch.exe"));

            for cand in candidates {
                if cand.exists() {
                    let mut cmd = Command::new(&cand);
                    if let Some(ref u) = url {
                        if !u.trim().is_empty() {
                            cmd.arg(u.trim());
                        }
                    }
                    if let Some(ref fmt) = format {
                        if !fmt.trim().is_empty() {
                            cmd.args(["--format", fmt.trim()]);
                        }
                    }
                    if let Some(ref q) = quality {
                        if !q.trim().is_empty() {
                            cmd.args(["--quality", q.trim()]);
                        }
                    }
                    if let Ok(_) = cmd.spawn() {
                        return Ok(true);
                    }
                }
            }

            // 3. Intento genérico vía protocolo
            if let Ok(mut child) = Command::new("cmd").args(["/C", "start", "", "lunafetch:"]).spawn() {
                let _ = child.wait();
                return Ok(true);
            }

            Ok(false)
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = (url, format, quality);
            Ok(false)
        }
    })
    .await
    .map_err(|e| format!("Error al iniciar Luna Fetch: {e}"))?
}

#[tauri::command]
pub async fn launch_gallery_dl(
    url: Option<String>,
    directory_structure: Option<String>,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            use std::io::Write;
            use std::net::TcpStream;
            use std::process::Command;
            use std::time::Duration;

            // 1. Si se envía una URL, intentar POST directo a InterceptionServer (puertos 18274 prod y 18284 dev)
            if let Some(ref target_url) = url {
                let trimmed = target_url.trim();
                if !trimmed.is_empty() {
                    let struct_val = directory_structure.as_deref().unwrap_or("Flat");
                    let ports = [18274, 18284];
                    for port in ports {
                        if let Ok(mut stream) = TcpStream::connect_timeout(
                            &std::net::SocketAddr::from(([127, 0, 0, 1], port)),
                            Duration::from_millis(400),
                        ) {
                            let _ = stream.set_write_timeout(Some(Duration::from_millis(400)));
                            let json_body = format!(
                                r#"{{"url":"{}","directoryStructure":"{}"}}"#,
                                trimmed.replace('\\', "\\\\").replace('"', "\\\""),
                                struct_val.replace('\\', "\\\\").replace('"', "\\\"")
                            );
                            let req = format!(
                                "POST /download HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                port,
                                json_body.len(),
                                json_body
                            );
                            if stream.write_all(req.as_bytes()).is_ok() {
                                return Ok(true);
                            }
                        }
                    }
                }
            }

            // 2. Comprobar ejecutables instalados de Gallery-DL GUI
            let mut candidates = Vec::new();
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                candidates.push(std::path::PathBuf::from(&local_app_data).join("Programs").join("GalleryDL-GUI").join("GalleryDL-GUI.exe"));
                candidates.push(std::path::PathBuf::from(&local_app_data).join("GalleryDL-GUI").join("GalleryDL-GUI.exe"));
            }
            if let Ok(prog_files) = std::env::var("ProgramFiles") {
                candidates.push(std::path::PathBuf::from(&prog_files).join("GalleryDL-GUI").join("GalleryDL-GUI.exe"));
                candidates.push(std::path::PathBuf::from(&prog_files).join("Gallery-DL GUI").join("GalleryDL-GUI.exe"));
            }
            // Ubicación del repositorio en desarrollo
            candidates.push(std::path::PathBuf::from(r"D:\Proyectos\biglexj\Gallery-DL-GUI\release\GalleryDL-GUI.exe"));

            for cand in candidates {
                if cand.exists() {
                    let mut cmd = Command::new(&cand);
                    if let Some(ref u) = url {
                        if !u.trim().is_empty() {
                            cmd.arg(u.trim());
                        }
                    }
                    if let Ok(_) = cmd.spawn() {
                        return Ok(true);
                    }
                }
            }

            // 3. Fallback: intentar invocar por comando directo en PATH o protocolo
            if let Ok(mut child) = Command::new("cmd").args(["/C", "start", "", "gallerydl:"]).spawn() {
                let _ = child.wait();
                return Ok(true);
            }

            Ok(false)
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = (url, directory_structure);
            Ok(false)
        }
    })
    .await
    .map_err(|e| format!("Error al iniciar Gallery-DL GUI: {e}"))?
}


