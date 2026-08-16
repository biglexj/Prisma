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
