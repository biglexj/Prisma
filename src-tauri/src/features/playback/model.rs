use serde::Serialize;

use crate::features::folder_session::FolderSessionSnapshot;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackCapabilities {
    pub backend: String,
    pub available: bool,
    pub audio: bool,
    pub video_output: bool,
    pub reason: Option<String>,
}

impl PlaybackCapabilities {
    pub fn unavailable(reason: impl Into<String>) -> Self {
        Self {
            backend: "Backend no disponible".to_owned(),
            available: false,
            audio: false,
            video_output: false,
            reason: Some(reason.into()),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSnapshot {
    pub path: Option<String>,
    pub paused: bool,
    pub position_seconds: Option<f64>,
    pub duration_seconds: Option<f64>,
    pub volume: f64,
    pub speed: f64,
    pub session: Option<FolderSessionSnapshot>,
}

pub fn clamp_volume(volume: f64) -> f64 {
    volume.clamp(0.0, 100.0)
}

#[cfg(test)]
mod tests {
    use super::clamp_volume;

    #[test]
    fn volume_stays_inside_the_public_contract() {
        assert_eq!(clamp_volume(-1.0), 0.0);
        assert_eq!(clamp_volume(42.0), 42.0);
        assert_eq!(clamp_volume(120.0), 100.0);
    }
}
