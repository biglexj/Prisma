use std::{collections::HashSet, fs, path::Path};

use tauri::State;

use crate::{
    app::state::MusicLibraryState,
    features::{
        folder_session::{classify_path, clean_path, clean_path_str, compare_naturally, MediaFamily},
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
    let _permit = crate::infrastructure::artwork::ARTWORK_SEMAPHORE
        .acquire()
        .await
        .map_err(|error| format!("Error en semáforo de carátulas: {error}"))?;

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

#[tauri::command]
pub async fn music_library_lyrics(path: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let canonical_path = Path::new(&path)
            .canonicalize()
            .map_err(|error| format!("No se pudo abrir el archivo de audio: {error}"))?;
        if !canonical_path.is_file() || classify_path(&canonical_path) != Some(MediaFamily::Audio) {
            return Err("La ruta indicada no corresponde a un audio compatible.".to_owned());
        }
        Ok(crate::infrastructure::lyrics::load_track_lyrics(&canonical_path))
    })
    .await
    .map_err(|error| format!("No se pudieron leer las letras: {error}"))?
}

#[tauri::command]
pub async fn music_library_scan_duplicates(
    options: crate::features::visual_library::DuplicateScanOptions,
    state: State<'_, MusicLibraryState>,
) -> Result<Vec<crate::features::visual_library::DuplicateGroup>, String> {
    let scan_paths = {
        let mut p = Vec::new();
        if let Some(ref b) = options.base_folder {
            p.push(b.clone());
        }
        if let Some(ref t) = options.target_folder {
            p.push(t.clone());
        }
        if !p.is_empty() {
            p
        } else if !options.paths.is_empty() {
            options.paths.clone()
        } else {
            state.paths()?
        }
    };
    let excluded_paths = state.excluded_paths()?;

    tauri::async_runtime::spawn_blocking(move || {
        let mut seen = HashSet::new();
        let mut items = Vec::new();
        for path in scan_paths {
            if let Ok(scan) = scan_music_folder(Path::new(&path), &excluded_paths) {
                for item in scan.items {
                    if seen.insert(item.path.clone()) {
                        items.push(item);
                    }
                }
            }
        }
        Ok(crate::features::music_library::scan_music_duplicates(items, options, None))
    })
    .await
    .map_err(|e| format!("Error en runtime al escanear duplicados de música: {e}"))?
}

async fn scan_in_background(
    path: String,
    excluded_paths: Vec<String>,
) -> Result<MusicFolderScan, String> {
    tauri::async_runtime::spawn_blocking(move || scan_music_folder(Path::new(&path), &excluded_paths))
        .await
        .map_err(|error| format!("No se pudo completar el escaneo de música: {error}"))?
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderAudioTrackItem {
    pub path: String,
    pub title: String,
    pub artist: Option<String>,
    pub size_bytes: u64,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderAudioTracksResult {
    pub folder_name: String,
    pub target_index: usize,
    pub tracks: Vec<FolderAudioTrackItem>,
}

#[tauri::command]
pub async fn music_library_scan_folder_tracks(
    file_path: String,
) -> Result<FolderAudioTracksResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean_target = clean_path_str(&file_path);
        let path = Path::new(&clean_target);
        let canonical_file = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        let parent = match canonical_file.parent() {
            Some(p) if p.is_dir() => p,
            _ => {
                let stem = canonical_file
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Pista")
                    .to_string();
                return Ok(FolderAudioTracksResult {
                    folder_name: "Música".to_string(),
                    target_index: 0,
                    tracks: vec![FolderAudioTrackItem {
                        path: clean_target,
                        title: stem,
                        artist: None,
                        size_bytes: 0,
                    }],
                });
            }
        };

        let folder_name = parent
            .file_name()
            .and_then(|n| n.to_str())
            .filter(|n| !n.is_empty())
            .unwrap_or("Música")
            .to_string();

        let entries = match fs::read_dir(parent) {
            Ok(e) => e,
            Err(_) => {
                let stem = canonical_file
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Pista")
                    .to_string();
                return Ok(FolderAudioTracksResult {
                    folder_name,
                    target_index: 0,
                    tracks: vec![FolderAudioTrackItem {
                        path: clean_target,
                        title: stem,
                        artist: None,
                        size_bytes: 0,
                    }],
                });
            }
        };

        let mut audio_paths = Vec::new();
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() && classify_path(&p) == Some(MediaFamily::Audio) {
                audio_paths.push(p);
            }
        }

        audio_paths.sort_by(|a, b| {
            let a_name = a.file_name().map(|n| n.to_string_lossy()).unwrap_or_default();
            let b_name = b.file_name().map(|n| n.to_string_lossy()).unwrap_or_default();
            compare_naturally(&a_name, &b_name)
        });

        if audio_paths.is_empty() {
            audio_paths.push(canonical_file.clone());
        }

        let target_lower = canonical_file
            .file_name()
            .map(|n| n.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let target_index = audio_paths
            .iter()
            .position(|p| {
                p == &canonical_file
                    || p.file_name().map(|n| n.to_string_lossy().to_lowercase()) == Some(target_lower.clone())
                    || p.canonicalize().ok() == Some(canonical_file.clone())
            })
            .unwrap_or(0);

        let mut tracks = Vec::with_capacity(audio_paths.len());
        for p in audio_paths {
            let clean_p = clean_path(&p);
            let mut title = p
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Pista sin nombre")
                .to_string();
            let mut artist = None;

            if let Ok(probe) = lofty::probe::Probe::open(&p) {
                if let Ok(tagged_file) = probe
                    .options(lofty::config::ParseOptions::new().read_properties(false))
                    .read()
                {
                    use lofty::file::TaggedFileExt;
                    use lofty::tag::Accessor;
                    if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
                        if let Some(t) = tag.title().as_deref() {
                            if !t.trim().is_empty() {
                                title = t.trim().to_string();
                            }
                        }
                        if let Some(a) = tag.artist().as_deref() {
                            if !a.trim().is_empty() {
                                artist = Some(a.trim().to_string());
                            }
                        }
                    }
                }
            }

            let size_bytes = p.metadata().map(|m| m.len()).unwrap_or(0);

            tracks.push(FolderAudioTrackItem {
                path: clean_p,
                title,
                artist,
                size_bytes,
            });
        }

        Ok(FolderAudioTracksResult {
            folder_name,
            target_index,
            tracks,
        })
    })
    .await
    .map_err(|e| format!("Error al escanear pistas de la carpeta de audio: {e}"))?
}


