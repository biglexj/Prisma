use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, MutexGuard},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TakeStatus {
    GoodTake,
    Reject,
    BRoll,
    Pending,
}

impl Default for TakeStatus {
    fn default() -> Self {
        Self::Pending
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ClipColor {
    Orange,
    Apricot,
    Yellow,
    Lime,
    Olive,
    Green,
    Teal,
    Cyan,
    Blue,
    Purple,
    Violet,
    Pink,
    Tan,
    Beige,
    Brown,
    Chocolate,
    None,
}

impl Default for ClipColor {
    fn default() -> Self {
        Self::None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VideoTakeMarker {
    pub path: String,
    pub status: TakeStatus,
    pub clip_color: ClipColor,
    pub rating: Option<u8>,
    pub note: Option<String>,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VideoTakesStore {
    #[serde(default)]
    pub markers: HashMap<String, VideoTakeMarker>,
}

fn normalize_key(path: &str) -> String {
    path.replace('/', "\\").to_lowercase()
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[derive(Clone)]
pub struct VideoTakesState {
    inner: Arc<Mutex<VideoTakesInner>>,
}

struct VideoTakesInner {
    store: VideoTakesStore,
    file_path: PathBuf,
}

impl VideoTakesState {
    pub fn load(data_directory: PathBuf) -> Result<Self, String> {
        let file_path = data_directory.join("video_takes.json");
        let store = if file_path.exists() {
            let content = std::fs::read_to_string(&file_path)
                .map_err(|e| format!("No se pudo leer marcadores de vídeo: {e}"))?;
            serde_json::from_str::<VideoTakesStore>(&content)
                .unwrap_or_default()
        } else {
            VideoTakesStore::default()
        };

        Ok(Self {
            inner: Arc::new(Mutex::new(VideoTakesInner { store, file_path })),
        })
    }

    fn lock(&self) -> Result<MutexGuard<'_, VideoTakesInner>, String> {
        self.inner
            .lock()
            .map_err(|_| "No se pudo sincronizar el estado de marcadores de vídeo".to_string())
    }

    fn persist(inner: &VideoTakesInner) -> Result<(), String> {
        if let Some(parent) = inner.file_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let serialized = serde_json::to_string_pretty(&inner.store)
            .map_err(|e| format!("No se pudo serializar marcadores de vídeo: {e}"))?;
        std::fs::write(&inner.file_path, serialized)
            .map_err(|e| format!("No se pudo guardar marcadores de vídeo: {e}"))?;
        Ok(())
    }

    pub fn get_marker(&self, path: &str) -> Result<Option<VideoTakeMarker>, String> {
        let inner = self.lock()?;
        let key = normalize_key(path);
        Ok(inner.store.markers.get(&key).cloned())
    }

    pub fn set_marker(
        &self,
        path: &str,
        status: TakeStatus,
        clip_color: Option<ClipColor>,
        rating: Option<u8>,
        note: Option<String>,
    ) -> Result<VideoTakeMarker, String> {
        let mut inner = self.lock()?;
        let key = normalize_key(path);
        let now = current_timestamp();

        let marker = VideoTakeMarker {
            path: path.to_string(),
            status,
            clip_color: clip_color.unwrap_or_default(),
            rating,
            note,
            updated_at: now,
        };

        if status == TakeStatus::Pending && marker.clip_color == ClipColor::None && marker.rating.is_none() && marker.note.is_none() {
            inner.store.markers.remove(&key);
        } else {
            inner.store.markers.insert(key, marker.clone());
        }

        Self::persist(&inner)?;
        Ok(marker)
    }

    pub fn list_all(&self) -> Result<HashMap<String, VideoTakeMarker>, String> {
        let inner = self.lock()?;
        Ok(inner.store.markers.clone())
    }

    pub fn delete_marker(&self, path: &str) -> Result<bool, String> {
        let mut inner = self.lock()?;
        let key = normalize_key(path);
        let removed = inner.store.markers.remove(&key).is_some();
        if removed {
            Self::persist(&inner)?;
        }
        Ok(removed)
    }

    #[allow(dead_code)]
    pub fn clean_missing(&self) -> Result<usize, String> {
        let mut inner = self.lock()?;
        let initial_count = inner.store.markers.len();
        inner.store.markers.retain(|_, marker| Path::new(&marker.path).exists());
        let removed = initial_count - inner.store.markers.len();
        if removed > 0 {
            Self::persist(&inner)?;
        }
        Ok(removed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_video_takes_crud_and_persistence() {
        let temp_dir = std::env::temp_dir().join(format!("prisma_test_takes_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&temp_dir);

        let state = VideoTakesState::load(temp_dir.clone()).expect("Failed to init VideoTakesState");
        let video_path = "D:/Media/ProjectX/A001_C001_0928_001.MOV";

        // 1. Initial should be None
        assert_eq!(state.get_marker(video_path).unwrap(), None);

        // 2. Set Good Take with Lime color
        let marker = state
            .set_marker(
                video_path,
                TakeStatus::GoodTake,
                Some(ClipColor::Lime),
                Some(5),
                Some("Toma perfecta con buen enfoque".to_string()),
            )
            .expect("Failed to set marker");

        assert_eq!(marker.status, TakeStatus::GoodTake);
        assert_eq!(marker.clip_color, ClipColor::Lime);
        assert_eq!(marker.rating, Some(5));

        // 3. Retrieval with Windows backslash path should find the same marker
        let win_path = "d:\\media\\projectx\\a001_c001_0928_001.mov";
        let fetched = state.get_marker(win_path).unwrap().expect("Marker should exist");
        assert_eq!(fetched.status, TakeStatus::GoodTake);
        assert_eq!(fetched.clip_color, ClipColor::Lime);

        // 4. Reload from disk to verify persistence
        let reloaded_state = VideoTakesState::load(temp_dir.clone()).expect("Failed to reload state");
        let reloaded_marker = reloaded_state.get_marker(video_path).unwrap().expect("Persisted marker missing");
        assert_eq!(reloaded_marker.status, TakeStatus::GoodTake);

        // 5. Change to Reject
        state
            .set_marker(video_path, TakeStatus::Reject, Some(ClipColor::Chocolate), None, None)
            .unwrap();
        let updated = state.get_marker(video_path).unwrap().unwrap();
        assert_eq!(updated.status, TakeStatus::Reject);
        assert_eq!(updated.clip_color, ClipColor::Chocolate);

        // 6. Delete marker
        assert!(state.delete_marker(video_path).unwrap());
        assert_eq!(state.get_marker(video_path).unwrap(), None);

        let _ = std::fs::remove_dir_all(temp_dir);
    }
}

