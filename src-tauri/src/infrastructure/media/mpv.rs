use libmpv2::Mpv;

use crate::features::playback::{
    backend::PlaybackBackend,
    model::{PlaybackCapabilities, PlaybackSnapshot, clamp_volume},
};

pub struct MpvBackend {
    mpv: Mpv,
    path: Option<String>,
}

impl MpvBackend {
    pub fn new() -> Result<Self, String> {
        let mpv = Mpv::with_initializer(|initializer| {
            initializer.set_property("vo", "auto")?;
            initializer.set_property("audio-display", "no")?;
            initializer.set_property("keep-open", "yes")?;
            Ok(())
        })
        .map_err(debug_error)?;

        mpv.set_property("volume", 70.0).map_err(debug_error)?;

        Ok(Self { mpv, path: None })
    }

    fn read_snapshot(&self) -> PlaybackSnapshot {
        PlaybackSnapshot {
            path: self.path.clone(),
            paused: self.mpv.get_property("pause").unwrap_or(true),
            position_seconds: self.mpv.get_property("time-pos").ok(),
            duration_seconds: self.mpv.get_property("duration").ok(),
            volume: self.mpv.get_property("volume").unwrap_or(70.0),
            speed: self.mpv.get_property("speed").unwrap_or(1.0),
            session: None,
        }
    }
}

impl PlaybackBackend for MpvBackend {
    fn capabilities(&self) -> PlaybackCapabilities {
        PlaybackCapabilities {
            backend: "libmpv".to_owned(),
            available: true,
            audio: true,
            video_output: true,
            reason: None,
        }
    }

    fn load(&mut self, path: &str) -> Result<PlaybackSnapshot, String> {
        self.mpv
            .command("loadfile", &[path, "replace"])
            .map_err(debug_error)?;
        self.path = Some(path.to_owned());
        Ok(self.read_snapshot())
    }

    fn toggle_pause(&mut self) -> Result<PlaybackSnapshot, String> {
        let paused = self.mpv.get_property::<bool>("pause").unwrap_or(false);
        self.mpv
            .set_property("pause", !paused)
            .map_err(debug_error)?;
        Ok(self.read_snapshot())
    }

    fn seek(&mut self, seconds: f64) -> Result<PlaybackSnapshot, String> {
        self.mpv
            .set_property("time-pos", seconds.max(0.0))
            .map_err(debug_error)?;
        Ok(self.read_snapshot())
    }

    fn set_volume(&mut self, volume: f64) -> Result<PlaybackSnapshot, String> {
        self.mpv
            .set_property("volume", clamp_volume(volume))
            .map_err(debug_error)?;
        Ok(self.read_snapshot())
    }

    fn set_speed(&mut self, speed: f64) -> Result<PlaybackSnapshot, String> {
        self.mpv
            .set_property("speed", speed.clamp(0.25, 4.0))
            .map_err(debug_error)?;
        Ok(self.read_snapshot())
    }

    fn snapshot(&mut self) -> Result<PlaybackSnapshot, String> {
        Ok(self.read_snapshot())
    }
}

fn debug_error(error: impl std::fmt::Debug) -> String {
    format!("Error de libmpv: {error:?}")
}
