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
