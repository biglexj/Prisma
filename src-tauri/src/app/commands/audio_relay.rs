use std::sync::Arc;
use tauri::State;
use crate::features::audio_relay::{AudioRelayService, RelayStatus};

#[tauri::command]
pub fn mobile_audio_status(service: State<'_, Arc<AudioRelayService>>) -> RelayStatus { service.status() }
#[tauri::command]
pub async fn mobile_audio_toggle(service: State<'_, Arc<AudioRelayService>>) -> Result<RelayStatus, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.toggle()).await.map_err(|_| "No se pudo cambiar el altavoz")?
}
#[tauri::command]
pub async fn mobile_audio_set_enabled(enabled: bool, service: State<'_, Arc<AudioRelayService>>) -> Result<RelayStatus, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.set_enabled(enabled)).await.map_err(|_| "No se pudo activar el altavoz")?
}
#[tauri::command]
pub fn mobile_audio_configure(volume: f32, capture_device_id: Option<String>, service: State<'_, Arc<AudioRelayService>>) -> Result<RelayStatus, String> { service.configure(volume, capture_device_id) }
#[tauri::command]
pub fn mobile_audio_set_shortcut(shortcut: String, service: State<'_, Arc<AudioRelayService>>) -> Result<RelayStatus, String> { service.set_shortcut(shortcut) }
#[tauri::command]
pub async fn mobile_audio_select_phone(address: String, service: State<'_, Arc<AudioRelayService>>) -> Result<RelayStatus, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.select_phone(address)).await.map_err(|_| "No se pudo seleccionar el teléfono")?
}
