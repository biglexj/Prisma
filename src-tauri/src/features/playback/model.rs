use serde::{Deserialize, Serialize};

use crate::features::folder_session::FolderSessionSnapshot;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DspBandConfig {
    pub freq: u32,
    pub gain_db: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DspEffectsConfig {
    pub clarity: f64,
    pub ambience: f64,
    pub surround: f64,
    pub dynamic_boost: f64,
    pub bass_boost: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DspConfig {
    pub enabled: bool,
    pub preamp_db: f64,
    pub bands: Vec<DspBandConfig>,
    pub effects: DspEffectsConfig,
}

impl From<&DspConfig> for crate::infrastructure::media::passthru::dsp_engine::DspParameters {
    fn from(cfg: &DspConfig) -> Self {
        let mut eq_gains = [0.0f32; 10];
        for (i, band) in cfg.bands.iter().enumerate().take(10) {
            eq_gains[i] = band.gain_db as f32;
        }
        Self {
            enabled: cfg.enabled,
            preamp_db: cfg.preamp_db as f32,
            band_gains_db: eq_gains,
            clarity: cfg.effects.clarity as f32,
            ambience: cfg.effects.ambience as f32,
            surround: cfg.effects.surround as f32,
            dynamic_boost: cfg.effects.dynamic_boost as f32,
            bass_boost: cfg.effects.bass_boost as f32,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceItem {
    pub name: String,
    pub description: String,
    pub is_active: bool,
}

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
    pub eof_reached: Option<bool>,
    pub track_title: Option<String>,
    pub track_artist: Option<String>,
    pub track_album: Option<String>,
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
