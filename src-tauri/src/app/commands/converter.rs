use std::path::Path;
use serde::{Deserialize, Serialize};

use crate::infrastructure::converter::{
    convert_image, extract_video_audio, get_ffmpeg_status, transcode_audio, transcode_video,
    AudioTranscodeOptions, FFmpegStatus, ImageConvertOptions, VideoToAudioOptions,
    VideoTranscodeOptions,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "mode")]
pub enum BatchJobPayload {
    #[serde(rename = "image")]
    Image {
        input_path: String,
        output_path: String,
        options: ImageConvertOptions,
    },
    #[serde(rename = "video_to_audio")]
    VideoToAudio {
        input_path: String,
        output_path: String,
        options: VideoToAudioOptions,
    },
    #[serde(rename = "video_transcode")]
    VideoTranscode {
        input_path: String,
        output_path: String,
        options: VideoTranscodeOptions,
    },
    #[serde(rename = "audio_transcode")]
    AudioTranscode {
        input_path: String,
        output_path: String,
        options: AudioTranscodeOptions,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchJobResult {
    pub input_path: String,
    pub output_path: String,
    pub success: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub fn converter_get_status() -> Result<FFmpegStatus, String> {
    Ok(get_ffmpeg_status())
}

#[tauri::command]
pub async fn converter_convert_image(
    input_path: String,
    output_path: String,
    options: ImageConvertOptions,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        convert_image(Path::new(&input_path), Path::new(&output_path), &options)
    })
    .await
    .map_err(|e| format!("Error en tarea de conversión: {e}"))?
}

#[tauri::command]
pub async fn converter_extract_video_audio(
    input_path: String,
    output_path: String,
    options: VideoToAudioOptions,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        extract_video_audio(Path::new(&input_path), Path::new(&output_path), &options)
    })
    .await
    .map_err(|e| format!("Error en tarea de extracción: {e}"))?
}

#[tauri::command]
pub async fn converter_transcode_video(
    input_path: String,
    output_path: String,
    options: VideoTranscodeOptions,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        transcode_video(Path::new(&input_path), Path::new(&output_path), &options)
    })
    .await
    .map_err(|e| format!("Error en tarea de transcodificación: {e}"))?
}

#[tauri::command]
pub async fn converter_transcode_audio(
    input_path: String,
    output_path: String,
    options: AudioTranscodeOptions,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        transcode_audio(Path::new(&input_path), Path::new(&output_path), &options)
    })
    .await
    .map_err(|e| format!("Error en tarea de audio: {e}"))?
}

#[tauri::command]
pub async fn converter_process_batch_item(
    job: BatchJobPayload,
) -> Result<BatchJobResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        match job {
            BatchJobPayload::Image {
                input_path,
                output_path,
                options,
            } => {
                match convert_image(Path::new(&input_path), Path::new(&output_path), &options) {
                    Ok(()) => BatchJobResult {
                        input_path,
                        output_path,
                        success: true,
                        error: None,
                    },
                    Err(e) => BatchJobResult {
                        input_path,
                        output_path,
                        success: false,
                        error: Some(e),
                    },
                }
            }
            BatchJobPayload::VideoToAudio {
                input_path,
                output_path,
                options,
            } => {
                match extract_video_audio(
                    Path::new(&input_path),
                    Path::new(&output_path),
                    &options,
                ) {
                    Ok(()) => BatchJobResult {
                        input_path,
                        output_path,
                        success: true,
                        error: None,
                    },
                    Err(e) => BatchJobResult {
                        input_path,
                        output_path,
                        success: false,
                        error: Some(e),
                    },
                }
            }
            BatchJobPayload::VideoTranscode {
                input_path,
                output_path,
                options,
            } => {
                match transcode_video(Path::new(&input_path), Path::new(&output_path), &options) {
                    Ok(()) => BatchJobResult {
                        input_path,
                        output_path,
                        success: true,
                        error: None,
                    },
                    Err(e) => BatchJobResult {
                        input_path,
                        output_path,
                        success: false,
                        error: Some(e),
                    },
                }
            }
            BatchJobPayload::AudioTranscode {
                input_path,
                output_path,
                options,
            } => {
                match transcode_audio(Path::new(&input_path), Path::new(&output_path), &options) {
                    Ok(()) => BatchJobResult {
                        input_path,
                        output_path,
                        success: true,
                        error: None,
                    },
                    Err(e) => BatchJobResult {
                        input_path,
                        output_path,
                        success: false,
                        error: Some(e),
                    },
                }
            }
        }
    })
    .await
    .map_err(|e| format!("Error procesando lote: {e}"))
}

#[tauri::command]
pub async fn converter_scan_folder(
    folder_path: String,
    mode: String,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&folder_path);
        if !path.is_dir() {
            return Err("La ruta especificada no es una carpeta válida".to_string());
        }

        let image_exts: &[&str] = &[
            "jpg", "jpeg", "png", "webp", "avif", "bmp", "tiff", "tif", "gif", "svg", "ico",
            "heic", "heif", "tga", "dds", "psd", "kra", "afphoto", "raw", "cr2", "nef", "arw",
        ];
        let video_exts: &[&str] = &[
            "mp4", "mkv", "webm", "avi", "mov", "wmv", "flv", "ts", "m4v", "mpg", "mpeg", "3gp",
            "vob", "ogv",
        ];
        let audio_exts: &[&str] = &[
            "mp3", "flac", "wav", "ogg", "aac", "m4a", "opus", "wma", "aiff", "alac", "mid",
        ];

        let target_exts: &[&str] = match mode.as_str() {
            "image" => image_exts,
            "video_to_audio" | "video_transcode" => video_exts,
            "audio_transcode" => audio_exts,
            _ => &[],
        };

        let mut collected = Vec::new();
        let mut stack = vec![path.to_path_buf()];

        while let Some(current_dir) = stack.pop() {
            if let Ok(entries) = std::fs::read_dir(&current_dir) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    if entry_path.is_dir() {
                        stack.push(entry_path);
                    } else if entry_path.is_file() {
                        if let Some(ext) = entry_path.extension().and_then(|e| e.to_str()) {
                            let ext_lower = ext.to_lowercase();
                            if target_exts.is_empty()
                                || target_exts.iter().any(|&e| e == ext_lower)
                            {
                                collected.push(entry_path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }

        collected.sort();
        Ok(collected)
    })
    .await
    .map_err(|e| format!("Error escaneando carpeta: {e}"))?
}
