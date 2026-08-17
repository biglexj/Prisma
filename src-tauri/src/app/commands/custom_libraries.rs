use std::path::Path;
use std::process::Command;
use tauri::State;

use crate::features::custom_libraries::{
    CustomLibrariesState, CustomLibraryDefinition, CustomLibraryFolderSource, CustomLibraryItem,
};

#[tauri::command]
pub fn custom_libraries_get_all(
    state: State<'_, CustomLibrariesState>,
) -> Result<Vec<CustomLibraryDefinition>, String> {
    Ok(state.get_all())
}

#[tauri::command]
pub fn custom_libraries_save(
    state: State<'_, CustomLibrariesState>,
    definition: CustomLibraryDefinition,
) -> Result<Vec<CustomLibraryDefinition>, String> {
    state.save_or_update(definition)
}

#[tauri::command]
pub fn custom_libraries_toggle_active(
    state: State<'_, CustomLibrariesState>,
    id: String,
    active: bool,
) -> Result<Vec<CustomLibraryDefinition>, String> {
    state.toggle_active(&id, active)
}

#[tauri::command]
pub fn custom_libraries_delete(
    state: State<'_, CustomLibrariesState>,
    id: String,
) -> Result<Vec<CustomLibraryDefinition>, String> {
    state.delete_custom(&id)
}

#[tauri::command]
pub fn custom_libraries_add_folder(
    state: State<'_, CustomLibrariesState>,
    id: String,
    folder_path: String,
) -> Result<Vec<CustomLibraryDefinition>, String> {
    state.add_folder(&id, folder_path)
}

#[tauri::command]
pub fn custom_libraries_remove_folder(
    state: State<'_, CustomLibrariesState>,
    id: String,
    folder_path: String,
) -> Result<Vec<CustomLibraryDefinition>, String> {
    state.remove_folder(&id, &folder_path)
}

#[tauri::command]
pub fn custom_libraries_add_excluded_folder(
    state: State<'_, CustomLibrariesState>,
    id: String,
    folder_path: String,
) -> Result<Vec<CustomLibraryDefinition>, String> {
    state.add_excluded_folder(&id, folder_path)
}

#[tauri::command]
pub fn custom_libraries_remove_excluded_folder(
    state: State<'_, CustomLibrariesState>,
    id: String,
    folder_path: String,
) -> Result<Vec<CustomLibraryDefinition>, String> {
    state.remove_excluded_folder(&id, &folder_path)
}

#[tauri::command]
pub fn custom_libraries_get_folders(
    state: State<'_, CustomLibrariesState>,
    id: String,
) -> Result<Vec<CustomLibraryFolderSource>, String> {
    Ok(state.get_folders_with_counts(&id))
}

#[tauri::command]
pub fn custom_libraries_get_excluded_folders(
    state: State<'_, CustomLibrariesState>,
    id: String,
) -> Result<Vec<CustomLibraryFolderSource>, String> {
    Ok(state.get_excluded_folders_with_counts(&id))
}

#[tauri::command]
pub fn custom_libraries_scan_items(
    state: State<'_, CustomLibrariesState>,
    id: String,
) -> Result<Vec<CustomLibraryItem>, String> {
    Ok(state.scan_items(&id))
}

#[tauri::command]
pub async fn custom_libraries_get_thumbnail(path: String) -> Result<Option<String>, String> {
    let _permit = crate::infrastructure::media_preview::VISUAL_PREVIEW_SEMAPHORE
        .acquire()
        .await
        .map_err(|error| format!("Error en semáforo de previsualizaciones: {error}"))?;

    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        if !p.is_file() {
            return Ok(None);
        }
        let ext = p
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();

        // Lista estricta de extensiones con capacidad de miniatura gráfica
        const SUPPORTED_THUMB_EXTS: &[&str] = &[
            "png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "ico", "avif", "tiff", "tif",
            "pdf", "kra", "krz", "ora", "af", "afphoto", "afdesign", "afpub", "aftemplate",
            "psd", "psb", "ai", "mp4", "mkv", "avi", "mov", "webm",
        ];

        if !SUPPORTED_THUMB_EXTS.contains(&ext.as_str()) {
            return Ok(None);
        }

        if ext == "kra" || ext == "krz" || ext == "ora" {
            if let Some(kra_data) = crate::features::quick_look::model::extract_kra_preview(p) {
                return Ok(Some(kra_data));
            }
        }
        if let Some(img_data) = crate::infrastructure::media_preview::load_image_data_url(p) {
            return Ok(Some(img_data));
        }
        #[cfg(target_os = "windows")]
        {
            if let Some(thumb_data) =
                crate::infrastructure::media_preview::load_video_thumbnail_data_url(p)
            {
                return Ok(Some(thumb_data));
            }
        }
        Ok(None)
    })
    .await
    .map_err(|error| format!("No se pudo extraer miniatura: {error}"))?
}

#[tauri::command]
pub async fn custom_libraries_read_text_file(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        if !p.is_file() {
            return Err("El archivo no existe o no es válido.".to_string());
        }
        const MAX_TEXT_BYTES: u64 = 10 * 1024 * 1024;
        let metadata = std::fs::metadata(p).map_err(|e| e.to_string())?;
        if metadata.len() > MAX_TEXT_BYTES {
            return Err("El archivo supera el límite de 10 MB para previsualización de texto.".to_string());
        }
        std::fs::read_to_string(p).map_err(|e| format!("No se pudo leer el archivo: {e}"))
    })
    .await
    .map_err(|error| format!("Error en tarea de lectura: {error}"))?
}

#[tauri::command]
pub async fn custom_libraries_save_text_file(path: String, content: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        if !p.exists() {
            return Err("El archivo no existe en disco.".to_string());
        }
        std::fs::write(p, content.as_bytes())
            .map_err(|e| format!("No se pudo guardar el archivo: {e}"))
    })
    .await
    .map_err(|error| format!("Error en tarea de guardado: {error}"))?
}

#[tauri::command]
pub fn custom_libraries_open_file(
    path: String,
    custom_command: Option<String>,
) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("El archivo no existe".to_string());
    }

    if let Some(cmd) = custom_command {
        if !cmd.trim().is_empty() {
            let _ = Command::new(cmd.trim()).arg(&path).spawn();
            return Ok(());
        }
    }

    #[cfg(target_os = "windows")]
    {
        use windows::core::HSTRING;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let wide_path = HSTRING::from(&path);
        let wide_open = HSTRING::from("open");
        unsafe {
            ShellExecuteW(
                None,
                &wide_open,
                &wide_path,
                None,
                None,
                SW_SHOWNORMAL,
            );
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("xdg-open").arg(&path).spawn();
    }

    Ok(())
}
