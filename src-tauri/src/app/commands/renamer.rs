use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenamerFileItem {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub modified_at_millis: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameOperation {
    pub old_path: String,
    pub new_path: String,
    pub original_name: String,
    pub new_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameBatchResult {
    pub renamed_count: usize,
    pub errors: Vec<String>,
    pub can_undo: bool,
    pub operations: Vec<RenameOperation>,
}

#[derive(Default, Clone)]
pub struct RenamerState(pub std::sync::Arc<Mutex<Vec<RenameOperation>>>);

const IMAGE_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "avif", "bmp", "tiff", "tif", "gif", "svg", "ico",
    "heic", "heif", "tga", "dds", "psd", "kra", "afphoto", "raw", "cr2", "nef", "arw",
];

const VIDEO_EXTS: &[&str] = &[
    "mp4", "mkv", "webm", "avi", "mov", "wmv", "flv", "ts", "m4v", "mpg", "mpeg", "3gp",
    "vob", "ogv",
];

const AUDIO_EXTS: &[&str] = &[
    "mp3", "flac", "wav", "ogg", "aac", "m4a", "opus", "wma", "aiff", "alac", "mid",
];

const DOCUMENT_EXTS: &[&str] = &[
    "pdf", "txt", "md", "markdown", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "epub",
    "mobi", "azw3", "csv", "json", "yaml", "yml", "xml", "html", "htm", "css", "js", "ts",
    "rs", "py", "c", "cpp", "h", "log", "rtf", "odt", "ods", "odp",
];

#[tauri::command]
pub async fn renamer_scan_folder(
    folder_path: String,
    filter_mode: String,
    custom_extensions: Option<Vec<String>>,
    include_subfolders: bool,
    target_type: Option<String>,
) -> Result<Vec<RenamerFileItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean_folder = folder_path.trim().trim_matches('"').trim_matches('\'');
        let raw_path = Path::new(clean_folder);
        let base_path = if raw_path.is_file() {
            raw_path.parent().unwrap_or(raw_path)
        } else {
            raw_path
        };

        if !base_path.exists() || !base_path.is_dir() {
            return Err("La ruta especificada no es una carpeta válida o no existe".to_string());
        }

        let target_mode = target_type.unwrap_or_else(|| "files".to_string());
        let allow_files = target_mode == "files" || target_mode == "both";
        let allow_dirs = target_mode == "folders" || target_mode == "both";

        let custom_ext_list: Vec<String> = custom_extensions
            .unwrap_or_default()
            .into_iter()
            .map(|ext| ext.trim().trim_start_matches('.').to_lowercase())
            .filter(|ext| !ext.is_empty())
            .collect();

        let mut items = Vec::new();
        let mut dir_queue = vec![base_path.to_path_buf()];

        while let Some(current_dir) = dir_queue.pop() {
            if let Ok(entries) = fs::read_dir(&current_dir) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    let is_dir = entry_path.is_dir();

                    if is_dir && include_subfolders && entry_path != base_path {
                        dir_queue.push(entry_path.clone());
                    }

                    if is_dir && !allow_dirs {
                        continue;
                    }
                    if !is_dir && !allow_files {
                        continue;
                    }

                    let file_name = match entry_path.file_name().and_then(|n| n.to_str()) {
                        Some(n) => n.to_string(),
                        None => continue,
                    };

                    // Omitir archivos del sistema o temporales de Prisma
                    if file_name.starts_with('.') || file_name == "desktop.ini" || file_name == "Thumbs.db" {
                        continue;
                    }

                    let extension = if is_dir {
                        String::new()
                    } else {
                        entry_path
                            .extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("")
                            .to_lowercase()
                    };

                    // Filtrado por extensión
                    if !is_dir {
                        let matched = match filter_mode.as_str() {
                            "image" => IMAGE_EXTS.iter().any(|&e| e == extension),
                            "video" => VIDEO_EXTS.iter().any(|&e| e == extension),
                            "audio" => AUDIO_EXTS.iter().any(|&e| e == extension),
                            "document" | "docs" | "text" => DOCUMENT_EXTS.iter().any(|&e| e == extension),
                            "custom" => {
                                custom_ext_list.is_empty()
                                    || custom_ext_list.iter().any(|e| e == &extension)
                            }
                            _ => true, // "all"
                        };

                        if !matched {
                            continue;
                        }
                    }

                    let metadata = entry_path.metadata().ok();
                    let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                    let modified_at_millis = metadata
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);

                    items.push(RenamerFileItem {
                        path: entry_path.to_string_lossy().to_string(),
                        name: file_name,
                        extension,
                        is_dir,
                        size_bytes,
                        modified_at_millis,
                    });
                }
            }
        }

        // Ordenamiento natural por nombre
        items.sort_by(|a, b| crate::features::folder_session::compare_naturally(&a.name, &b.name));

        Ok(items)
    })
    .await
    .map_err(|e| format!("Error en tarea de escaneo de renombrador: {e}"))?
}

#[tauri::command]
pub async fn renamer_execute_batch(
    state: tauri::State<'_, RenamerState>,
    operations: Vec<RenameOperation>,
) -> Result<RenameBatchResult, String> {
    let hist_arc = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut executed_ops = Vec::new();
        let mut errors = Vec::new();

        if operations.is_empty() {
            return Ok(RenameBatchResult {
                renamed_count: 0,
                errors: vec!["No hay operaciones para ejecutar".to_string()],
                can_undo: false,
                operations: Vec::new(),
            });
        }

        // Caracteres no permitidos en nombres de archivo
        let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];

        // Estructura de staging para resolver renombrados circulares y en cadena
        struct StagingItem {
            src: PathBuf,
            dst: PathBuf,
            temp: Option<PathBuf>,
            original_name: String,
            new_name: String,
        }

        let mut staging: Vec<StagingItem> = Vec::new();

        for op in &operations {
            let src = PathBuf::from(&op.old_path);
            let dst = PathBuf::from(&op.new_path);

            if !src.exists() {
                errors.push(format!("No existe el archivo origen: {}", op.old_path));
                continue;
            }

            if op.new_name.trim().is_empty() {
                errors.push(format!("El nuevo nombre no puede estar vacío para: {}", op.original_name));
                continue;
            }

            if op.new_name.chars().any(|c| invalid_chars.contains(&c) || c.is_control()) {
                errors.push(format!(
                    "El nombre \"{}\" contiene caracteres no permitidos (< > : \" / \\ | ? *)",
                    op.new_name
                ));
                continue;
            }

            if src == dst {
                // Sin cambio requerido
                continue;
            }

            staging.push(StagingItem {
                src,
                dst,
                temp: None,
                original_name: op.original_name.clone(),
                new_name: op.new_name.clone(),
            });
        }

        if staging.is_empty() {
            return Ok(RenameBatchResult {
                renamed_count: 0,
                errors,
                can_undo: false,
                operations: Vec::new(),
            });
        }

        // Paso 1: Mover a nombres temporales únicos para evitar colisiones en cadena (ej: a->b, b->c)
        let unique_batch_id = std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(12345);

        for (idx, item) in staging.iter_mut().enumerate() {
            if let Some(parent) = item.src.parent() {
                let temp_file_name = format!(".__prisma_renamer_tmp_{}_{}", unique_batch_id, idx);
                let temp_path = parent.join(&temp_file_name);

                if let Err(e) = fs::rename(&item.src, &temp_path) {
                    errors.push(format!(
                        "Error al preparar renombrado temporal de \"{}\": {}",
                        item.original_name, e
                    ));
                } else {
                    item.temp = Some(temp_path);
                }
            }
        }

        // Paso 2: Mover desde el archivo temporal a su destino final
        for item in &staging {
            if let Some(ref temp_path) = item.temp {
                if let Err(e) = fs::rename(temp_path, &item.dst) {
                    errors.push(format!(
                        "Error al renombrar \"{}\" a \"{}\": {}",
                        item.original_name, item.new_name, e
                    ));
                    // Intentar restaurar origen temporal
                    let _ = fs::rename(temp_path, &item.src);
                } else {
                    executed_ops.push(RenameOperation {
                        old_path: item.src.to_string_lossy().to_string(),
                        new_path: item.dst.to_string_lossy().to_string(),
                        original_name: item.original_name.clone(),
                        new_name: item.new_name.clone(),
                    });
                }
            }
        }

        let renamed_count = executed_ops.len();
        let can_undo = !executed_ops.is_empty();

        // Guardar operaciones en el estado para permitir "Deshacer"
        if let Ok(mut hist) = hist_arc.lock() {
            *hist = executed_ops.clone();
        }

        Ok(RenameBatchResult {
            renamed_count,
            errors,
            can_undo,
            operations: executed_ops,
        })
    })
    .await
    .map_err(|e| format!("Error procesando lote de renombrado: {e}"))?
}

#[tauri::command]
pub async fn renamer_undo_batch(
    state: tauri::State<'_, RenamerState>,
) -> Result<RenameBatchResult, String> {
    let hist_arc = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let last_ops = match hist_arc.lock() {
            Ok(hist) => hist.clone(),
            Err(_) => return Err("No se pudo acceder al historial de renombrado".to_string()),
        };

        if last_ops.is_empty() {
            return Err("No hay operaciones previas para deshacer".to_string());
        }

        let mut reverted_ops = Vec::new();
        let mut errors = Vec::new();

        // Estructura staging para deshacer sin colisiones
        struct UndoStaging {
            current_path: PathBuf,
            original_path: PathBuf,
            temp: Option<PathBuf>,
            original_name: String,
            new_name: String,
        }

        let mut staging: Vec<UndoStaging> = Vec::new();

        for op in &last_ops {
            let current = PathBuf::from(&op.new_path);
            let orig = PathBuf::from(&op.old_path);

            if !current.exists() {
                errors.push(format!("No se encontró el archivo renombrado: {}", op.new_path));
                continue;
            }

            staging.push(UndoStaging {
                current_path: current,
                original_path: orig,
                temp: None,
                original_name: op.original_name.clone(),
                new_name: op.new_name.clone(),
            });
        }

        let undo_batch_id = std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(67890);

        // Paso 1: Mover a temporal
        for (idx, item) in staging.iter_mut().enumerate() {
            if let Some(parent) = item.current_path.parent() {
                let temp_name = format!(".__prisma_undo_tmp_{}_{}", undo_batch_id, idx);
                let temp_path = parent.join(&temp_name);

                if let Err(e) = fs::rename(&item.current_path, &temp_path) {
                    errors.push(format!(
                        "Error al preparar reversión de \"{}\": {}",
                        item.new_name, e
                    ));
                } else {
                    item.temp = Some(temp_path);
                }
            }
        }

        // Paso 2: Mover al original
        for item in &staging {
            if let Some(ref temp_path) = item.temp {
                if let Err(e) = fs::rename(temp_path, &item.original_path) {
                    errors.push(format!(
                        "Error al revertir a \"{}\": {}",
                        item.original_name, e
                    ));
                    let _ = fs::rename(temp_path, &item.current_path);
                } else {
                    reverted_ops.push(RenameOperation {
                        old_path: item.current_path.to_string_lossy().to_string(),
                        new_path: item.original_path.to_string_lossy().to_string(),
                        original_name: item.new_name.clone(),
                        new_name: item.original_name.clone(),
                    });
                }
            }
        }

        // Limpiar el historial una vez deshecho
        if let Ok(mut hist) = hist_arc.lock() {
            hist.clear();
        }

        Ok(RenameBatchResult {
            renamed_count: reverted_ops.len(),
            errors,
            can_undo: false,
            operations: reverted_ops,
        })
    })
    .await
    .map_err(|e| format!("Error al deshacer el lote de renombrado: {e}"))?
}
