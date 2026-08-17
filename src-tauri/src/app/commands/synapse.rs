use serde::{Deserialize, Serialize};
use tauri::State;

use crate::features::synapse::SynapseState;

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
pub fn synapse_update_playback(
    status: crate::features::synapse::SynapsePlaybackStatus,
    state: State<'_, SynapseState>,
) -> Result<(), String> {
    state.set_playback_status(status);
    Ok(())
}

#[tauri::command]
pub async fn launch_luna_fetch(url: Option<String>) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;

            // 1. Si se envía una URL, intentar lanzar vía protocolo lunafetch://
            if let Some(ref target_url) = url {
                let trimmed = target_url.trim();
                if !trimmed.is_empty() {
                    let proto = format!("lunafetch://download?url={}", trimmed);
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
            let _ = url;
            Ok(false)
        }
    })
    .await
    .map_err(|e| format!("Error al iniciar Luna Fetch: {e}"))?
}

