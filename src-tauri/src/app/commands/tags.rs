use std::path::Path;

use crate::infrastructure::{
    exif::{read_image_exif, ImageExifData},
    tags::{
        read_audio_tags, save_track_lyrics, write_audio_tags, AudioTagData, UpdateAudioTagsRequest,
    },
};

#[tauri::command]
pub async fn audio_read_tags(
    path: String,
    include_artwork: Option<bool>,
) -> Result<AudioTagData, String> {
    tauri::async_runtime::spawn_blocking(move || {
        read_audio_tags(Path::new(&path), include_artwork.unwrap_or(true))
    })
    .await
    .map_err(|e| format!("Error en tarea de lectura de tags: {e}"))?
}

#[tauri::command]
pub async fn audio_write_tags(request: UpdateAudioTagsRequest) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || write_audio_tags(request))
        .await
        .map_err(|e| format!("Error en tarea de guardado de tags: {e}"))?
}

#[tauri::command]
pub async fn audio_batch_write_tags(requests: Vec<UpdateAudioTagsRequest>) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut errors = Vec::new();
        for req in requests {
            let path = req.path.clone();
            if let Err(e) = write_audio_tags(req) {
                errors.push(format!("{path}: {e}"));
            }
        }
        Ok(errors)
    })
    .await
    .map_err(|e| format!("Error en tarea de guardado por lote: {e}"))?
}

#[tauri::command]
pub async fn audio_save_lyrics(
    path: String,
    lyrics: String,
    srt_content: Option<String>,
    save_lrc_file: Option<bool>,
    save_srt_file: Option<bool>,
    embed_in_tag: Option<bool>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        save_track_lyrics(
            Path::new(&path),
            &lyrics,
            srt_content.as_deref(),
            save_lrc_file.unwrap_or(true),
            save_srt_file.unwrap_or(false),
            embed_in_tag.unwrap_or(false),
        )
    })
    .await
    .map_err(|e| format!("Error guardando letras: {e}"))?
}

#[tauri::command]
pub async fn image_read_exif(path: String) -> Result<ImageExifData, String> {
    tauri::async_runtime::spawn_blocking(move || read_image_exif(Path::new(&path)))
        .await
        .map_err(|e| format!("Error leyendo metadatos EXIF: {e}"))?
}
