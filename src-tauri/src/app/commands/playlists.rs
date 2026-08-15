use std::path::Path;
use tauri::{AppHandle, Manager, State};

use crate::{
    app::state::{MusicLibraryState, VisualLibraryState},
    features::visual_library::VisualMediaKind,
    infrastructure::playlists::{
        HiddenPlaylistsStore, PlaylistItem, PlaylistMeta, RelinkResult, clean_missing_from_m3u, delete_m3u,
        parse_m3u, relink_folder_in_m3u, relink_item_in_m3u, scan_playlists_recursive, write_m3u,
    },
};

/// Lista todas las playlists encontradas en todas las fuentes de música y vídeos/imágenes
/// escaneando de forma recursiva sus subdirectorios y anotando si están ocultas.
#[tauri::command]
pub fn playlists_list(
    music_state: State<'_, MusicLibraryState>,
    visual_state: State<'_, VisualLibraryState>,
    app: AppHandle,
) -> Result<Vec<PlaylistMeta>, String> {
    let mut all: Vec<PlaylistMeta> = Vec::new();

    // 1. Escaneo recursivo en fuentes de música (hasta 5 niveles)
    if let Ok(music_folders) = music_state.paths() {
        for folder_path in &music_folders {
            let path = Path::new(folder_path);
            if path.is_dir() {
                let mut found = scan_playlists_recursive(path, 5);
                all.append(&mut found);
            }
        }
    }

    // 2. Escaneo recursivo en fuentes de vídeo
    if let Ok(video_folders) = visual_state.paths(VisualMediaKind::Video) {
        for folder_path in &video_folders {
            let path = Path::new(folder_path);
            if path.is_dir() {
                let mut found = scan_playlists_recursive(path, 5);
                all.append(&mut found);
            }
        }
    }

    // 3. Escaneo recursivo en fuentes de imágenes
    if let Ok(image_folders) = visual_state.paths(VisualMediaKind::Image) {
        for folder_path in &image_folders {
            let path = Path::new(folder_path);
            if path.is_dir() {
                let mut found = scan_playlists_recursive(path, 5);
                all.append(&mut found);
            }
        }
    }

    // 3. Deduplicar por ruta normalizada
    all.sort_by(|a, b| a.path.to_lowercase().cmp(&b.path.to_lowercase()));
    all.dedup_by(|a, b| a.path.eq_ignore_ascii_case(&b.path));

    // 4. Marcar si están ocultas según la base de listas ocultas
    if let Ok(app_dir) = app.path().app_data_dir() {
        let hidden_store = HiddenPlaylistsStore::load_from_dir(&app_dir);
        for meta in &mut all {
            meta.is_hidden = hidden_store.is_hidden(&meta.path);
        }
    }

    all.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(all)
}

/// Carga y parsea el contenido de una playlist .m3u/.m3u8 por su ruta, verificando archivos.
#[tauri::command]
pub fn playlists_read(path: String) -> Result<Vec<PlaylistItem>, String> {
    parse_m3u(Path::new(&path))
}

/// Crea una nueva playlist vacía con el nombre dado en la fuente de música o vídeo correspondiente.
#[tauri::command]
pub fn playlists_create(
    name: String,
    kind: Option<String>,
    music_state: State<'_, MusicLibraryState>,
    visual_state: State<'_, VisualLibraryState>,
) -> Result<PlaylistMeta, String> {
    let is_video = kind.as_deref() == Some("video");
    let folder = if is_video {
        let video_folders = visual_state.paths(VisualMediaKind::Video)?;
        video_folders
            .first()
            .cloned()
            .ok_or_else(|| "No hay carpetas de vídeo configuradas.".to_owned())?
    } else {
        let music_folders = music_state.paths()?;
        music_folders
            .first()
            .cloned()
            .ok_or_else(|| "No hay carpetas de música configuradas.".to_owned())?
    };

    let safe_name = name
        .chars()
        .map(|c| if r#"\/:*?"<>|"#.contains(c) { '_' } else { c })
        .collect::<String>();

    let m3u_path = Path::new(&folder).join(format!("{safe_name}.m3u"));

    if m3u_path.exists() {
        return Err(format!("Ya existe una lista con ese nombre: {safe_name}"));
    }

    write_m3u(&m3u_path, &name, &[])?;

    Ok(PlaylistMeta {
        name,
        path: m3u_path.to_string_lossy().into_owned(),
        item_count: 0,
        valid_count: 0,
        video_count: 0,
        audio_count: 0,
        media_kind: if is_video { "video".to_owned() } else { "music".to_owned() },
        modified_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        is_hidden: false,
    })
}

/// Guarda una lista completa con un conjunto inicial de ítems.
#[tauri::command]
pub fn playlists_save_from_items(
    name: String,
    items: Vec<PlaylistItem>,
    music_state: State<'_, MusicLibraryState>,
    visual_state: State<'_, VisualLibraryState>,
) -> Result<PlaylistMeta, String> {
    let videos = items.iter().filter(|it| it.is_video).count();
    let is_video = videos > items.len().saturating_sub(videos);

    let folder = if is_video {
        if let Ok(video_folders) = visual_state.paths(VisualMediaKind::Video) {
            video_folders.first().cloned()
        } else {
            None
        }
    } else {
        None
    };

    let target_folder = if let Some(f) = folder {
        f
    } else {
        let music_folders = music_state.paths()?;
        music_folders
            .first()
            .cloned()
            .ok_or_else(|| "No hay fuentes configuradas.".to_owned())?
    };

    let safe_name = name
        .chars()
        .map(|c| if r#"\/:*?"<>|"#.contains(c) { '_' } else { c })
        .collect::<String>();

    let m3u_path = Path::new(&target_folder).join(format!("{safe_name}.m3u"));

    write_m3u(&m3u_path, &name, &items)?;

    let valid_count = items.iter().filter(|it| it.is_available).count();
    let audios = items.len().saturating_sub(videos);

    Ok(PlaylistMeta {
        name,
        path: m3u_path.to_string_lossy().into_owned(),
        item_count: items.len(),
        valid_count,
        video_count: videos,
        audio_count: audios,
        media_kind: if videos > 0 && audios == 0 {
            "video".to_owned()
        } else if audios > 0 && videos == 0 {
            "music".to_owned()
        } else {
            "mixed".to_owned()
        },
        modified_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        is_hidden: false,
    })
}

/// Importa un archivo .m3u/.m3u8 externo copiándolo a la carpeta de Prisma.
#[tauri::command]
pub fn playlists_import(
    file_path: String,
    music_state: State<'_, MusicLibraryState>,
) -> Result<PlaylistMeta, String> {
    let source_path = Path::new(&file_path);
    if !source_path.is_file() {
        return Err("El archivo de lista de reproducción no existe.".to_owned());
    }

    let items = parse_m3u(source_path)?;
    let file_name = source_path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Lista importada".to_owned());

    let folder_paths = music_state.paths()?;
    let dest_folder = folder_paths
        .first()
        .ok_or_else(|| "No hay fuentes configuradas donde guardar la lista.".to_owned())?;

    let dest_path = Path::new(dest_folder).join(format!("{file_name}.m3u"));

    write_m3u(&dest_path, &file_name, &items)?;

    let valid_count = items.iter().filter(|it| it.is_available).count();
    let videos = items.iter().filter(|it| it.is_video).count();
    let audios = items.len().saturating_sub(videos);

    Ok(PlaylistMeta {
        name: file_name,
        path: dest_path.to_string_lossy().into_owned(),
        item_count: items.len(),
        valid_count,
        video_count: videos,
        audio_count: audios,
        media_kind: if videos > 0 && audios == 0 {
            "video".to_owned()
        } else if audios > 0 && videos == 0 {
            "music".to_owned()
        } else {
            "mixed".to_owned()
        },
        modified_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        is_hidden: false,
    })
}

/// Elimina un archivo de playlist de disco con confirmación.
#[tauri::command]
pub fn playlists_delete(path: String) -> Result<(), String> {
    delete_m3u(Path::new(&path))
}

/// Alterna si una playlist está oculta o visible en Prisma.
#[tauri::command]
pub fn playlists_toggle_hidden(path: String, app: AppHandle) -> Result<bool, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Error obteniendo app_data_dir: {e}"))?;

    let mut store = HiddenPlaylistsStore::load_from_dir(&app_dir);
    let is_hidden = store.toggle(&path);
    store.save_to_dir(&app_dir)?;
    Ok(is_hidden)
}

/// Limpia las pistas no encontradas (que no existen en disco) de la lista.
#[tauri::command]
pub fn playlists_clean_missing(path: String) -> Result<Vec<PlaylistItem>, String> {
    clean_missing_from_m3u(Path::new(&path))
}

/// Añade un ítem al final de una playlist .m3u existente.
#[tauri::command]
pub fn playlists_add_item(
    playlist_path: String,
    item_path: String,
    item_title: String,
    item_duration: i64,
) -> Result<usize, String> {
    let m3u_path = Path::new(&playlist_path);
    let mut items = parse_m3u(m3u_path)?;
    let is_available = Path::new(&item_path).is_file();
    items.push(PlaylistItem {
        path: item_path,
        title: item_title,
        duration_secs: item_duration,
        is_available,
        is_video: false,
    });
    let name = m3u_path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    write_m3u(m3u_path, &name, &items)?;
    Ok(items.len())
}

/// Elimina un ítem de una playlist por su ruta.
#[tauri::command]
pub fn playlists_remove_item(playlist_path: String, item_path: String) -> Result<usize, String> {
    let m3u_path = Path::new(&playlist_path);
    let mut items = parse_m3u(m3u_path)?;
    items.retain(|it| it.path != item_path);
    let name = m3u_path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    write_m3u(m3u_path, &name, &items)?;
    Ok(items.len())
}

/// Reconecta una pista individual de la lista asignándole su nueva ruta en disco.
#[tauri::command]
pub fn playlists_relink_item(
    playlist_path: String,
    old_item_path: String,
    new_item_path: String,
) -> Result<Vec<PlaylistItem>, String> {
    relink_item_in_m3u(Path::new(&playlist_path), &old_item_path, &new_item_path)
}

/// Escanea recursivamente una carpeta para reconectar automáticamente pistas no encontradas (estilo DaVinci Relink).
#[tauri::command]
pub fn playlists_relink_folder(
    playlist_path: String,
    search_folder: String,
) -> Result<RelinkResult, String> {
    relink_folder_in_m3u(Path::new(&playlist_path), Path::new(&search_folder))
}

