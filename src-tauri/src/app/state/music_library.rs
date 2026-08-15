use std::{
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

use crate::{
    features::music_library::MusicFolderSource,
    infrastructure::folder_sources::JsonFolderSourceStore,
};

#[derive(Clone)]
pub struct MusicLibraryState {
    runtime: Arc<MusicLibraryRuntime>,
}

struct MusicLibraryRuntime {
    sources: Mutex<Vec<MusicFolderSource>>,
    excluded_sources: Mutex<Vec<MusicFolderSource>>,
    store: JsonFolderSourceStore,
}

impl MusicLibraryState {
    pub fn load(data_directory: PathBuf) -> Result<Self, String> {
        let store = JsonFolderSourceStore::new(data_directory.join("music-folders.json"));
        let (sources, excluded_sources) = store.load()?;

        Ok(Self {
            runtime: Arc::new(MusicLibraryRuntime {
                sources: Mutex::new(sources),
                excluded_sources: Mutex::new(excluded_sources),
                store,
            }),
        })
    }

    pub fn list(&self) -> Result<Vec<MusicFolderSource>, String> {
        let mut sources = self.lock_sources()?.clone();
        for source in &mut sources {
            source.available = Path::new(&source.path).is_dir();
        }
        sources.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
        Ok(sources)
    }

    pub fn list_excluded(&self) -> Result<Vec<MusicFolderSource>, String> {
        let mut sources = self.lock_excluded()?.clone();
        for source in &mut sources {
            source.available = Path::new(&source.path).is_dir();
        }
        sources.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
        Ok(sources)
    }

    pub fn paths(&self) -> Result<Vec<String>, String> {
        Ok(self
            .lock_sources()?
            .iter()
            .map(|source| source.path.clone())
            .collect())
    }

    pub fn excluded_paths(&self) -> Result<Vec<String>, String> {
        Ok(self
            .lock_excluded()?
            .iter()
            .map(|source| source.path.clone())
            .collect())
    }

    pub fn upsert(&self, source: MusicFolderSource) -> Result<MusicFolderSource, String> {
        let mut next = self.lock_sources()?.clone();
        if let Some(existing) = next
            .iter_mut()
            .find(|existing| existing.path == source.path)
        {
            *existing = source.clone();
        } else {
            next.push(source.clone());
        }
        let excluded = self.lock_excluded()?.clone();
        self.runtime.store.save(&next, &excluded)?;
        *self.lock_sources()? = next;
        Ok(source)
    }

    pub fn upsert_excluded(&self, source: MusicFolderSource) -> Result<MusicFolderSource, String> {
        let mut next = self.lock_excluded()?.clone();
        if let Some(existing) = next
            .iter_mut()
            .find(|existing| existing.path == source.path)
        {
            *existing = source.clone();
        } else {
            next.push(source.clone());
        }
        let sources = self.lock_sources()?.clone();
        self.runtime.store.save(&sources, &next)?;
        *self.lock_excluded()? = next;
        Ok(source)
    }

    pub fn remove(&self, path: &str) -> Result<Vec<MusicFolderSource>, String> {
        let current = self.lock_sources()?.clone();
        let next: Vec<_> = current
            .iter()
            .filter(|source| source.path != path)
            .cloned()
            .collect();

        if next.len() == current.len() {
            return Err("La carpeta indicada no está registrada.".to_owned());
        }

        let excluded = self.lock_excluded()?.clone();
        self.runtime.store.save(&next, &excluded)?;
        *self.lock_sources()? = next;
        self.list()
    }

    pub fn remove_excluded(&self, path: &str) -> Result<Vec<MusicFolderSource>, String> {
        let current = self.lock_excluded()?.clone();
        let next: Vec<_> = current
            .iter()
            .filter(|source| source.path != path)
            .cloned()
            .collect();

        if next.len() == current.len() {
            return Err("La carpeta excluida indicada no está registrada.".to_owned());
        }

        let sources = self.lock_sources()?.clone();
        self.runtime.store.save(&sources, &next)?;
        *self.lock_excluded()? = next;
        self.list_excluded()
    }

    fn lock_sources(&self) -> Result<std::sync::MutexGuard<'_, Vec<MusicFolderSource>>, String> {
        self.runtime
            .sources
            .lock()
            .map_err(|_| "El registro de carpetas está bloqueado.".to_owned())
    }

    fn lock_excluded(&self) -> Result<std::sync::MutexGuard<'_, Vec<MusicFolderSource>>, String> {
        self.runtime
            .excluded_sources
            .lock()
            .map_err(|_| "El registro de carpetas excluidas está bloqueado.".to_owned())
    }
}
