mod builder;
mod classifier;
mod natural_sort;

pub use builder::build_folder_session;
pub use classifier::classify_path;
pub use natural_sort::compare_naturally;

use std::path::{Path, PathBuf};

pub fn clean_path(path: &Path) -> String {
    clean_path_str(&path.to_string_lossy())
}

pub fn clean_path_str(path_str: &str) -> String {
    if let Some(stripped) = path_str.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{stripped}")
    } else if let Some(stripped) = path_str.strip_prefix(r"\\?\") {
        stripped.to_owned()
    } else {
        path_str.to_owned()
    }
}

pub fn is_path_excluded(path: &Path, excluded_paths: &[String]) -> bool {
    if excluded_paths.is_empty() {
        return false;
    }
    let canonical_target = path.canonicalize().ok().unwrap_or_else(|| path.to_path_buf());
    let target_str = canonical_target.to_string_lossy();
    let norm_target = target_str.replace('/', "\\").to_lowercase();

    for excluded in excluded_paths {
        let ex_path = Path::new(excluded);
        let canonical_ex = ex_path.canonicalize().ok().unwrap_or_else(|| ex_path.to_path_buf());
        let ex_str = canonical_ex.to_string_lossy();
        let norm_ex = ex_str.replace('/', "\\").to_lowercase();

        let prefix_with_slash = format!("{}\\", norm_ex.trim_end_matches('\\'));
        if norm_target == norm_ex || norm_target.starts_with(&prefix_with_slash) {
            return true;
        }
    }
    false
}

use serde::Serialize;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaFamily {
    Audio,
    Image,
    Video,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FolderSession {
    family: MediaFamily,
    items: Vec<PathBuf>,
    current_index: usize,
}

impl FolderSession {
    pub fn new(
        family: MediaFamily,
        items: Vec<PathBuf>,
        current_index: usize,
    ) -> Result<Self, String> {
        if items.is_empty() {
            return Err("La sesión de carpeta no contiene archivos compatibles.".to_owned());
        }
        if current_index >= items.len() {
            return Err("El índice actual está fuera de la sesión de carpeta.".to_owned());
        }

        Ok(Self {
            family,
            items,
            current_index,
        })
    }

    pub fn current_path(&self) -> &Path {
        &self.items[self.current_index]
    }

    pub fn next_index(&self) -> Option<usize> {
        (self.current_index + 1 < self.items.len()).then_some(self.current_index + 1)
    }

    pub fn previous_index(&self) -> Option<usize> {
        self.current_index.checked_sub(1)
    }

    pub fn path_at(&self, index: usize) -> Option<&Path> {
        self.items.get(index).map(PathBuf::as_path)
    }

    pub fn select(&mut self, index: usize) -> Result<(), String> {
        if index >= self.items.len() {
            return Err("No existe ese archivo dentro de la sesión.".to_owned());
        }
        self.current_index = index;
        Ok(())
    }

    pub fn snapshot(&self) -> FolderSessionSnapshot {
        FolderSessionSnapshot {
            family: self.family,
            current_index: self.current_index,
            total_items: self.items.len(),
            can_go_previous: self.previous_index().is_some(),
            can_go_next: self.next_index().is_some(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSessionSnapshot {
    pub family: MediaFamily,
    pub current_index: usize,
    pub total_items: usize,
    pub can_go_previous: bool,
    pub can_go_next: bool,
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{FolderSession, MediaFamily};

    #[test]
    fn navigation_does_not_wrap_implicitly() {
        let mut session = FolderSession::new(
            MediaFamily::Audio,
            vec![PathBuf::from("01.mp3"), PathBuf::from("02.mp3")],
            0,
        )
        .unwrap();

        assert_eq!(session.previous_index(), None);
        assert_eq!(session.next_index(), Some(1));

        session.select(1).unwrap();
        assert_eq!(session.previous_index(), Some(0));
        assert_eq!(session.next_index(), None);
    }
}
