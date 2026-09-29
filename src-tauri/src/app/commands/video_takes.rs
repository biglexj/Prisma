use std::{collections::HashMap, path::Path};
use tauri::State;

use crate::{
    features::visual_library::video_metadata::{
        extract_video_technical_metadata, VideoTechnicalMetadata,
    },
    infrastructure::video_takes::{
        ClipColor, TakeStatus, VideoTakeMarker, VideoTakesState,
    },
};

#[tauri::command]
pub async fn video_get_technical_metadata(
    path: String,
) -> Result<VideoTechnicalMetadata, String> {
    tokio::task::spawn_blocking(move || {
        let p = Path::new(&path);
        if !p.is_file() {
            return Err(format!("El archivo de vídeo no existe: {path}"));
        }
        extract_video_technical_metadata(p)
    })
    .await
    .map_err(|e| format!("Error en tarea asíncrona de metadatos de vídeo: {e}"))?
}

#[tauri::command]
pub fn video_get_take_marker(
    path: String,
    state: State<'_, VideoTakesState>,
) -> Result<Option<VideoTakeMarker>, String> {
    state.get_marker(&path)
}

#[tauri::command]
pub fn video_set_take_marker(
    path: String,
    status: TakeStatus,
    clip_color: Option<ClipColor>,
    rating: Option<u8>,
    note: Option<String>,
    state: State<'_, VideoTakesState>,
) -> Result<VideoTakeMarker, String> {
    state.set_marker(&path, status, clip_color, rating, note)
}

#[tauri::command]
pub fn video_list_take_markers(
    state: State<'_, VideoTakesState>,
) -> Result<HashMap<String, VideoTakeMarker>, String> {
    state.list_all()
}

#[tauri::command]
pub fn video_delete_take_marker(
    path: String,
    state: State<'_, VideoTakesState>,
) -> Result<bool, String> {
    state.delete_marker(&path)
}
