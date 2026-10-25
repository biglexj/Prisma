use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fs;
use std::path::{Path, PathBuf};

const VIDEO_EXTENSIONS: &[&str] = &["mp4", "webm", "mkv", "mov", "avi", "m4v"];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSource {
    pub id: String,
    pub path: String,
    pub name: String,
    pub enabled: bool,
    pub video_count: usize,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperVideoItem {
    pub path: String,
    pub name: String,
    pub folder_id: String,
    pub folder_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum WallpaperMode {
    Sequential,
    Shuffle,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum WallpaperFit {
    Cover,
    Contain,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperSettings {
    pub version: u32,
    pub sources: Vec<FolderSource>,
    pub mode: WallpaperMode,
    pub fit: WallpaperFit,
    pub auto_start: bool,
    pub is_active: bool,
}

impl Default for WallpaperSettings {
    fn default() -> Self {
        Self {
            version: 1,
            sources: Vec::new(),
            mode: WallpaperMode::Sequential,
            fit: WallpaperFit::Cover,
            auto_start: false,
            is_active: false,
        }
    }
}

pub struct SourceManager {
    config_path: PathBuf,
    settings: WallpaperSettings,
    queue: Vec<String>,
    current_index: usize,
    last_played: Option<String>,
}

impl SourceManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let config_path = app_data_dir.join("live_wallpapers.json");
        let settings = Self::load_from_disk(&config_path).unwrap_or_default();
        let mut mgr = Self {
            config_path,
            settings,
            queue: Vec::new(),
            current_index: 0,
            last_played: None,
        };
        mgr.refresh_all_sources();
        mgr.rebuild_queue(None);
        mgr
    }

    fn load_from_disk(path: &Path) -> Option<WallpaperSettings> {
        let content = fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }

    pub fn save_to_disk(&self) -> Result<(), String> {
        if let Some(parent) = self.config_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let data = serde_json::to_string_pretty(&self.settings)
            .map_err(|e| format!("Error serializando configuración de fondos: {e}"))?;

        let tmp_path = self.config_path.with_extension("tmp");
        fs::write(&tmp_path, data)
            .map_err(|e| format!("Error escribiendo archivo temporal de fondos: {e}"))?;
        fs::rename(&tmp_path, &self.config_path)
            .map_err(|e| format!("Error atómico guardando live_wallpapers.json: {e}"))?;
        Ok(())
    }

    pub fn settings(&self) -> &WallpaperSettings {
        &self.settings
    }

    pub fn settings_mut(&mut self) -> &mut WallpaperSettings {
        &mut self.settings
    }

    pub fn add_folder(&mut self, folder_path: &str) -> Result<FolderSource, String> {
        let path = Path::new(folder_path);
        let canonical = path
            .canonicalize()
            .map_err(|e| format!("Ruta no accesible o inexistente: {e}"))?;

        if !canonical.is_dir() {
            return Err("La ruta seleccionada no es un directorio válido".to_string());
        }

        let canonical_str = clean_path_str(&canonical.to_string_lossy());

        if self.settings.sources.iter().any(|s| clean_path_str(&s.path) == canonical_str) {
            return Err("Esta carpeta ya está registrada en Fondos Vivos".to_string());
        }

        let name = canonical
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| canonical_str.clone());

        let (count, available) = scan_folder_videos(&canonical);
        let id = format!("src_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());

        let source = FolderSource {
            id,
            path: canonical_str,
            name,
            enabled: true,
            video_count: count,
            available,
        };

        self.settings.sources.push(source.clone());
        let _ = self.save_to_disk();
        self.rebuild_queue(None);

        Ok(source)
    }

    pub fn remove_folder(&mut self, id: &str) -> bool {
        let prev_len = self.settings.sources.len();
        self.settings.sources.retain(|s| s.id != id);
        let removed = self.settings.sources.len() < prev_len;
        if removed {
            let _ = self.save_to_disk();
            self.rebuild_queue(None);
        }
        removed
    }

    pub fn toggle_folder(&mut self, id: &str, enabled: bool) -> bool {
        if let Some(src) = self.settings.sources.iter_mut().find(|s| s.id == id) {
            src.enabled = enabled;
            let _ = self.save_to_disk();
            self.rebuild_queue(None);
            true
        } else {
            false
        }
    }

    pub fn refresh_all_sources(&mut self) {
        for src in &mut self.settings.sources {
            src.path = clean_path_str(&src.path);
            let p = Path::new(&src.path);
            let (count, available) = scan_folder_videos(p);
            src.video_count = count;
            src.available = available;
        }
        let _ = self.save_to_disk();
    }

    pub fn set_mode(&mut self, mode: WallpaperMode) {
        self.settings.mode = mode;
        let _ = self.save_to_disk();
        self.rebuild_queue(None);
    }

    pub fn set_fit(&mut self, fit: WallpaperFit) {
        self.settings.fit = fit;
        let _ = self.save_to_disk();
    }

    pub fn rebuild_queue(&mut self, preserve_current: Option<&str>) {
        let mut collected = Vec::new();

        for source in &self.settings.sources {
            if !source.enabled || !source.available {
                continue;
            }
            let p = Path::new(&source.path);
            let mut vids = list_folder_videos(p);
            vids.sort_by(|a, b| natural_cmp(a, b));
            collected.extend(vids);
        }

        let mut unique: Vec<String> = Vec::new();
        for item in collected {
            let clean = clean_path_str(&item);
            if !unique.contains(&clean) {
                unique.push(clean);
            }
        }

        match self.settings.mode {
            WallpaperMode::Sequential => {
                self.queue = unique;
            }
            WallpaperMode::Shuffle => {
                shuffle_vec(&mut unique);
                if unique.len() > 1 {
                    if let Some(last) = &self.last_played {
                        if &unique[0] == last {
                            let first = unique.remove(0);
                            unique.push(first);
                        }
                    }
                }
                self.queue = unique;
            }
        }

        if let Some(current) = preserve_current {
            let clean_current = clean_path_str(current);
            if let Some(idx) = self.queue.iter().position(|p| p == &clean_current) {
                self.current_index = idx;
                return;
            }
        }

        self.current_index = 0;
    }

    pub fn current_video(&self) -> Option<String> {
        self.queue.get(self.current_index).cloned()
    }

    pub fn total_videos(&self) -> usize {
        self.queue.len()
    }

    pub fn set_current_video(&mut self, path: &str) -> bool {
        let clean = clean_path_str(path);
        if let Some(idx) = self.queue.iter().position(|p| p == &clean) {
            self.current_index = idx;
            true
        } else {
            self.queue.insert(0, clean);
            self.current_index = 0;
            true
        }
    }

    pub fn get_all_videos(&self) -> Vec<WallpaperVideoItem> {
        let mut all = Vec::new();
        for source in &self.settings.sources {
            if !source.enabled || !source.available {
                continue;
            }
            let p = Path::new(&source.path);
            let mut vids = list_folder_videos(p);
            vids.sort_by(|a, b| natural_cmp(a, b));
            for v in vids {
                let clean_p = clean_path_str(&v);
                let name = Path::new(&clean_p)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| clean_p.clone());
                all.push(WallpaperVideoItem {
                    path: clean_p,
                    name,
                    folder_id: source.id.clone(),
                    folder_name: source.name.clone(),
                });
            }
        }
        all
    }

    pub fn advance_next(&mut self) -> Option<String> {
        if self.queue.is_empty() {
            return None;
        }

        if let Some(curr) = self.current_video() {
            self.last_played = Some(curr);
        }

        if self.queue.len() == 1 {
            return self.queue.first().cloned();
        }

        self.current_index += 1;
        if self.current_index >= self.queue.len() {
            if self.settings.mode == WallpaperMode::Shuffle {
                let mut new_queue = self.queue.clone();
                shuffle_vec(&mut new_queue);
                if new_queue.len() > 1 {
                    if let Some(last) = &self.last_played {
                        if &new_queue[0] == last {
                            let first = new_queue.remove(0);
                            new_queue.push(first);
                        }
                    }
                }
                self.queue = new_queue;
            }
            self.current_index = 0;
        }

        self.current_video()
    }

    pub fn advance_prev(&mut self) -> Option<String> {
        if self.queue.is_empty() {
            return None;
        }

        if self.queue.len() == 1 {
            return self.queue.first().cloned();
        }

        if self.current_index == 0 {
            self.current_index = self.queue.len() - 1;
        } else {
            self.current_index -= 1;
        }

        self.current_video()
    }

    #[allow(dead_code)]
    pub fn queue(&self) -> &[String] {
        &self.queue
    }

    #[allow(dead_code)]
    pub fn current_index(&self) -> usize {
        self.current_index
    }

    #[allow(dead_code)]
    pub fn peek_next(&self) -> Option<String> {
        if self.queue.len() <= 1 {
            return None;
        }
        let next_idx = (self.current_index + 1) % self.queue.len();
        self.queue.get(next_idx).cloned()
    }
}

pub fn clean_path_str(s: &str) -> String {
    if let Some(stripped) = s.strip_prefix(r"\\?\") {
        stripped.to_string()
    } else {
        s.to_string()
    }
}

fn scan_folder_videos(dir: &Path) -> (usize, bool) {
    if !dir.is_dir() {
        return (0, false);
    }
    let list = list_folder_videos(dir);
    (list.len(), true)
}

fn list_folder_videos(dir: &Path) -> Vec<String> {
    let mut results = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return results,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if VIDEO_EXTENSIONS.contains(&ext_lower.as_str()) {
                    let clean = clean_path_str(&path.to_string_lossy());
                    results.push(clean);
                }
            }
        }
    }
    results
}

fn shuffle_vec<T>(vec: &mut [T]) {
    use std::time::SystemTime;
    let len = vec.len();
    if len <= 1 {
        return;
    }
    let mut seed = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(123456789);

    for i in (1..len).rev() {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        let j = (seed % ((i + 1) as u64)) as usize;
        vec.swap(i, j);
    }
}

pub fn natural_cmp(a: &str, b: &str) -> Ordering {
    let mut chars_a = a.chars().peekable();
    let mut chars_b = b.chars().peekable();

    while let (Some(&ca), Some(&cb)) = (chars_a.peek(), chars_b.peek()) {
        if ca.is_ascii_digit() && cb.is_ascii_digit() {
            let mut num_a: u64 = 0;
            while let Some(&c) = chars_a.peek() {
                if let Some(digit) = c.to_digit(10) {
                    num_a = num_a.saturating_mul(10).saturating_add(digit as u64);
                    chars_a.next();
                } else {
                    break;
                }
            }

            let mut num_b: u64 = 0;
            while let Some(&c) = chars_b.peek() {
                if let Some(digit) = c.to_digit(10) {
                    num_b = num_b.saturating_mul(10).saturating_add(digit as u64);
                    chars_b.next();
                } else {
                    break;
                }
            }

            match num_a.cmp(&num_b) {
                Ordering::Equal => continue,
                other => return other,
            }
        } else {
            let la = ca.to_lowercase().next().unwrap_or(ca);
            let lb = cb.to_lowercase().next().unwrap_or(cb);
            match la.cmp(&lb) {
                Ordering::Equal => {
                    chars_a.next();
                    chars_b.next();
                }
                other => return other,
            }
        }
    }

    a.len().cmp(&b.len())
}
