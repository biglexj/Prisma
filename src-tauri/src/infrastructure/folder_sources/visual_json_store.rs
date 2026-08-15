use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};

use crate::features::visual_library::VisualFolderSource;

const DOCUMENT_VERSION: u8 = 1;

pub struct JsonVisualFolderSourceStore {
    path: PathBuf,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct VisualFolderSourceDocument {
    version: u8,
    sources: Vec<VisualFolderSource>,
    #[serde(default)]
    excluded_sources: Vec<VisualFolderSource>,
}

impl JsonVisualFolderSourceStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn load(&self) -> Result<(Vec<VisualFolderSource>, Vec<VisualFolderSource>), String> {
        if !self.path.exists() {
            return Ok((Vec::new(), Vec::new()));
        }
        let content = fs::read_to_string(&self.path)
            .map_err(|error| format!("No se pudo leer el registro visual: {error}"))?;
        let document: VisualFolderSourceDocument = serde_json::from_str(&content)
            .map_err(|error| format!("El registro visual no es válido: {error}"))?;
        if document.version != DOCUMENT_VERSION {
            return Err(format!(
                "La versión {} del registro visual no es compatible.",
                document.version
            ));
        }
        let sources = document
            .sources
            .into_iter()
            .map(|mut s| {
                s.path = crate::features::folder_session::clean_path_str(&s.path);
                s
            })
            .collect();
        let excluded_sources = document
            .excluded_sources
            .into_iter()
            .map(|mut s| {
                s.path = crate::features::folder_session::clean_path_str(&s.path);
                s
            })
            .collect();

        Ok((sources, excluded_sources))
    }

    pub fn save(
        &self,
        sources: &[VisualFolderSource],
        excluded_sources: &[VisualFolderSource],
    ) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("No se pudo preparar el registro visual: {error}"))?;
        }
        let content = serde_json::to_string_pretty(&VisualFolderSourceDocument {
            version: DOCUMENT_VERSION,
            sources: sources.to_vec(),
            excluded_sources: excluded_sources.to_vec(),
        })
        .map_err(|error| format!("No se pudo preparar el registro visual: {error}"))?;
        fs::write(&self.path, content)
            .map_err(|error| format!("No se pudo guardar el registro visual: {error}"))
    }
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::features::visual_library::{VisualFolderSource, VisualMediaKind};

    use super::JsonVisualFolderSourceStore;

    #[test]
    fn keeps_each_visual_source_kind() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("prisma-visual-store-{nonce}"));
        let store = JsonVisualFolderSourceStore::new(root.join("visual-folders.json"));
        let source = VisualFolderSource {
            path: "D:\\Fotos".to_owned(),
            name: "Fotos".to_owned(),
            kind: VisualMediaKind::Image,
            item_count: 42,
            available: true,
        };

        store.save(std::slice::from_ref(&source), &[]).unwrap();
        let (restored_sources, restored_excluded) = store.load().unwrap();
        assert_eq!(restored_sources, vec![source]);
        assert!(restored_excluded.is_empty());

        std::fs::remove_dir_all(root).unwrap();
    }
}
