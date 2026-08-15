use std::sync::Mutex;

mod music_library;
mod visual_library;

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
        let session = build_folder_session(path.as_ref())?;
        let mut runtime = self.lock_runtime()?;
        let snapshot = runtime.backend.load(path)?;
        runtime.session = Some(session);
        Ok(attach_session(snapshot, runtime.session.as_ref()))
    }

    pub fn next(&self) -> Result<PlaybackSnapshot, String> {
        self.navigate(NavigationDirection::Next)
    }

    pub fn previous(&self) -> Result<PlaybackSnapshot, String> {
        self.navigate(NavigationDirection::Previous)
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
