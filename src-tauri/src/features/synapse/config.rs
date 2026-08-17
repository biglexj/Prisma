use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};

use super::model::SynapsePlaybackStatus;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SynapseConfigData {
    pub downloads_dir: Option<String>,
    pub beacon_enabled: bool,
    pub server_enabled: bool,
}

impl Default for SynapseConfigData {
    fn default() -> Self {
        Self {
            downloads_dir: None,
            beacon_enabled: true,
            server_enabled: true,
        }
    }
}

#[derive(Clone)]
pub struct SynapseState {
    config_file: PathBuf,
    data: Arc<Mutex<SynapseConfigData>>,
    playback_status: Arc<Mutex<SynapsePlaybackStatus>>,
}

impl SynapseState {
    pub fn load(app_data_dir: PathBuf) -> Self {
        let config_file = app_data_dir.join("synapse-config.json");
        let data = if config_file.exists() {
            std::fs::read(&config_file)
                .ok()
                .and_then(|bytes| serde_json::from_slice(&bytes).ok())
                .unwrap_or_default()
        } else {
            SynapseConfigData::default()
        };

        Self {
            config_file,
            data: Arc::new(Mutex::new(data)),
            playback_status: Arc::new(Mutex::new(SynapsePlaybackStatus::default())),
        }
    }

    pub fn get_playback_status(&self) -> SynapsePlaybackStatus {
        self.playback_status
            .lock()
            .map(|g| g.clone())
            .unwrap_or_default()
    }

    pub fn set_playback_status(&self, status: SynapsePlaybackStatus) {
        if let Ok(mut g) = self.playback_status.lock() {
            *g = status;
        }
    }

    pub fn get_downloads_dir(&self) -> PathBuf {
        if let Ok(guard) = self.data.lock() {
            if let Some(ref custom) = guard.downloads_dir {
                let p = PathBuf::from(custom);
                if p.is_dir() {
                    return p;
                }
            }
        }
        default_prisma_downloads_dir()
    }

    pub fn set_downloads_dir(&self, new_dir: String) -> Result<String, String> {
        let p = PathBuf::from(&new_dir);
        if !p.exists() {
            std::fs::create_dir_all(&p).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
        }
        let mut guard = self.data.lock().map_err(|_| "Estado de Synapse bloqueado".to_string())?;
        guard.downloads_dir = Some(new_dir.clone());
        self.save_locked(&guard)?;
        Ok(new_dir)
    }

    fn save_locked(&self, data: &SynapseConfigData) -> Result<(), String> {
        let json = serde_json::to_vec_pretty(data).map_err(|e| e.to_string())?;
        if let Some(parent) = self.config_file.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(&self.config_file, json).map_err(|e| format!("Error guardando config Synapse: {e}"))?;
        Ok(())
    }
}

pub fn default_prisma_downloads_dir() -> PathBuf {
    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        PathBuf::from(user_profile).join("Downloads").join("Prisma")
    } else if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join("Downloads").join("Prisma")
    } else {
        std::env::temp_dir().join("Prisma").join("Downloads")
    }
}
