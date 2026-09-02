use std::sync::Mutex;

mod favorites;
mod music_library;
mod visual_library;

pub use favorites::FavoritesState;
pub use music_library::MusicLibraryState;
pub use visual_library::VisualLibraryState;

use crate::{
    features::{
        folder_session::{FolderSession, build_folder_session},
        playback::{
            backend::PlaybackBackend,
            model::{PlaybackCapabilities, PlaybackSnapshot},
        },
    },
    infrastructure::media::create_playback_backend,
};

pub struct InitialFileState(pub Mutex<Option<String>>);

pub struct PlaybackProbeState {
    runtime: Mutex<PlaybackRuntime>,
}

struct PlaybackRuntime {
    backend: Box<dyn PlaybackBackend>,
    session: Option<FolderSession>,
}

impl PlaybackProbeState {
    pub fn new() -> Self {
        Self {
            runtime: Mutex::new(PlaybackRuntime {
                backend: create_playback_backend(),
                session: None,
            }),
        }
    }

    pub fn capabilities(&self) -> PlaybackCapabilities {
        match self.runtime.lock() {
            Ok(runtime) => runtime.backend.capabilities(),
            Err(_) => {
                PlaybackCapabilities::unavailable("El estado de reproducción está bloqueado.")
            }
        }
    }

    pub fn load(&self, path: &str) -> Result<PlaybackSnapshot, String> {
        let session = build_folder_session(path.as_ref()).ok();
        let mut runtime = self.lock_runtime()?;
        let snapshot = runtime.backend.load(path)?;
        runtime.session = session;
        Ok(attach_session(snapshot, runtime.session.as_ref()))
    }

    pub fn next(&self) -> Result<PlaybackSnapshot, String> {
        self.navigate(NavigationDirection::Next)
    }

    pub fn previous(&self) -> Result<PlaybackSnapshot, String> {
        self.navigate(NavigationDirection::Previous)
    }

    pub fn pause(&self) -> Result<PlaybackSnapshot, String> {
        self.with_backend(|backend| backend.pause())
    }

    pub fn resume(&self) -> Result<PlaybackSnapshot, String> {
        self.with_backend(|backend| backend.resume())
    }

    pub fn set_dsp_config(&self, config: &crate::features::playback::model::DspConfig) -> Result<(), String> {
        let mut runtime = self.lock_runtime()?;
        runtime.backend.set_dsp_config(config)
    }

    pub fn get_audio_devices(&self) -> Result<Vec<crate::features::playback::model::AudioDeviceItem>, String> {
        let runtime = self.lock_runtime()?;
        runtime.backend.get_audio_devices()
    }

    pub fn set_audio_device(&self, device_name: &str) -> Result<(), String> {
        let mut runtime = self.lock_runtime()?;
        runtime.backend.set_audio_device(device_name)
    }

    pub fn with_backend(
        &self,
        operation: impl FnOnce(&mut dyn PlaybackBackend) -> Result<PlaybackSnapshot, String>,
    ) -> Result<PlaybackSnapshot, String> {
        let mut runtime = self.lock_runtime()?;
        let snapshot = operation(runtime.backend.as_mut())?;
        Ok(attach_session(snapshot, runtime.session.as_ref()))
    }

    fn navigate(&self, direction: NavigationDirection) -> Result<PlaybackSnapshot, String> {
        let mut runtime = self.lock_runtime()?;
        let (target_index, target_path) = {
            let session = runtime
                .session
                .as_ref()
                .ok_or_else(|| "No existe una sesión de carpeta activa.".to_owned())?;
            let target_index = match direction {
                NavigationDirection::Next => session.next_index(),
                NavigationDirection::Previous => session.previous_index(),
            }
            .ok_or_else(|| "No hay otro archivo en esa dirección.".to_owned())?;
            let target_path = session
                .path_at(target_index)
                .ok_or_else(|| "El archivo de destino ya no pertenece a la sesión.".to_owned())?
                .to_string_lossy()
                .into_owned();
            (target_index, target_path)
        };

        let snapshot = runtime.backend.load(&target_path)?;
        if let Some(session) = runtime.session.as_mut() {
            session.select(target_index)?;
        }
        Ok(attach_session(snapshot, runtime.session.as_ref()))
    }

    fn lock_runtime(&self) -> Result<std::sync::MutexGuard<'_, PlaybackRuntime>, String> {
        self.runtime
            .lock()
            .map_err(|_| "El estado de reproducción está bloqueado.".to_owned())
    }
}

fn attach_session(
    mut snapshot: PlaybackSnapshot,
    session: Option<&FolderSession>,
) -> PlaybackSnapshot {
    snapshot.session = session.map(FolderSession::snapshot);
    snapshot
}

enum NavigationDirection {
    Next,
    Previous,
}
