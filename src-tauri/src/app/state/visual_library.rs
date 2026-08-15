use std::{
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

use crate::{
    features::visual_library::{VisualFolderSource, VisualMediaKind},
    infrastructure::folder_sources::JsonVisualFolderSourceStore,
};

#[derive(Clone)]
pub struct VisualLibraryState {
    runtime: Arc<VisualLibraryRuntime>,
}

struct VisualLibraryRuntime {
    sources: Mutex<Vec<VisualFolderSource>>,
    excluded_sources: Mutex<Vec<VisualFolderSource>>,
    store: JsonVisualFolderSourceStore,
}

impl VisualLibraryState {
    pub fn load(data_directory: PathBuf) -> Result<Self, String> {
        let store = JsonVisualFolderSourceStore::new(data_directory.join("visual-folders.json"));
        let (sources, excluded_sources) = store.load()?;
        Ok(Self {
            runtime: Arc::new(VisualLibraryRuntime {
                sources: Mutex::new(sources),
                excluded_sources: Mutex::new(excluded_sources),
                store,
            }),
        })
    }

    pub fn list(&self, kind: VisualMediaKind) -> Result<Vec<VisualFolderSource>, String> {
        let mut sources: Vec<_> = self
            .lock_sources()?
            .iter()
            .filter(|source| source.kind == kind)
            .cloned()
            .collect();
        for source in &mut sources {
            source.available = Path::new(&source.path).is_dir();
        }
        sources.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
        Ok(sources)
    }

    pub fn list_excluded(&self, kind: VisualMediaKind) -> Result<Vec<VisualFolderSource>, String> {
        let mut sources: Vec<_> = self
            .lock_excluded()?
            .iter()
            .filter(|source| source.kind == kind)
            .cloned()
            .collect();
        for source in &mut sources {
            source.available = Path::new(&source.path).is_dir();
        }
        sources.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
        Ok(sources)
    }

    pub fn paths(&self, kind: VisualMediaKind) -> Result<Vec<String>, String> {
        Ok(self
            .lock_sources()?
            .iter()
            .filter(|source| source.kind == kind)
            .map(|source| source.path.clone())
            .collect())
    }

    pub fn excluded_paths(&self, kind: VisualMediaKind) -> Result<Vec<String>, String> {
        Ok(self
            .lock_excluded()?
            .iter()
            .filter(|source| source.kind == kind)
            .map(|source| source.path.clone())
            .collect())
    }

    pub fn upsert(&self, source: VisualFolderSource) -> Result<VisualFolderSource, String> {
        let mut next = self.lock_sources()?.clone();
        if let Some(existing) = next
            .iter_mut()
            .find(|existing| existing.path == source.path && existing.kind == source.kind)
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

    pub fn upsert_excluded(&self, source: VisualFolderSource) -> Result<VisualFolderSource, String> {
        let mut next = self.lock_excluded()?.clone();
        if let Some(existing) = next
            .iter_mut()
            .find(|existing| existing.path == source.path && existing.kind == source.kind)
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

    pub fn remove(
        &self,
        path: &str,
        kind: VisualMediaKind,
    ) -> Result<Vec<VisualFolderSource>, String> {
        let current = self.lock_sources()?.clone();
        let next: Vec<_> = current
            .iter()
            .filter(|source| source.path != path || source.kind != kind)
            .cloned()
            .collect();
        if next.len() == current.len() {
            return Err("La carpeta visual indicada no está registrada.".to_owned());
        }
        let excluded = self.lock_excluded()?.clone();
        self.runtime.store.save(&next, &excluded)?;
        *self.lock_sources()? = next;
        self.list(kind)
    }

    pub fn remove_excluded(
        &self,
        path: &str,
        kind: VisualMediaKind,
    ) -> Result<Vec<VisualFolderSource>, String> {
        let current = self.lock_excluded()?.clone();
        let next: Vec<_> = current
            .iter()
            .filter(|source| source.path != path || source.kind != kind)
            .cloned()
            .collect();
        if next.len() == current.len() {
            return Err("La carpeta visual excluida indicada no está registrada.".to_owned());
        }
        let sources = self.lock_sources()?.clone();
        self.runtime.store.save(&sources, &next)?;
        *self.lock_excluded()? = next;
        self.list_excluded(kind)
    }

    fn lock_sources(&self) -> Result<std::sync::MutexGuard<'_, Vec<VisualFolderSource>>, String> {
        self.runtime
            .sources
            .lock()
            .map_err(|_| "El registro de carpetas visuales está bloqueado.".to_owned())
    }

    fn lock_excluded(&self) -> Result<std::sync::MutexGuard<'_, Vec<VisualFolderSource>>, String> {
        self.runtime
            .excluded_sources
            .lock()
            .map_err(|_| "El registro de carpetas visuales excluidas está bloqueado.".to_owned())
    }
}
