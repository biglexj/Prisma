use tauri::State;

use crate::{
    app::state::{InitialFileState, PlaybackProbeState},
    features::playback::model::{PlaybackCapabilities, PlaybackSnapshot},
};

#[tauri::command]
pub fn get_initial_file(state: State<'_, InitialFileState>) -> Option<String> {
    state.0.lock().ok().and_then(|mut guard| guard.take())
}

#[tauri::command]
pub fn playback_capabilities(state: State<'_, PlaybackProbeState>) -> PlaybackCapabilities {
    state.capabilities()
}

#[tauri::command]
pub fn playback_load(
    path: String,
    state: State<'_, PlaybackProbeState>,
) -> Result<PlaybackSnapshot, String> {
    state.load(&path)
}

#[tauri::command]
pub fn playback_next(state: State<'_, PlaybackProbeState>) -> Result<PlaybackSnapshot, String> {
    state.next()
}

#[tauri::command]
pub fn playback_previous(state: State<'_, PlaybackProbeState>) -> Result<PlaybackSnapshot, String> {
    state.previous()
}

#[tauri::command]
pub fn playback_toggle_pause(
    state: State<'_, PlaybackProbeState>,
) -> Result<PlaybackSnapshot, String> {
    state.with_backend(|backend| backend.toggle_pause())
}

#[tauri::command]
pub fn playback_pause(
    state: State<'_, PlaybackProbeState>,
) -> Result<PlaybackSnapshot, String> {
    state.pause()
}

#[tauri::command]
pub fn playback_resume(
    state: State<'_, PlaybackProbeState>,
) -> Result<PlaybackSnapshot, String> {
    state.resume()
}

#[tauri::command]
pub fn playback_seek(
    seconds: f64,
    state: State<'_, PlaybackProbeState>,
) -> Result<PlaybackSnapshot, String> {
    state.with_backend(|backend| backend.seek(seconds))
}

#[tauri::command]
pub fn playback_set_volume(
    volume: f64,
    state: State<'_, PlaybackProbeState>,
) -> Result<PlaybackSnapshot, String> {
    state.with_backend(|backend| backend.set_volume(volume))
}

#[tauri::command]
pub fn playback_set_speed(
    speed: f64,
    state: State<'_, PlaybackProbeState>,
) -> Result<PlaybackSnapshot, String> {
    state.with_backend(|backend| backend.set_speed(speed))
}

#[tauri::command]
pub fn playback_snapshot(state: State<'_, PlaybackProbeState>) -> Result<PlaybackSnapshot, String> {
    state.with_backend(|backend| backend.snapshot())
}

#[tauri::command]
pub fn playback_set_dsp_config(
    config: crate::features::playback::model::DspConfig,
    state: State<'_, PlaybackProbeState>,
    passthru: State<'_, std::sync::Arc<crate::infrastructure::media::passthru::PassthruService>>,
) -> Result<(), String> {
    let params = (&config).into();
    passthru.set_dsp_params(params);
    state.set_dsp_config(&config)
}

#[tauri::command]
pub fn playback_get_audio_devices(
    state: State<'_, PlaybackProbeState>,
) -> Result<Vec<crate::features::playback::model::AudioDeviceItem>, String> {
    state.get_audio_devices()
}

#[tauri::command]
pub fn playback_set_audio_device(
    device_name: String,
    state: State<'_, PlaybackProbeState>,
) -> Result<(), String> {
    state.set_audio_device(&device_name)
}

#[tauri::command]
pub fn global_passthru_get_status(
    passthru: State<'_, std::sync::Arc<crate::infrastructure::media::passthru::PassthruService>>,
) -> crate::infrastructure::media::passthru::GlobalPassthruStatus {
    passthru.get_status()
}

#[tauri::command]
pub fn global_passthru_toggle(
    enabled: bool,
    capture_device_id: Option<String>,
    render_device_id: Option<String>,
    passthru: State<'_, std::sync::Arc<crate::infrastructure::media::passthru::PassthruService>>,
) -> Result<crate::infrastructure::media::passthru::GlobalPassthruStatus, String> {
    if enabled {
        passthru.start(capture_device_id, render_device_id)?;
    } else {
        passthru.stop()?;
    }
    Ok(passthru.get_status())
}

#[tauri::command]
pub fn global_passthru_list_endpoints(
) -> Result<Vec<crate::infrastructure::media::passthru::AudioEndpointInfo>, String> {
    crate::infrastructure::media::passthru::PassthruService::list_endpoints()
}

#[tauri::command]
pub fn global_passthru_set_volume(
    volume: f32,
    passthru: State<'_, std::sync::Arc<crate::infrastructure::media::passthru::PassthruService>>,
) -> Result<(), String> {
    passthru.set_volume(volume)
}

#[tauri::command]
pub fn playback_set_system_default_device(
    device_id: String,
    _passthru: State<'_, std::sync::Arc<crate::infrastructure::media::passthru::PassthruService>>,
) -> Result<(), String> {
    crate::infrastructure::media::passthru::PassthruService::set_system_default_endpoint(&device_id)?;
    Ok(())
}


