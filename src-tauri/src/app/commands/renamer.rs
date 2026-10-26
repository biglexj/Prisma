use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use serde::{Deserialize, Serialize};

mod safe_batch;

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
pub struct RenamerLoadResult {
    /// "folder" cuando el origen es una carpeta, "files" cuando es una selección explícita.
    pub kind: String,
    /// Texto a mostrar en la barra de herramientas.
    pub display: String,
    pub items: Vec<RenamerFileItem>,
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

/// Limpia una ruta Vendida por el sistema o por el drop de Windows.
fn sanitize_path(raw: &str) -> PathBuf {
    PathBuf::from(raw.trim().trim_matches('"').trim_matches('\''))
}

/// Comprueba si la extensión del archivo pasa el filtro activo.
fn matches_filter(extension: &str, filter_mode: &str, custom_ext_list: &[String]) -> bool {
    match filter_mode {
        "image" => IMAGE_EXTS.iter().any(|&e| e == extension),
        "video" => VIDEO_EXTS.iter().any(|&e| e == extension),
        "audio" => AUDIO_EXTS.iter().any(|&e| e == extension),
        "document" | "docs" | "text" => DOCUMENT_EXTS.iter().any(|&e| e == extension),
        "custom" => {
            custom_ext_list.is_empty() || custom_ext_list.iter().any(|e| e == &extension)
        }
        _ => true, // "all"
    }
}

/// Construye el item de un archivo o carpeta aplicando filtros y omitiendo archivos del sistema.
fn build_item(
    entry_path: &Path,
    is_dir: bool,
    filter_mode: &str,
    custom_ext_list: &[String],
) -> Option<RenamerFileItem> {
    let file_name = match entry_path.file_name().and_then(|n| n.to_str()) {
        Some(n) => n.to_string(),
        None => return None,
    };

    // Omitir archivos del sistema o temporales de Prisma
    if file_name.starts_with('.') || file_name == "desktop.ini" || file_name == "Thumbs.db" {
        return None;
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

    if !is_dir && !matches_filter(&extension, filter_mode, custom_ext_list) {
        return None;
    }

    let metadata = entry_path.metadata().ok();
    let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
    let modified_at_millis = metadata
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    Some(RenamerFileItem {
        path: entry_path.to_string_lossy().to_string(),
        name: file_name,
        extension,
        is_dir,
        size_bytes,
        modified_at_millis,
    })
}

/// Recorre un directorio completo y acumula sus archivos (y carpetas) en `items`.
fn scan_directory(
    base_path: &Path,
    filter_mode: &str,
    custom_ext_list: &[String],
    include_subfolders: bool,
    allow_files: bool,
    allow_dirs: bool,
    items: &mut Vec<RenamerFileItem>,
) {
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

                if let Some(item) = build_item(&entry_path, is_dir, filter_mode, custom_ext_list) {
                    items.push(item);
                }
            }
        }
    }
}

/// Normaliza la lista de extensiones personalizadas.
fn normalize_custom_extensions(custom_extensions: Option<Vec<String>>) -> Vec<String> {
    custom_extensions
        .unwrap_or_default()
        .into_iter()
        .map(|ext| ext.trim().trim_start_matches('.').to_lowercase())
        .filter(|ext| !ext.is_empty())
        .collect()
}

/// Compone el texto que se muestra en la barra de herramientas para una selección.
fn selection_display(paths: &[PathBuf], file_count: usize) -> String {
    let label = if file_count == 1 {
        "1 archivo seleccionado".to_string()
    } else {
        format!("{file_count} archivos seleccionados")
    };

    let mut parents: Vec<&Path> = Vec::new();
    for p in paths.iter().filter(|p| p.is_file()) {
        if let Some(parent) = p.parent() {
            if !parents.iter().any(|existing| *existing == parent) {
                parents.push(parent);
            }
        }
    }

    if parents.len() == 1 {
        format!("{}  ({})", parents[0].to_string_lossy(), label)
    } else {
        label
    }
}

#[tauri::command]
pub async fn renamer_scan_folder(
    folder_path: String,
    filter_mode: String,
    custom_extensions: Option<Vec<String>>,
    include_subfolders: bool,
    target_type: Option<String>,
) -> Result<Vec<RenamerFileItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let raw_path = sanitize_path(&folder_path);
        let base_path = if raw_path.is_file() {
            raw_path.parent().unwrap_or(&raw_path).to_path_buf()
        } else {
            raw_path
        };

        if !base_path.exists() || !base_path.is_dir() {
            return Err("La ruta especificada no es una carpeta válida o no existe".to_string());
        }

        let target_mode = target_type.unwrap_or_else(|| "files".to_string());
        let allow_files = target_mode == "files" || target_mode == "both";
        let allow_dirs = target_mode == "folders" || target_mode == "both";
        let custom_ext_list = normalize_custom_extensions(custom_extensions);

        let mut items = Vec::new();
        scan_directory(
            &base_path,
            &filter_mode,
            &custom_ext_list,
            include_subfolders,
            allow_files,
            allow_dirs,
            &mut items,
        );

        // Ordenamiento natural por nombre
        items.sort_by(|a, b| crate::features::folder_session::compare_naturally(&a.name, &b.name));

        Ok(items)
    })
    .await
    .map_err(|e| format!("Error en tarea de escaneo de renombrador: {e}"))?
}

/// Resuelve el origen de trabajo del renombrador.
///
/// - Una única carpeta → modo "folder": se escanea su contenido completo.
/// - Una selección de archivos → modo "files": se cargan **solo** esos archivos,
///   sin expandir la carpeta que los contiene.
pub fn resolve_source_paths(
    paths: Vec<String>,
    filter_mode: &str,
    custom_extensions: Option<Vec<String>>,
    include_subfolders: bool,
    target_type: Option<&str>,
) -> Result<RenamerLoadResult, String> {
    let cleaned: Vec<PathBuf> = paths
        .iter()
        .map(|p| sanitize_path(p))
        .filter(|p| !p.as_os_str().is_empty())
        .collect();

    if cleaned.is_empty() {
        return Err("No se recibió ninguna ruta válida".to_string());
    }

    let target_mode = target_type.unwrap_or("files");
    let allow_files = target_mode == "files" || target_mode == "both";
    let allow_dirs = target_mode == "folders" || target_mode == "both";
    let custom_ext_list = normalize_custom_extensions(custom_extensions);

    // Una sola carpeta: se mantiene el comportamiento histórico de escaneo completo.
    if cleaned.len() == 1 && cleaned[0].is_dir() {
        let base_path = cleaned[0].clone();
        let mut items = Vec::new();
        scan_directory(
            &base_path,
            filter_mode,
            &custom_ext_list,
            include_subfolders,
            allow_files,
            allow_dirs,
            &mut items,
        );
        items.sort_by(|a, b| crate::features::folder_session::compare_naturally(&a.name, &b.name));

        return Ok(RenamerLoadResult {
            kind: "folder".to_string(),
            display: base_path.to_string_lossy().to_string(),
            items,
        });
    }

    // Selección explícita: solo los archivos señalados, nunca su carpeta contenedora.
    let mut items = Vec::new();
    let mut file_count = 0usize;

    for path in &cleaned {
        if path.is_dir() {
            // Carpeta dentro de una selección múltiple: se expande su contenido.
            let mut sub_items = Vec::new();
            scan_directory(
                path,
                filter_mode,
                &custom_ext_list,
                include_subfolders,
                allow_files,
                allow_dirs,
                &mut sub_items,
            );
            items.extend(sub_items);
        } else if path.is_file() {
            file_count += 1;
            if let Some(item) = build_item(path, false, filter_mode, &custom_ext_list) {
                items.push(item);
            }
        }
    }

    items.sort_by(|a, b| crate::features::folder_session::compare_naturally(&a.name, &b.name));

    Ok(RenamerLoadResult {
        kind: "files".to_string(),
        display: selection_display(&cleaned, file_count),
        items,
    })
}

#[tauri::command]
pub async fn renamer_scan_paths(
    paths: Vec<String>,
    filter_mode: String,
    custom_extensions: Option<Vec<String>>,
    include_subfolders: bool,
    target_type: Option<String>,
) -> Result<RenamerLoadResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        resolve_source_paths(
            paths,
            &filter_mode,
            custom_extensions,
            include_subfolders,
            target_type.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("Error en tarea de carga del renombrador: {e}"))?
}

#[tauri::command]
pub async fn renamer_occupied_paths(paths: Vec<String>) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || occupied_paths(&paths))
        .await.map_err(|e| format!("Error consultando nombres existentes: {e}"))?
}

fn occupied_paths(paths: &[String]) -> Result<Vec<String>, String> {
    let mut seen = std::collections::HashSet::new();
    let mut occupied = Vec::new();
    for path in paths {
        let source = Path::new(path);
        let parent = source.parent().ok_or("La ruta no tiene carpeta contenedora")?;
        // Devolver las rutas con el mismo prefijo que usa cada origen, incluso
        // cuando dos prefijos apuntan a la misma carpeta mediante un enlace.
        if !seen.insert(parent.to_path_buf()) { continue; }
        for entry in fs::read_dir(parent).map_err(|e| format!("No se pudo leer {}: {e}", parent.display()))? {
            let entry = entry.map_err(|e| format!("No se pudo comprobar un nombre en {}: {e}", parent.display()))?;
            // Incluir archivos, carpetas y enlaces, también los ocultos por los filtros.
            occupied.push(parent.join(entry.file_name()).to_string_lossy().into_owned());
        }
    }
    Ok(occupied)
}

#[tauri::command]
pub fn renamer_can_undo(state: tauri::State<'_, RenamerState>) -> Result<bool, String> {
    state.0.lock().map(|history| !history.is_empty())
        .map_err(|_| "No se pudo acceder al historial".to_string())
}

#[tauri::command]
pub async fn renamer_validate_batch(
    operations: Vec<RenameOperation>,
) -> Result<Vec<safe_batch::RenameConflict>, String> {
    tauri::async_runtime::spawn_blocking(move || safe_batch::validate(&operations))
        .await.map_err(|e| format!("Error comprobando conflictos: {e}"))
}

#[tauri::command]
pub async fn renamer_execute_batch(
    state: tauri::State<'_, RenamerState>,
    operations: Vec<RenameOperation>,
) -> Result<RenameBatchResult, String> {
    let history = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Serializar la operación completa, incluido deshacer y su historial.
        let mut history = history.lock().map_err(|_| "No se pudo acceder al historial")?;
        Ok(safe_batch::execute_recorded(&operations, &mut history))
    }).await.map_err(|e| format!("Error procesando lote de renombrado: {e}"))?
}

#[tauri::command]
pub async fn renamer_undo_batch(
    state: tauri::State<'_, RenamerState>,
) -> Result<RenameBatchResult, String> {
    let history = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut history = history.lock().map_err(|_| "No se pudo acceder al historial")?;
        if history.is_empty() { return Err("No hay operaciones previas para deshacer".into()); }
        Ok(safe_batch::undo(&mut history))
    }).await.map_err(|e| format!("Error al deshacer el lote de renombrado: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    #[test]
    fn occupied_names_include_files_outside_selection_and_folders() {
        let dir = temp_fixture("occupied");
        fs::write(dir.join(".hidden.png"), b"hidden").unwrap();
        let selection = vec![dir.join("a.png").to_string_lossy().into_owned(), dir.join("b.png").to_string_lossy().into_owned()];
        let occupied = occupied_paths(&selection).unwrap();
        assert_eq!(occupied.len(), 5); // a.png, b.png, c.mp4, sub y .hidden.png.
        for name in ["a.png", "b.png", "c.mp4", "sub", ".hidden.png"] {
            assert!(occupied.contains(&dir.join(name).to_string_lossy().into_owned()));
        }
        assert!(occupied_paths(&[dir.join("missing/a.png").to_string_lossy().into_owned()]).is_err());
        fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn skipped_number_plan_preserves_occupied_files_and_can_be_undone() {
        use sha2::{Digest, Sha256};
        let dir = temp_fixture("skip_and_undo");
        let mut protected = Vec::new();
        for number in 7..=14 {
            let name = format!("Summertime {number:02}.png");
            fs::write(dir.join(&name), [number as u8]).unwrap();
            protected.push((name, Sha256::digest([number as u8])));
        }
        let mut operations = Vec::new();
        for index in 0..20 {
            let original_name = format!("picture{index}.png");
            let number = if index < 6 { index + 1 } else { index + 9 };
            let new_name = format!("Summertime {number:02}.png");
            fs::write(dir.join(&original_name), [100 + index as u8]).unwrap();
            operations.push(RenameOperation {
                old_path: dir.join(&original_name).to_string_lossy().into_owned(),
                new_path: dir.join(&new_name).to_string_lossy().into_owned(),
                original_name, new_name,
            });
        }
        let occupied = occupied_paths(&operations.iter().map(|op| op.old_path.clone()).collect::<Vec<_>>()).unwrap();
        assert!(protected.iter().all(|(name, _)| occupied.contains(&dir.join(name).to_string_lossy().into_owned())));
        let mut history = Vec::new();
        let result = safe_batch::execute_recorded(&operations, &mut history);
        assert!(result.errors.is_empty(), "{:?}", result.errors);
        assert_eq!(result.renamed_count, 20);
        for (index, op) in operations.iter().enumerate() {
            assert_eq!(fs::read(&op.new_path).unwrap(), [100 + index as u8]);
        }
        for (name, digest) in &protected { assert_eq!(&Sha256::digest(fs::read(dir.join(name)).unwrap()), digest); }
        let reverted = safe_batch::undo(&mut history);
        assert!(reverted.errors.is_empty());
        assert_eq!(reverted.renamed_count, 20);
        for (index, op) in operations.iter().enumerate() {
            assert_eq!(fs::read(&op.old_path).unwrap(), [100 + index as u8]);
        }
        for (name, digest) in &protected { assert_eq!(&Sha256::digest(fs::read(dir.join(name)).unwrap()), digest); }
        fs::remove_dir_all(dir).unwrap();
    }

    /// Crea una carpeta temporal con archivos de prueba.
    fn temp_fixture(label: &str) -> PathBuf {
        let unique = COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "prisma_renamer_test_{}_{}_{}",
            label,
            std::process::id(),
            unique
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("crear carpeta de prueba");
        for name in ["a.png", "b.png", "c.mp4"] {
            fs::write(dir.join(name), b"x").expect("escribir archivo de prueba");
        }
        let sub = dir.join("sub");
        fs::create_dir_all(&sub).expect("crear subcarpeta");
        fs::write(sub.join("d.png"), b"x").expect("escribir archivo en subcarpeta");
        dir
    }

    #[test]
    fn una_carpeta_escanea_todo_su_contenido() {
        let dir = temp_fixture("folder");
        let result = resolve_source_paths(
            vec![dir.to_string_lossy().to_string()],
            "all",
            None,
            false,
            Some("files"),
        )
        .expect("resolver carpeta");

        assert_eq!(result.kind, "folder");
        // 3 archivos en la raíz, la subcarpeta no se incluye (sin subcarpetas).
        assert_eq!(result.items.len(), 3);
        assert!(result.items.iter().all(|i| !i.is_dir));
        assert_eq!(result.display, dir.to_string_lossy());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn una_seleccion_de_archivos_no_expande_la_carpeta() {
        let dir = temp_fixture("selection");
        let selection = vec![
            dir.join("a.png").to_string_lossy().to_string(),
            dir.join("c.mp4").to_string_lossy().to_string(),
        ];

        let result = resolve_source_paths(selection.clone(), "all", None, false, Some("files"))
            .expect("resolver selección");

        assert_eq!(result.kind, "files");
        // Solo los 2 archivos elegidos: ni b.png, ni la subcarpeta.
        assert_eq!(result.items.len(), 2);
        let names: Vec<&str> = result.items.iter().map(|i| i.name.as_str()).collect();
        assert!(names.contains(&"a.png"));
        assert!(names.contains(&"c.mp4"));
        assert!(!names.contains(&"b.png"));
        assert!(result.display.contains("2 archivos seleccionados"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn un_solo_archivo_suelto_no_carga_su_carpeta() {
        let dir = temp_fixture("single");
        let file = dir.join("a.png").to_string_lossy().to_string();

        let result = resolve_source_paths(vec![file], "all", None, false, Some("files"))
            .expect("resolver archivo suelto");

        assert_eq!(result.kind, "files");
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].name, "a.png");
        assert!(result.display.contains("1 archivo seleccionado"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn la_seleccion_respeta_el_filtro_de_extension() {
        let dir = temp_fixture("filter");
        let selection = vec![
            dir.join("a.png").to_string_lossy().to_string(),
            dir.join("c.mp4").to_string_lossy().to_string(),
        ];

        let result = resolve_source_paths(selection, "image", None, false, Some("files"))
            .expect("resolver selección filtrada");

        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].name, "a.png");

        let _ = fs::remove_dir_all(&dir);
    }
}
