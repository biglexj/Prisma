use super::model::{PlaybackCapabilities, PlaybackSnapshot};

pub trait PlaybackBackend: Send {
    fn capabilities(&self) -> PlaybackCapabilities;
    fn load(&mut self, path: &str) -> Result<PlaybackSnapshot, String>;
    fn toggle_pause(&mut self) -> Result<PlaybackSnapshot, String>;
    fn seek(&mut self, seconds: f64) -> Result<PlaybackSnapshot, String>;
    fn set_volume(&mut self, volume: f64) -> Result<PlaybackSnapshot, String>;
    fn set_speed(&mut self, speed: f64) -> Result<PlaybackSnapshot, String>;
    fn snapshot(&mut self) -> Result<PlaybackSnapshot, String>;
}
