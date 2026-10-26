use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fs;
use std::path::{Path, PathBuf};

/// Extensiones que el fondo reproduce como vídeo.
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "webm", "mkv", "mov", "avi", "m4v"];

/// Extensiones de la categoría Imágenes, incluido GIF animado.
/// mpv las decodifica con su demuxer de imagen: se pintan como un fotograma
/// y, con "keep-open=always", se quedan en la ventana del escritorio.
const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "bmp", "gif", "tif", "tiff", "avif",
];

/// Segundos que una imagen estática permanece en pantalla por defecto.
pub const DEFAULT_IMAGE_DURATION_SEC: u32 = 20;
/// Rango aceptado para la duración de una imagen estática, en segundos.
pub const MIN_IMAGE_DURATION_SEC: u32 = 5;
pub const MAX_IMAGE_DURATION_SEC: u32 = 600;

/// Tipo de medio de un archivo de Fondos Vivos.
/// El usuario no distingue entre vídeo e imagen: para la app son "medios",
/// pero el motor necesita saber cuál es cuál para saber cómo termina.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Video,
    Image,
}

impl MediaKind {
    /// Deduce el tipo de un archivo por su extensión.
    /// Lo que no sea una imagen conocida se trata como vídeo: es el
    /// comportamiento que ya tenía la aplicación.
    pub fn from_path(path: &str) -> MediaKind {
        let ext = Path::new(path)
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        if IMAGE_EXTENSIONS.contains(&ext.as_str()) {
            MediaKind::Image
        } else {
            MediaKind::Video
        }
    }
}

/// Qué tipos de medio entran en la cola de reproducción y en la cuadrícula.
/// Por defecto solo hay vídeos: es lo que hacía la aplicación antes de que
/// existieran las imágenes, así que un archivo de configuración antiguo sigue
/// funcionando igual al abrirse.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MediaKindMode {
    /// Solo vídeos.
    #[default]
    Video,
    /// Solo imágenes estáticas.
    Image,
    /// Vídeos e imágenes intercalados.
    Mixed,
}

impl MediaKindMode {
    /// Convierte el texto que llega del frontend en un modo válido.
    pub fn parse(value: &str) -> Result<MediaKindMode, String> {
        match value.trim().to_lowercase().as_str() {
            "video" => Ok(MediaKindMode::Video),
            "image" => Ok(MediaKindMode::Image),
            "mixed" => Ok(MediaKindMode::Mixed),
            other => Err(format!(
                "Modo de medio desconocido: '{other}'. Usa 'video', 'image' o 'mixed'."
            )),
        }
    }

    /// ¿Este tipo de medio es elegible en este modo?
    pub fn accepts(&self, kind: MediaKind) -> bool {
        match self {
            MediaKindMode::Video => kind == MediaKind::Video,
            MediaKindMode::Image => kind == MediaKind::Image,
            MediaKindMode::Mixed => true,
        }
    }

    /// Nombre legible del modo, para los mensajes de diagnóstico.
    #[allow(dead_code)]
    pub fn label(&self) -> &'static str {
        match self {
            MediaKindMode::Video => "vídeos",
            MediaKindMode::Image => "imágenes",
            MediaKindMode::Mixed => "medios",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSource {
    pub id: String,
    pub path: String,
    pub name: String,
    pub enabled: bool,
    pub video_count: usize,
    pub image_count: usize,
    pub media_count: usize,
    pub available: bool,
    pub hidden: bool,
}

impl<'de> serde::Deserialize<'de> for FolderSource {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(serde::Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Helper {
            id: String,
            path: String,
            name: String,
            enabled: bool,
            #[serde(default)]
            video_count: usize,
            #[serde(default)]
            image_count: usize,
            #[serde(default)]
            media_count: usize,
            available: bool,
            #[serde(default)]
            hidden: bool,
        }

        let helper = Helper::deserialize(deserializer)?;
        let media_count = if helper.media_count > 0 {
            helper.media_count
        } else {
            helper.video_count + helper.image_count
        };
        Ok(FolderSource {
            id: helper.id,
            path: helper.path,
            name: helper.name,
            enabled: helper.enabled,
            video_count: helper.video_count,
            image_count: helper.image_count,
            media_count,
            available: helper.available,
            hidden: helper.hidden,
        })
    }
}

/// Un medio de la cuadrícula: un vídeo o una imagen estática.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperMediaItem {
    pub path: String,
    pub name: String,
    pub folder_id: String,
    pub folder_name: String,
    /// Tipo del medio: "video" o "image".
    pub kind: MediaKind,
    /// Oculto individualmente: no se reproduce ni sale de la cuadrícula.
    #[serde(default)]
    pub hidden: bool,
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
    /// Rutas de medios ocultados individualmente (vídeos e imágenes).
    /// Las configuraciones antiguas guardaban esta lista como "hiddenVideos".
    #[serde(default, alias = "hiddenVideos")]
    pub hidden_media: Vec<String>,
    /// Sonido del fondo vivo. Es independiente del reproductor de la app:
    /// activarlo o desactivarlo nunca toca la música que esté sonando.
    #[serde(default)]
    pub audio_enabled: bool,
    /// Segundos que una imagen estática permanece en pantalla.
    #[serde(default = "default_image_duration")]
    pub image_duration_sec: u32,
    /// Qué tipos de medio entran en la cola y en la cuadrícula.
    /// Las configuraciones antiguas (sin este campo) se abren en modo vídeo.
    #[serde(default)]
    pub media_kind_mode: MediaKindMode,
    #[serde(default)]
    pub composition: super::compositor::CompositorConfig,
}

fn default_image_duration() -> u32 {
    DEFAULT_IMAGE_DURATION_SEC
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
            hidden_media: Vec::new(),
            audio_enabled: false,
            image_duration_sec: DEFAULT_IMAGE_DURATION_SEC,
            media_kind_mode: MediaKindMode::Video,
            composition: super::compositor::CompositorConfig::default(),
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

        let (video_count, image_count, available) = scan_folder_media(&canonical);
        let media_count = video_count + image_count;
        let id = format!("src_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());

        let source = FolderSource {
            id,
            path: canonical_str,
            name,
            enabled: true,
            video_count,
            image_count,
            media_count,
            available,
            hidden: false,
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

    /// Oculta o muestra una carpeta. Oculta excluye sus medios de la lista
    /// y de la cola de reproducción.
    pub fn set_folder_hidden(&mut self, id: &str, hidden: bool) -> bool {
        let current = self.current_media();
        let found = if let Some(src) = self.settings.sources.iter_mut().find(|s| s.id == id) {
            src.hidden = hidden;
            true
        } else {
            false
        };
        if found {
            let _ = self.save_to_disk();
            self.rebuild_queue(current.as_deref());
        }
        found
    }

    /// Oculta o muestra un medio concreto (vídeo o imagen). Oculto lo saca
    /// de la cola y lo marca en la cuadrícula.
    pub fn set_media_hidden(&mut self, path: &str, hidden: bool) -> bool {
        let clean = clean_path_str(path);
        let current = self.current_media();
        if hidden {
            if !self.settings.hidden_media.iter().any(|p| p == &clean) {
                self.settings.hidden_media.push(clean);
            }
        } else {
            self.settings.hidden_media.retain(|p| p != &clean);
        }
        let _ = self.save_to_disk();
        self.rebuild_queue(current.as_deref());
        true
    }

    pub fn is_media_hidden(&self, path: &str) -> bool {
        let clean = clean_path_str(path);
        self.settings.hidden_media.iter().any(|p| p == &clean)
    }

    /// Cambia el tipo de medio que entra en la cola y en la cuadrícula.
    /// Si el medio en pantalla sigue siendo elegible se conserva; si no, la
    /// cola arranca por el primer elemento elegible del modo nuevo.
    pub fn set_media_kind_mode(&mut self, mode: MediaKindMode) {
        let current = self.current_media();
        self.settings.media_kind_mode = mode;
        let _ = self.save_to_disk();
        self.rebuild_queue(current.as_deref());
    }

    /// Segundos que una imagen estática permanece en pantalla.
    pub fn set_image_duration(&mut self, seconds: u32) {
        self.settings.image_duration_sec = seconds.clamp(MIN_IMAGE_DURATION_SEC, MAX_IMAGE_DURATION_SEC);
        let _ = self.save_to_disk();
    }

    pub fn refresh_all_sources(&mut self) {
        for src in &mut self.settings.sources {
            src.path = clean_path_str(&src.path);
            let p = Path::new(&src.path);
            let (video_count, image_count, available) = scan_folder_media(p);
            src.video_count = video_count;
            src.image_count = image_count;
            src.media_count = video_count + image_count;
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
        let kind_mode = self.settings.media_kind_mode;
        let mut collected = Vec::new();

        for source in &self.settings.sources {
            if !source.enabled || !source.available || source.hidden {
                continue;
            }
            let p = Path::new(&source.path);
            let mut items = list_folder_media(p);
            // Orden natural por nombre: "2" va antes que "10". Vídeos e
            // imágenes se intercalan en una sola lista.
            items.sort_by(|a, b| natural_cmp(a, b));
            for item in items {
                if self.is_media_hidden(&item) {
                    continue;
                }
                if !kind_mode.accepts(MediaKind::from_path(&item)) {
                    continue;
                }
                collected.push(item);
            }
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

    pub fn current_media(&self) -> Option<String> {
        self.queue.get(self.current_index).cloned()
    }

    pub fn total_media(&self) -> usize {
        self.queue.len()
    }

    pub fn set_current_media(&mut self, path: &str) -> bool {
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

    /// Medios del modo activo: la cuadrícula muestra lo mismo que la cola.
    pub fn get_all_media(&self) -> Vec<WallpaperMediaItem> {
        let kind_mode = self.settings.media_kind_mode;
        let mut all = Vec::new();
        for source in &self.settings.sources {
            if !source.enabled || !source.available || source.hidden {
                continue;
            }
            let p = Path::new(&source.path);
            let mut items = list_folder_media(p);
            items.sort_by(|a, b| natural_cmp(a, b));
            for item in items {
                let clean_p = clean_path_str(&item);
                let kind = MediaKind::from_path(&clean_p);
                if !kind_mode.accepts(kind) {
                    continue;
                }
                let name = Path::new(&clean_p)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| clean_p.clone());
                let hidden = self.is_media_hidden(&clean_p);
                all.push(WallpaperMediaItem {
                    path: clean_p,
                    name,
                    folder_id: source.id.clone(),
                    folder_name: source.name.clone(),
                    kind,
                    hidden,
                });
            }
        }
        all
    }

    pub fn advance_next(&mut self) -> Option<String> {
        if self.queue.is_empty() {
            return None;
        }

        if let Some(curr) = self.current_media() {
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

        self.current_media()
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

        self.current_media()
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

/// Cuenta los medios de una carpeta (vídeos e imágenes) y dice si es
/// accesible. El recuento no depende del modo de medio activo: es el dato
/// real de la carpeta.
fn scan_folder_media(dir: &Path) -> (usize, usize, bool) {
    if !dir.is_dir() {
        return (0, 0, false);
    }
    let list = list_folder_media(dir);
    let mut videos = 0;
    let mut images = 0;
    for item in &list {
        match MediaKind::from_path(item) {
            MediaKind::Video => videos += 1,
            MediaKind::Image => images += 1,
        }
    }
    (videos, images, true)
}

/// Enumera los medios de una carpeta (vídeos e imágenes), sin subcarpetas.
fn list_folder_media(dir: &Path) -> Vec<String> {
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
                if VIDEO_EXTENSIONS.contains(&ext_lower.as_str())
                    || IMAGE_EXTENSIONS.contains(&ext_lower.as_str())
                {
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
