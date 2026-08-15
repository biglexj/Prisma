use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};

use crate::features::music_library::MusicFolderSource;

const DOCUMENT_VERSION: u8 = 1;

pub struct JsonFolderSourceStore {
    path: PathBuf,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderSourceDocument {
    version: u8,
    sources: Vec<MusicFolderSource>,
    #[serde(default)]
    excluded_sources: Vec<MusicFolderSource>,
}

impl JsonFolderSourceStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn load(&self) -> Result<(Vec<MusicFolderSource>, Vec<MusicFolderSource>), String> {
        if !self.path.exists() {
            return Ok((Vec::new(), Vec::new()));
        }

        let content = fs::read_to_string(&self.path)
            .map_err(|error| format!("No se pudo leer el registro de carpetas: {error}"))?;
        let document: FolderSourceDocument = serde_json::from_str(&content)
            .map_err(|error| format!("El registro de carpetas no es válido: {error}"))?;

        if document.version != DOCUMENT_VERSION {
            return Err(format!(
                "La versión {} del registro de carpetas no es compatible.",
                document.version
            ));
        }

        Ok((document.sources, document.excluded_sources))
    }

    pub fn save(
        &self,
        sources: &[MusicFolderSource],
        excluded_sources: &[MusicFolderSource],
    ) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("No se pudo preparar el registro de carpetas: {error}"))?;
        }

        let document = FolderSourceDocument {
            version: DOCUMENT_VERSION,
            sources: sources.to_vec(),
            excluded_sources: excluded_sources.to_vec(),
        };
        let content = serde_json::to_string_pretty(&document)
            .map_err(|error| format!("No se pudo preparar el registro de carpetas: {error}"))?;
        fs::write(&self.path, content)
            .map_err(|error| format!("No se pudo guardar el registro de carpetas: {error}"))
    }
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::features::music_library::MusicFolderSource;

    use super::JsonFolderSourceStore;

    #[test]
    fn preserves_registered_sources_in_a_versioned_document() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("prisma-folder-store-{nonce}"));
        let store = JsonFolderSourceStore::new(root.join("music-folders.json"));
        let source = MusicFolderSource {
            path: "D:\\Música".to_owned(),
            name: "Música".to_owned(),
            track_count: 24,
            available: true,
        };

        store.save(std::slice::from_ref(&source), &[]).unwrap();
        let (restored_sources, restored_excluded) = store.load().unwrap();

        assert_eq!(restored_sources, vec![source]);
        assert!(restored_excluded.is_empty());
        std::fs::remove_dir_all(root).unwrap();
    }
}
