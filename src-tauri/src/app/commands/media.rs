use std::path::Path;

use crate::features::folder_session::{classify_path, clean_path_str};

/// Resultado de una operación de envío a la papelera de reciclaje.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteMediaResult {
    pub deleted: usize,
    pub errors: Vec<String>,
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

            match trash::delete(&canonical) {
                Ok(()) => deleted += 1,
                Err(error) => errors.push(format!("{clean}: no se pudo enviar a la papelera ({error}).")),
            }
        }

        Ok(DeleteMediaResult { deleted, errors })
    })
    .await
    .map_err(|error| format!("No se pudo completar la eliminación: {error}"))?
}
