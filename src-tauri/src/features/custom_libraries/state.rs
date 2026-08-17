use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::UNIX_EPOCH;

use super::model::{
    get_default_presets, CustomLibraryDefinition, CustomLibraryFolderSource, CustomLibraryItem,
};

#[derive(Debug, Clone)]
pub struct CustomLibrariesState {
    data_dir: PathBuf,
    libraries: Arc<Mutex<Vec<CustomLibraryDefinition>>>,
}

impl CustomLibrariesState {
    pub fn load(data_dir: PathBuf) -> Result<Self, std::io::Error> {
        fs::create_dir_all(&data_dir)?;
        let file_path = data_dir.join("custom_libraries.json");

        let mut libraries = if file_path.exists() {
            match fs::read_to_string(&file_path) {
                Ok(content) => serde_json::from_str::<Vec<CustomLibraryDefinition>>(&content)
                    .unwrap_or_else(|_| get_default_presets()),
                Err(_) => get_default_presets(),
            }
        } else {
            get_default_presets()
        };

        // Asegurar que presets nuevos o faltantes se sincronicen y se actualicen extensiones oficiales
        let existing_ids: HashSet<String> = libraries.iter().map(|l| l.id.clone()).collect();
        for preset in get_default_presets() {
            if !existing_ids.contains(&preset.id) {
                libraries.push(preset);
            } else if let Some(existing) = libraries.iter_mut().find(|l| l.id == preset.id && l.is_preset) {
                // Eliminar redundancias de markdown si md está presente
                existing.extensions.retain(|e| e != "markdown");
                for ext in &preset.extensions {
                    if !existing.extensions.contains(ext) {
                        existing.extensions.push(ext.clone());
                    }
                }
                existing.description = preset.description;
            }
        }

        let state = Self {
            data_dir,
            libraries: Arc::new(Mutex::new(libraries)),
        };

        let _ = state.save_to_disk();
        Ok(state)
    }

    fn save_to_disk(&self) -> Result<(), std::io::Error> {
        let file_path = self.data_dir.join("custom_libraries.json");
        let libs = self.libraries.lock().unwrap();
        let json = serde_json::to_string_pretty(&*libs)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        fs::write(file_path, json)
    }

    pub fn get_all(&self) -> Vec<CustomLibraryDefinition> {
        self.libraries.lock().unwrap().clone()
    }

    pub fn get_by_id(&self, id: &str) -> Option<CustomLibraryDefinition> {
        self.libraries
            .lock()
            .unwrap()
            .iter()
            .find(|l| l.id == id)
            .cloned()
    }

    pub fn save_or_update(&self, def: CustomLibraryDefinition) -> Result<Vec<CustomLibraryDefinition>, String> {
        let mut libs = self.libraries.lock().unwrap();
        if let Some(existing) = libs.iter_mut().find(|l| l.id == def.id) {
            existing.label = def.label;
            existing.icon = def.icon;
            existing.extensions = def.extensions;
            existing.external_app_command = def.external_app_command;
            existing.folder_paths = def.folder_paths;
            existing.excluded_folder_paths = def.excluded_folder_paths;
            existing.is_active = def.is_active;
            existing.description = def.description;
        } else {
            libs.push(def);
        }
        drop(libs);
        self.save_to_disk().map_err(|e| e.to_string())?;
        Ok(self.get_all())
    }

    pub fn toggle_active(&self, id: &str, active: bool) -> Result<Vec<CustomLibraryDefinition>, String> {
        let mut libs = self.libraries.lock().unwrap();
        if let Some(lib) = libs.iter_mut().find(|l| l.id == id) {
            lib.is_active = active;
        } else {
            return Err("Biblioteca no encontrada".to_string());
        }
        drop(libs);
        self.save_to_disk().map_err(|e| e.to_string())?;
        Ok(self.get_all())
    }

    pub fn delete_custom(&self, id: &str) -> Result<Vec<CustomLibraryDefinition>, String> {
        let mut libs = self.libraries.lock().unwrap();
        if let Some(pos) = libs.iter().position(|l| l.id == id) {
            if libs[pos].is_preset {
                // Los presets solo se desactivan
                libs[pos].is_active = false;
                libs[pos].folder_paths.clear();
                libs[pos].excluded_folder_paths.clear();
            } else {
                libs.remove(pos);
            }
        } else {
            return Err("Biblioteca no encontrada".to_string());
        }
        drop(libs);
        self.save_to_disk().map_err(|e| e.to_string())?;
        Ok(self.get_all())
    }

    pub fn add_folder(&self, id: &str, folder_path: String) -> Result<Vec<CustomLibraryDefinition>, String> {
        let mut libs = self.libraries.lock().unwrap();
        if let Some(lib) = libs.iter_mut().find(|l| l.id == id) {
            if !lib.folder_paths.contains(&folder_path) {
                lib.folder_paths.push(folder_path);
            }
        } else {
            return Err("Biblioteca no encontrada".to_string());
        }
        drop(libs);
        self.save_to_disk().map_err(|e| e.to_string())?;
        Ok(self.get_all())
    }

    pub fn remove_folder(&self, id: &str, folder_path: &str) -> Result<Vec<CustomLibraryDefinition>, String> {
        let mut libs = self.libraries.lock().unwrap();
        if let Some(lib) = libs.iter_mut().find(|l| l.id == id) {
            lib.folder_paths.retain(|p| p != folder_path);
        } else {
            return Err("Biblioteca no encontrada".to_string());
        }
        drop(libs);
        self.save_to_disk().map_err(|e| e.to_string())?;
        Ok(self.get_all())
    }

    pub fn add_excluded_folder(&self, id: &str, folder_path: String) -> Result<Vec<CustomLibraryDefinition>, String> {
        let mut libs = self.libraries.lock().unwrap();
        if let Some(lib) = libs.iter_mut().find(|l| l.id == id) {
            if !lib.excluded_folder_paths.contains(&folder_path) {
                lib.excluded_folder_paths.push(folder_path);
            }
        } else {
            return Err("Biblioteca no encontrada".to_string());
        }
        drop(libs);
        self.save_to_disk().map_err(|e| e.to_string())?;
        Ok(self.get_all())
    }

    pub fn remove_excluded_folder(&self, id: &str, folder_path: &str) -> Result<Vec<CustomLibraryDefinition>, String> {
        let mut libs = self.libraries.lock().unwrap();
        if let Some(lib) = libs.iter_mut().find(|l| l.id == id) {
            lib.excluded_folder_paths.retain(|p| p != folder_path);
        } else {
            return Err("Biblioteca no encontrada".to_string());
        }
        drop(libs);
        self.save_to_disk().map_err(|e| e.to_string())?;
        Ok(self.get_all())
    }

    pub fn get_folders_with_counts(&self, id: &str) -> Vec<CustomLibraryFolderSource> {
        let lib = match self.get_by_id(id) {
            Some(l) => l,
            None => return Vec::new(),
        };

        let extensions: HashSet<String> = lib
            .extensions
            .iter()
            .map(|e| e.to_ascii_lowercase().trim_start_matches('.').to_string())
            .collect();

        lib.folder_paths
            .into_iter()
            .map(|folder| {
                let path = Path::new(&folder);
                let available = path.exists() && path.is_dir();
                let count = if available {
                    count_matching_files(path, &extensions, 0, 10)
                } else {
                    0
                };
                CustomLibraryFolderSource {
                    path: folder,
                    available,
                    count,
                }
            })
            .collect()
    }

    pub fn get_excluded_folders_with_counts(&self, id: &str) -> Vec<CustomLibraryFolderSource> {
        let lib = match self.get_by_id(id) {
            Some(l) => l,
            None => return Vec::new(),
        };

        let extensions: HashSet<String> = lib
            .extensions
            .iter()
            .map(|e| e.to_ascii_lowercase().trim_start_matches('.').to_string())
            .collect();

        lib.excluded_folder_paths
            .into_iter()
            .map(|folder| {
                let path = Path::new(&folder);
                let available = path.exists() && path.is_dir();
                let count = if available {
                    count_matching_files(path, &extensions, 0, 10)
                } else {
                    0
                };
                CustomLibraryFolderSource {
                    path: folder,
                    available,
                    count,
                }
            })
            .collect()
    }

    pub fn scan_items(&self, id: &str) -> Vec<CustomLibraryItem> {
        let lib = match self.get_by_id(id) {
            Some(l) => l,
            None => return Vec::new(),
        };

        let extensions: HashSet<String> = lib
            .extensions
            .iter()
            .map(|e| e.to_ascii_lowercase().trim_start_matches('.').to_string())
            .collect();

        let excluded_paths: Vec<PathBuf> = lib
            .excluded_folder_paths
            .iter()
            .map(|p| PathBuf::from(p))
            .collect();

        let mut all_items = Vec::new();

        for root_folder in &lib.folder_paths {
            let root_p = Path::new(root_folder);
            if !root_p.exists() || !root_p.is_dir() {
                continue;
            }
            scan_dir_recursive(root_p, root_p, &extensions, &excluded_paths, &mut all_items, 0, 12);
        }

        all_items.sort_by(|a, b| b.modified_timestamp.cmp(&a.modified_timestamp));
        all_items
    }
}

fn matches_ext(file_ext: &str, extensions: &HashSet<String>) -> bool {
    let lower = file_ext.to_ascii_lowercase();
    if extensions.contains(&lower) {
        return true;
    }
    if (lower == "markdown" || lower == "md") && (extensions.contains("md") || extensions.contains("markdown")) {
        return true;
    }
    false
}

fn is_ignored_dir_name(name: &str) -> bool {
    if name.starts_with('.') {
        return true;
    }
    const IGNORED_NAMES: &[&str] = &[
        "node_modules", "target", "dist", "build", "out", "vendor", "bin", "obj",
        ".git", ".gemini", ".next", ".turbo", ".idea", ".vscode", ".cargo", ".gradle",
        "$recycle.bin", "system volume information", "temp", "tmp", "coverage",
    ];
    IGNORED_NAMES.iter().any(|&ign| ign.eq_ignore_ascii_case(name))
}

fn count_matching_files(dir: &Path, extensions: &HashSet<String>, depth: usize, max_depth: usize) -> usize {
    if depth > max_depth {
        return 0;
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return 0,
    };

    let mut count = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy();

        if let Ok(file_type) = entry.file_type() {
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                if is_ignored_dir_name(&name_str) {
                    continue;
                }
                count += count_matching_files(&path, extensions, depth + 1, max_depth);
            } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if matches_ext(ext, extensions) {
                    count += 1;
                }
            }
        }
    }
    count
}

fn scan_dir_recursive(
    current_dir: &Path,
    root_dir: &Path,
    extensions: &HashSet<String>,
    excluded_paths: &[PathBuf],
    items: &mut Vec<CustomLibraryItem>,
    depth: usize,
    max_depth: usize,
) {
    if depth > max_depth {
        return;
    }

    // Si la carpeta actual está en la lista de exclusiones, ignorarla
    for excluded in excluded_paths {
        if current_dir.starts_with(excluded) {
            return;
        }
    }

    let entries = match fs::read_dir(current_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy();

        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };

        if file_type.is_symlink() {
            continue;
        }

        if file_type.is_dir() {
            if is_ignored_dir_name(&name_str) {
                continue;
            }
            let is_excluded = excluded_paths.iter().any(|ex| path.starts_with(ex));
            if !is_excluded {
                scan_dir_recursive(&path, root_dir, extensions, excluded_paths, items, depth + 1, max_depth);
            }
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if matches_ext(ext, extensions) {
                let is_excluded = excluded_paths.iter().any(|ex| path.starts_with(ex));
                if is_excluded {
                    continue;
                }

                let name = file_name.to_string_lossy().to_string();
                let metadata = entry.metadata().ok();
                let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                let modified_timestamp = metadata
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);

                let relative_folder = path
                    .parent()
                    .and_then(|p| p.strip_prefix(root_dir).ok())
                    .and_then(|p| p.to_str())
                    .unwrap_or("")
                    .replace('\\', "/");

                items.push(CustomLibraryItem {
                    path: path.to_string_lossy().to_string(),
                    name,
                    extension: ext.to_ascii_lowercase(),
                    relative_folder,
                    size_bytes,
                    modified_timestamp,
                });
            }
        }
    }
}
