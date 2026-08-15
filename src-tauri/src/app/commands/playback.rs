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
