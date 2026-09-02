use crate::features::playback::{
    backend::PlaybackBackend,
    model::{PlaybackCapabilities, PlaybackSnapshot},
};

pub struct UnavailableBackend {
    reason: String,
}

impl UnavailableBackend {
    pub fn new(reason: impl Into<String>) -> Self {
        Self {
            reason: reason.into(),
        }
    }

    fn error(&self) -> Result<PlaybackSnapshot, String> {
        Err(self.reason.clone())
    }
}

impl PlaybackBackend for UnavailableBackend {
    fn capabilities(&self) -> PlaybackCapabilities {
        PlaybackCapabilities::unavailable(&self.reason)
    }

    fn load(&mut self, _path: &str) -> Result<PlaybackSnapshot, String> {
        self.error()
    }

    fn toggle_pause(&mut self) -> Result<PlaybackSnapshot, String> {
        self.error()
    }

    fn pause(&mut self) -> Result<PlaybackSnapshot, String> {
        self.error()
    }

    fn resume(&mut self) -> Result<PlaybackSnapshot, String> {
        self.error()
    }

    fn seek(&mut self, _seconds: f64) -> Result<PlaybackSnapshot, String> {
        self.error()
    }

    fn set_volume(&mut self, _volume: f64) -> Result<PlaybackSnapshot, String> {
        self.error()
    }

    fn set_speed(&mut self, _speed: f64) -> Result<PlaybackSnapshot, String> {
        self.error()
    }

    fn snapshot(&mut self) -> Result<PlaybackSnapshot, String> {
        self.error()
    }

    fn set_dsp_config(&mut self, _config: &crate::features::playback::model::DspConfig) -> Result<(), String> {
        Err(self.reason.clone())
    }

    fn get_audio_devices(&self) -> Result<Vec<crate::features::playback::model::AudioDeviceItem>, String> {
        Ok(vec![crate::features::playback::model::AudioDeviceItem {
            name: "auto".to_string(),
            description: "Predeterminado del sistema".to_string(),
            is_active: true,
        }])
    }

    fn set_audio_device(&mut self, _device_name: &str) -> Result<(), String> {
        Err(self.reason.clone())
    }
}
