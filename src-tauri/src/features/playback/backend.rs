use super::model::{AudioDeviceItem, DspConfig, PlaybackCapabilities, PlaybackSnapshot};

pub trait PlaybackBackend: Send {
    fn capabilities(&self) -> PlaybackCapabilities;
    fn load(&mut self, path: &str) -> Result<PlaybackSnapshot, String>;
    fn toggle_pause(&mut self) -> Result<PlaybackSnapshot, String>;
    fn pause(&mut self) -> Result<PlaybackSnapshot, String>;
    fn resume(&mut self) -> Result<PlaybackSnapshot, String>;
    fn seek(&mut self, seconds: f64) -> Result<PlaybackSnapshot, String>;
    fn set_volume(&mut self, volume: f64) -> Result<PlaybackSnapshot, String>;
    fn set_speed(&mut self, speed: f64) -> Result<PlaybackSnapshot, String>;
    fn snapshot(&mut self) -> Result<PlaybackSnapshot, String>;
    fn set_dsp_config(&mut self, config: &DspConfig) -> Result<(), String>;
    fn get_audio_devices(&self) -> Result<Vec<AudioDeviceItem>, String>;
    fn set_audio_device(&mut self, device_name: &str) -> Result<(), String>;
}
