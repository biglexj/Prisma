use std::path::Path;
use base64::{Engine as _, engine::general_purpose::STANDARD};

use crate::features::folder_session::{classify_path, clean_path_str};

/// Resultado de una operación de envío a la papelera de reciclaje.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteMediaResult {
    pub deleted: usize,
    pub errors: Vec<String>,
}

/// Resultado de una operación de renombrado multimedia.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameMediaResult {
    pub old_path: String,
    pub new_path: String,
    pub new_name: String,
}

/// Resultado de guardar una imagen editada.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveImageResult {
    pub saved_path: String,
    pub file_name: String,
    pub overwrite: bool,
}

/// Envía los archivos multimedia indicados a la papelera de reciclaje del sistema.
/// Solo admite música, imágenes y vídeos; cualquier otra ruta se rechaza y se reporta.
#[tauri::command]
pub async fn media_delete_items(paths: Vec<String>) -> Result<DeleteMediaResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut deleted = 0usize;
        let mut errors = Vec::new();
        for raw in paths {
            let clean = clean_path_str(&raw);
            let path = Path::new(&clean);

            let canonical = match path.canonicalize() {
                Ok(canonical) => canonical,
                Err(error) => {
                    errors.push(format!("{clean}: no se pudo abrir el archivo ({error})."));
                    continue;
                }
            };

            if !canonical.is_file() {
                errors.push(format!("{clean}: la ruta no corresponde a un archivo."));
                continue;
            }

            if classify_path(&canonical).is_none() {
                errors.push(format!(
                    "{clean}: el tipo de archivo no es compatible (solo música, imágenes y vídeos)."
                ));
                continue;
            }

            let clean_canonical = clean_path_str(&canonical.to_string_lossy());
            let target_path = Path::new(&clean_canonical);

            match trash::delete(target_path) {
                Ok(()) => deleted += 1,
                Err(error) => errors.push(format!("{clean}: no se pudo enviar a la papelera ({error}).")),
            }
        }

        Ok(DeleteMediaResult { deleted, errors })
    })
    .await
    .map_err(|error| format!("No se pudo completar la eliminación: {error}"))?
}

/// Renombra un archivo multimedia de forma segura.
/// Mantiene o valida la extensión correspondiente y previene colisiones.
#[tauri::command]
pub async fn media_rename_item(path: String, new_name: String) -> Result<RenameMediaResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean = clean_path_str(&path);
        let current_path = Path::new(&clean);

        let canonical = current_path
            .canonicalize()
            .map_err(|e| format!("No se encontró el archivo original: {e}"))?;

        if !canonical.is_file() {
            return Err("La ruta especificada no es un archivo válido.".to_string());
        }

        if classify_path(&canonical).is_none() {
            return Err("Tipo de archivo no compatible para renombrado en Prisma.".to_string());
        }

        let trimmed_name = new_name.trim();
        if trimmed_name.is_empty() {
            return Err("El nuevo nombre no puede estar vacío.".to_string());
        }

        // Caracteres inválidos en nombres de archivo (Windows y POSIX)
        let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
        if trimmed_name.chars().any(|c| invalid_chars.contains(&c) || c.is_control()) {
            return Err("El nombre contiene caracteres no permitidos (< > : \" / \\ | ? *).".to_string());
        }

        let parent_dir = canonical
            .parent()
            .ok_or_else(|| "No se pudo determinar el directorio contenedor.".to_string())?;

        let orig_extension = canonical
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        // Si el nuevo nombre no tiene extensión o el usuario solo ingresó el nombre base,
        // aseguramos que mantenga la extensión original.
        let final_filename = if trimmed_name.contains('.') {
            trimmed_name.to_string()
        } else if !orig_extension.is_empty() {
            format!("{trimmed_name}.{orig_extension}")
        } else {
            trimmed_name.to_string()
        };

        let target_path = parent_dir.join(&final_filename);

        // Si el destino es exactamente el mismo (caso de mayúsculas/minúsculas en el mismo archivo)
        if target_path.exists() {
            let canonical_target = target_path.canonicalize().ok();
            if canonical_target.as_ref() != Some(&canonical) {
                return Err(format!("Ya existe un archivo con el nombre \"{final_filename}\" en esta carpeta."));
            }
        }

        std::fs::rename(&canonical, &target_path)
            .map_err(|e| format!("No se pudo renombrar el archivo: {e}"))?;

        let old_clean = clean_path_str(&canonical.to_string_lossy());
        let new_clean = clean_path_str(&target_path.to_string_lossy());

        Ok(RenameMediaResult {
            old_path: old_clean,
            new_path: new_clean,
            new_name: final_filename,
        })
    })
    .await
    .map_err(|e| format!("Error interno al renombrar: {e}"))?
}

/// Guarda una imagen editada (a partir de datos base64), con soporte para
/// sobreescritura o guardado como copia independiente.
#[tauri::command]
pub async fn media_save_image(
    source_path: String,
    image_base64: String,
    overwrite: bool,
    custom_file_name: Option<String>,
) -> Result<SaveImageResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean = clean_path_str(&source_path);
        let src_path = Path::new(&clean);

        // Limpiar encabezado data:image/...;base64, si viene incluido
        let raw_b64 = if let Some(idx) = image_base64.find(";base64,") {
            &image_base64[idx + 8..]
        } else if let Some(stripped) = image_base64.strip_prefix("data:image/") {
            if let Some(idx) = stripped.find(',') {
                &stripped[idx + 1..]
            } else {
                &image_base64
            }
        } else {
            &image_base64
        };

        let image_bytes = STANDARD
            .decode(raw_b64.trim())
            .map_err(|e| format!("No se pudieron decodificar los datos de la imagen: {e}"))?;

        if image_bytes.is_empty() {
            return Err("La imagen decodificada está vacía.".to_string());
        }

        let parent_dir = src_path
            .parent()
            .ok_or_else(|| "No se pudo obtener el directorio de la imagen.".to_string())?;

        let orig_stem = src_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("imagen");

        let orig_ext = src_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("png");

        let (target_path, final_name) = if overwrite {
            let filename = src_path
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or("imagen.png")
                .to_string();
            (src_path.to_path_buf(), filename)
        } else if let Some(custom) = custom_file_name.filter(|c| !c.trim().is_empty()) {
            let trimmed = custom.trim();
            let name_with_ext = if trimmed.contains('.') {
                trimmed.to_string()
            } else {
                format!("{trimmed}.{orig_ext}")
            };
            let mut candidate = parent_dir.join(&name_with_ext);
            let mut counter = 1;
            let stem = Path::new(&name_with_ext)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("imagen");
            let ext = Path::new(&name_with_ext)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or(orig_ext);

            while candidate.exists() {
                candidate = parent_dir.join(format!("{stem}_{counter}.{ext}"));
                counter += 1;
            }
            let fname = candidate
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or(&name_with_ext)
                .to_string();
            (candidate, fname)
        } else {
            // Guardar copia por defecto: <stem>_editado.<ext>
            let mut candidate = parent_dir.join(format!("{orig_stem}_editado.{orig_ext}"));
            let mut counter = 1;
            while candidate.exists() {
                candidate = parent_dir.join(format!("{orig_stem}_editado_{counter}.{orig_ext}"));
                counter += 1;
            }
            let fname = candidate
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or("imagen_editada.png")
                .to_string();
            (candidate, fname)
        };

        std::fs::write(&target_path, &image_bytes)
            .map_err(|e| format!("Error al escribir el archivo de imagen: {e}"))?;

        let clean_saved = clean_path_str(&target_path.to_string_lossy());

        Ok(SaveImageResult {
            saved_path: clean_saved,
            file_name: final_name,
            overwrite,
        })
    })
    .await
    .map_err(|e| format!("Error al procesar guardado de imagen: {e}"))?
}
