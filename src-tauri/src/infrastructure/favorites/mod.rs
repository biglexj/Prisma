use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};

/// Detección de tipo de medio a partir de la extensión del archivo
pub fn detect_media_type(path: &str) -> &'static str {
    let p = std::path::Path::new(path);
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" | "svg" => "image",
        "mp4" | "mkv" | "avi" | "mov" | "webm" | "flv" | "wmv" | "m4v" => "video",
        _ => "music",
    }
}

/// Almacén de favoritos en memoria + persistencia JSON.
/// Estructura plana: tres listas de rutas absolutas por tipo de medio.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FavoritesStore {
    pub music: Vec<String>,
    pub images: Vec<String>,
    pub videos: Vec<String>,
}

impl FavoritesStore {
    /// Reorganiza elementos mal categorizados por su extensión de archivo y elimina duplicados.
    /// Devuelve true si hubo cambios.
    pub fn sanitize(&mut self) -> bool {
        let mut new_music = Vec::new();
        let mut new_images = Vec::new();
        let mut new_videos = Vec::new();

        let mut changed = false;

        let all_entries = [
            (std::mem::take(&mut self.music), "music"),
            (std::mem::take(&mut self.images), "image"),
            (std::mem::take(&mut self.videos), "video"),
        ];

        for (list, original_type) in all_entries {
            for path in list {
                let detected = detect_media_type(&path);
                if detected != original_type {
                    changed = true;
                }
                match detected {
                    "image" => {
                        if !new_images.contains(&path) {
                            new_images.push(path);
                        }
                    }
                    "video" => {
                        if !new_videos.contains(&path) {
                            new_videos.push(path);
                        }
                    }
                    _ => {
                        if !new_music.contains(&path) {
                            new_music.push(path);
                        }
                    }
                }
            }
        }

        if self.music != new_music || self.images != new_images || self.videos != new_videos {
            changed = true;
        }

        self.music = new_music;
        self.images = new_images;
        self.videos = new_videos;

        changed
    }
}

#[derive(Clone)]
pub struct FavoritesState {
    inner: Arc<Mutex<FavoritesInner>>,
}

struct FavoritesInner {
    store: FavoritesStore,
    file_path: PathBuf,
}

impl FavoritesState {
    /// Carga desde disco o crea un store vacío si no existe el archivo.
    pub fn load(data_directory: PathBuf) -> Result<Self, String> {
        let file_path = data_directory.join("favorites.json");
        let mut store = if file_path.exists() {
            let content = std::fs::read_to_string(&file_path)
                .map_err(|e| format!("No se pudo leer favoritos: {e}"))?;
            serde_json::from_str::<FavoritesStore>(&content)
                .unwrap_or_default()
        } else {
            FavoritesStore::default()
        };

        if store.sanitize() && file_path.exists() {
            if let Ok(json) = serde_json::to_string_pretty(&store) {
                let _ = std::fs::write(&file_path, json);
            }
        }

        Ok(Self {
            inner: Arc::new(Mutex::new(FavoritesInner { store, file_path })),
        })
    }

    /// Devuelve una copia del store completo.
    pub fn get_all(&self) -> Result<FavoritesStore, String> {
        Ok(self.lock()?.store.clone())
    }

    /// Alterna favorito para un ítem. Devuelve `true` si fue añadido, `false` si fue eliminado.
    pub fn toggle(&self, media_type: Option<&str>, path: &str) -> Result<bool, String> {
        let actual_type = match media_type {
            Some(t) if !t.trim().is_empty() => t,
            _ => detect_media_type(path),
        };
        let mut inner = self.lock()?;
        let list = Self::list_for_type(&mut inner.store, actual_type)?;
        let added = if let Some(pos) = list.iter().position(|p| p == path) {
            list.remove(pos);
            false
        } else {
            list.push(path.to_owned());
            true
        };
        Self::persist(&inner)?;
        Ok(added)
    }

    /// Comprueba si un ítem es favorito.
    pub fn is_favorite(&self, media_type: Option<&str>, path: &str) -> Result<bool, String> {
        let inner = self.lock()?;
        let actual_type = match media_type {
            Some(t) if !t.trim().is_empty() => t,
            _ => detect_media_type(path),
        };
        match actual_type {
            "music" => Ok(inner.store.music.iter().any(|p| p == path)),
            "image" => Ok(inner.store.images.iter().any(|p| p == path)),
            "video" => Ok(inner.store.videos.iter().any(|p| p == path)),
            _ => Err(format!("Tipo de medio desconocido: {actual_type}")),
        }
    }

    fn list_for_type<'a>(
        store: &'a mut FavoritesStore,
        media_type: &str,
    ) -> Result<&'a mut Vec<String>, String> {
        match media_type {
            "music" => Ok(&mut store.music),
            "image" => Ok(&mut store.images),
            "video" => Ok(&mut store.videos),
            _ => Err(format!("Tipo de medio desconocido: {media_type}")),
        }
    }

    fn persist(inner: &FavoritesInner) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&inner.store)
            .map_err(|e| format!("No se pudo serializar favoritos: {e}"))?;
        std::fs::write(&inner.file_path, json)
            .map_err(|e| format!("No se pudo guardar favoritos: {e}"))?;
        Ok(())
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, FavoritesInner>, String> {
        self.inner
            .lock()
            .map_err(|_| "El estado de favoritos está bloqueado.".to_owned())
    }
}
