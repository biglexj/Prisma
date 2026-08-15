use std::{collections::HashSet, path::Path};

use tauri::State;

use crate::{
    app::state::VisualLibraryState,
    features::{
        folder_session::classify_path,
        visual_library::{
            VisualFolderScan, VisualFolderSource, VisualLibraryItem, VisualMediaKind,
            scan_visual_folder,
        },
    },
    infrastructure::media_preview::{load_image_data_url, load_video_thumbnail_data_url},
};

#[tauri::command]
pub fn visual_library_list_folders(
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<Vec<VisualFolderSource>, String> {
    state.list(kind)
}

#[tauri::command]
pub fn visual_library_list_excluded_folders(
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<Vec<VisualFolderSource>, String> {
    state.list_excluded(kind)
}

#[tauri::command]
pub async fn visual_library_add_folder(
    path: String,
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<VisualFolderSource, String> {
    let owned_state = state.inner().clone();
    let excluded_paths = owned_state.excluded_paths(kind)?;
    let scan = scan_in_background(path, kind, excluded_paths).await?;
    owned_state.upsert(scan.source)
}

#[tauri::command]
pub async fn visual_library_add_excluded_folder(
    path: String,
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<VisualFolderSource, String> {
    let owned_state = state.inner().clone();
    let scan = scan_in_background(path, kind, vec![]).await?;
    owned_state.upsert_excluded(scan.source)
}

#[tauri::command]
pub async fn visual_library_rescan_folder(
    path: String,
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<VisualFolderSource, String> {
    let owned_state = state.inner().clone();
    let excluded_paths = owned_state.excluded_paths(kind)?;
    let scan = scan_in_background(path, kind, excluded_paths).await?;
    owned_state.upsert(scan.source)
}

#[tauri::command]
pub fn visual_library_remove_folder(
    path: String,
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<Vec<VisualFolderSource>, String> {
    state.remove(&path, kind)
}

#[tauri::command]
pub fn visual_library_remove_excluded_folder(
    path: String,
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<Vec<VisualFolderSource>, String> {
    state.remove_excluded(&path, kind)
}

#[tauri::command]
pub async fn visual_library_list_items(
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<Vec<VisualLibraryItem>, String> {
    let paths = state.paths(kind)?;
    let excluded_paths = state.excluded_paths(kind)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut seen = HashSet::new();
        let mut items = Vec::new();
        for path in paths {
            if let Ok(scan) = scan_visual_folder(Path::new(&path), kind, &excluded_paths) {
                for item in scan.items {
                    if seen.insert(item.path.clone()) {
                        items.push(item);
                    }
                }
            }
        }
        items.sort_by(|left, right| right.modified_at_millis.cmp(&left.modified_at_millis));
        items
    })
    .await
    .map_err(|error| format!("No se pudo completar el escaneo visual: {error}"))
}

#[tauri::command]
pub async fn visual_library_image_preview(path: String) -> Result<Option<String>, String> {
    let _permit = crate::infrastructure::media_preview::VISUAL_PREVIEW_SEMAPHORE
        .acquire()
        .await
        .map_err(|error| format!("Error en semáforo de previsualizaciones: {error}"))?;

    tauri::async_runtime::spawn_blocking(move || {
        let canonical_path = Path::new(&path)
            .canonicalize()
            .map_err(|error| format!("No se pudo abrir el elemento visual: {error}"))?;
        if !canonical_path.is_file() {
            return Err("La ruta indicada no corresponde a un archivo compatible.".to_owned());
        }
        let family = classify_path(&canonical_path);
        if family == Some(VisualMediaKind::Image.family()) {
            Ok(load_image_data_url(&canonical_path))
        } else if family == Some(VisualMediaKind::Video.family()) {
            Ok(load_video_thumbnail_data_url(&canonical_path))
        } else {
            Err("La ruta indicada no corresponde a una imagen o vídeo compatible.".to_owned())
        }
    })
    .await
    .map_err(|error| format!("No se pudo preparar la vista previa: {error}"))?
}

async fn scan_in_background(
    path: String,
    kind: VisualMediaKind,
    excluded_paths: Vec<String>,
) -> Result<VisualFolderScan, String> {
    tauri::async_runtime::spawn_blocking(move || scan_visual_folder(Path::new(&path), kind, &excluded_paths))
        .await
        .map_err(|error| format!("No se pudo completar el escaneo visual: {error}"))?
}

#[tauri::command]
pub async fn show_in_file_manager(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean_path = path.trim_start_matches(r"\\?\").to_string();
        let target = Path::new(&clean_path);
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            if target.exists() {
                let _ = Command::new("explorer")
                    .args(["/select,", &clean_path])
                    .spawn();
            } else if let Some(parent) = target.parent() {
                let _ = Command::new("explorer")
                    .arg(parent)
                    .spawn();
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = target;
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Error al abrir explorador de archivos: {e}"))?
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SubtitleTrackMeta {
    pub label: String,
    pub path: String,
    pub format: String,
    pub language: Option<String>,
}

/// Busca archivos de subtítulos externos (.srt, .vtt, .ass, .ssa) en la misma carpeta del vídeo.
#[tauri::command]
pub fn video_get_subtitles(video_path: String) -> Result<Vec<SubtitleTrackMeta>, String> {
    let clean = video_path.trim_start_matches(r"\\?\");
    let video_p = Path::new(clean);
    let parent = match video_p.parent() {
        Some(p) => p,
        None => return Ok(Vec::new()),
    };

    let stem = match video_p.file_stem().and_then(|s| s.to_str()) {
        Some(s) => s.to_lowercase(),
        None => return Ok(Vec::new()),
    };

    let mut tracks = Vec::new();
    let sub_exts = ["srt", "vtt", "ass", "ssa", "sub"];

    if let Ok(entries) = std::fs::read_dir(parent) {
        for entry in entries.flatten() {
            let p = entry.path();
            if !p.is_file() {
                continue;
            }
            if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if sub_exts.contains(&ext_lower.as_str()) {
                    if let Some(file_name) = p.file_name().and_then(|f| f.to_str()) {
                        let name_lower = file_name.to_lowercase();
                        if name_lower.starts_with(&stem) {
                            let label = p
                                .file_stem()
                                .and_then(|s| s.to_str())
                                .unwrap_or("Subtítulo")
                                .to_string();

                            let lang = if name_lower.contains(".es.")
                                || name_lower.contains("spanish")
                                || name_lower.contains("español")
                            {
                                Some("Español".to_string())
                            } else if name_lower.contains(".en.")
                                || name_lower.contains("english")
                                || name_lower.contains("inglés")
                            {
                                Some("Inglés".to_string())
                            } else {
                                None
                            };

                            tracks.push(SubtitleTrackMeta {
                                label: lang.clone().unwrap_or(label),
                                path: p.to_string_lossy().into_owned(),
                                format: ext_lower,
                                language: lang,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(tracks)
}

/// Lee un archivo SRT/VTT externo y lo devuelve como contenido WebVTT compatible con <track>.
#[tauri::command]
pub fn video_read_subtitle_vtt(subtitle_path: String) -> Result<String, String> {
    let clean = subtitle_path.trim_start_matches(r"\\?\");
    let bytes = std::fs::read(clean)
        .map_err(|e| format!("No se pudo leer el archivo de subtítulos: {e}"))?;

    let text = String::from_utf8_lossy(&bytes);

    if text.trim_start().starts_with("WEBVTT") {
        return Ok(text.into_owned());
    }

    let mut vtt = String::from("WEBVTT\n\n");
    for line in text.lines() {
        if line.contains("-->") {
            let converted = line.replace(',', ".");
            vtt.push_str(&converted);
        } else {
            vtt.push_str(line);
        }
        vtt.push('\n');
    }

    Ok(vtt)
}


