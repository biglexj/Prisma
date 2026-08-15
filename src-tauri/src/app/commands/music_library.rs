use std::{collections::HashSet, path::Path};

use tauri::State;

use crate::{
    app::state::MusicLibraryState,
    features::{
        folder_session::{MediaFamily, classify_path, compare_naturally},
        music_library::{MusicFolderScan, MusicFolderSource, MusicLibraryItem, scan_music_folder},
    },
    infrastructure::artwork::load_music_artwork_data_url,
};

#[tauri::command]
pub fn music_library_list_folders(
    state: State<'_, MusicLibraryState>,
) -> Result<Vec<MusicFolderSource>, String> {
    state.list()
}

#[tauri::command]
pub fn music_library_list_excluded_folders(
    state: State<'_, MusicLibraryState>,
) -> Result<Vec<MusicFolderSource>, String> {
    state.list_excluded()
}

#[tauri::command]
pub async fn music_library_add_folder(
    path: String,
    state: State<'_, MusicLibraryState>,
) -> Result<MusicFolderSource, String> {
    let owned_state = state.inner().clone();
    let excluded_paths = owned_state.excluded_paths()?;
    let scan = scan_in_background(path, excluded_paths).await?;
    owned_state.upsert(scan.source)
}

#[tauri::command]
pub async fn music_library_add_excluded_folder(
    path: String,
    state: State<'_, MusicLibraryState>,
) -> Result<MusicFolderSource, String> {
    let owned_state = state.inner().clone();
    let scan = scan_in_background(path, vec![]).await?;
    owned_state.upsert_excluded(scan.source)
}

#[tauri::command]
pub async fn music_library_rescan_folder(
    path: String,
    state: State<'_, MusicLibraryState>,
) -> Result<MusicFolderSource, String> {
    let owned_state = state.inner().clone();
    let excluded_paths = owned_state.excluded_paths()?;
    let scan = scan_in_background(path, excluded_paths).await?;
    owned_state.upsert(scan.source)
}

#[tauri::command]
pub fn music_library_remove_folder(
    path: String,
    state: State<'_, MusicLibraryState>,
) -> Result<Vec<MusicFolderSource>, String> {
    state.remove(&path)
}

#[tauri::command]
pub fn music_library_remove_excluded_folder(
    path: String,
    state: State<'_, MusicLibraryState>,
) -> Result<Vec<MusicFolderSource>, String> {
    state.remove_excluded(&path)
}

#[tauri::command]
pub async fn music_library_list_items(
    state: State<'_, MusicLibraryState>,
) -> Result<Vec<MusicLibraryItem>, String> {
    let paths = state.paths()?;
    let excluded_paths = state.excluded_paths()?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut seen = HashSet::new();
        let mut items = Vec::new();

        for path in paths {
            if let Ok(scan) = scan_music_folder(Path::new(&path), &excluded_paths) {
                for item in scan.items {
                    if seen.insert(item.path.clone()) {
                        items.push(item);
                    }
                }
            }
        }

        items.sort_by(|left, right| compare_naturally(&left.path, &right.path));
        items
    })
    .await
    .map_err(|error| format!("No se pudo completar el escaneo de música: {error}"))
}

#[tauri::command]
pub async fn music_library_artwork(path: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let canonical_path = Path::new(&path)
            .canonicalize()
            .map_err(|error| format!("No se pudo abrir el audio: {error}"))?;
        if !canonical_path.is_file() || classify_path(&canonical_path) != Some(MediaFamily::Audio) {
            return Err("La ruta indicada no corresponde a un audio compatible.".to_owned());
        }
        Ok(load_music_artwork_data_url(&canonical_path))
    })
    .await
    .map_err(|error| format!("No se pudo leer la carátula: {error}"))?
}

async fn scan_in_background(
    path: String,
    excluded_paths: Vec<String>,
) -> Result<MusicFolderScan, String> {
    tauri::async_runtime::spawn_blocking(move || scan_music_folder(Path::new(&path), &excluded_paths))
        .await
        .map_err(|error| format!("No se pudo completar el escaneo de música: {error}"))?
}
