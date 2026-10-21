use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use base64::{engine::general_purpose::STANDARD, Engine as _};

use super::capture::{enumerate_monitors, capture_virtual_screen, MonitorTarget, ScreenSnapshot};
use super::windows::{detect_subregions_at, enumerate_visible_windows, DetectedTarget};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RectSelection {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSessionInit {
    pub session_id: u64,
    pub virtual_x: i32,
    pub virtual_y: i32,
    pub virtual_width: u32,
    pub virtual_height: u32,
    pub targets: Vec<DetectedTarget>,
    pub monitors: Vec<MonitorTarget>,
    pub default_mode: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorPayload {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
    pub timestamp: u64,
    pub x: i32,
    pub y: i32,
}

pub struct CaptureSessionState {
    pub snapshot: Option<ScreenSnapshot>,
    pub targets: Vec<DetectedTarget>,
    pub monitors: Vec<MonitorTarget>,
    pub editor_payload: Option<EditorPayload>,
    /// Atajo solicitado por el usuario (el que aparece seleccionado en Ajustes).
    pub active_shortcut: String,
    /// Atajo que el sistema operativo aceptó realmente. `None` mientras no haya ninguno activo.
    pub registered_shortcut: Option<String>,
    /// El atajo global está activo.
    pub shortcut_enabled: bool,
    pub shortcut_error: Option<String>,
    /// Archivo de preferencias del capturador en el directorio de datos de la app.
    pub preferences_path: PathBuf,
    /// Ya existe un archivo de preferencias guardado por el usuario.
    pub has_stored_preference: bool,
    /// Sesión vigente: permite al overlay recuperarla aunque se pierda el evento.
    pub session: Option<CaptureSessionInit>,
    /// Contador monótono de sesiones iniciadas.
    pub session_counter: u64,
}

impl Default for CaptureSessionState {
    fn default() -> Self {
        Self {
            snapshot: None,
            targets: Vec::new(),
            monitors: Vec::new(),
            editor_payload: None,
            active_shortcut: super::preferences::DEFAULT_SHORTCUT.to_string(),
            registered_shortcut: None,
            shortcut_enabled: true,
            shortcut_error: None,
            preferences_path: PathBuf::new(),
            has_stored_preference: false,
            session: None,
            session_counter: 0,
        }
    }
}

pub type SharedCaptureState = Arc<Mutex<CaptureSessionState>>;

pub fn init_capture_session(state: &SharedCaptureState) -> Result<CaptureSessionInit, String> {
    // 1. Capturar pantalla virtual completa antes de interactuar con la interfaz
    let snapshot = capture_virtual_screen()?;
    let targets = enumerate_visible_windows();
    let monitors = enumerate_monitors();

    let virtual_x = snapshot.x;
    let virtual_y = snapshot.y;
    let virtual_width = snapshot.width;
    let virtual_height = snapshot.height;

    let mut lock = state
        .lock()
        .map_err(|_| "Error al bloquear estado de sesión de captura".to_string())?;

    lock.snapshot = Some(snapshot);
    lock.editor_payload = None;
    lock.targets = targets.clone();
    lock.monitors = monitors.clone();

    lock.session_counter = lock.session_counter.wrapping_add(1);
    let session_id = lock.session_counter;

    let init = CaptureSessionInit {
        session_id,
        virtual_x,
        virtual_y,
        virtual_width,
        virtual_height,
        targets,
        monitors,
        default_mode: "window".to_string(), // Modo por defecto requerido: Ventana
    };

    // Guardar la sesión para que el overlay pueda recuperarla aunque el evento se pierda.
    lock.session = Some(init.clone());

    Ok(init)
}

/// Devuelve la sesión de captura vigente, si existe.
pub fn get_session(state: &SharedCaptureState) -> Option<CaptureSessionInit> {
    let lock = state.lock().ok()?;
    lock.session.clone()
}

pub fn clear_session(state: &SharedCaptureState) {
    if let Ok(mut lock) = state.lock() {
        lock.snapshot = None;
        lock.editor_payload = None;
        lock.session = None;
        lock.targets.clear();
        lock.monitors.clear();
    }
}

pub fn confirm_crop(
    state: &SharedCaptureState,
    rect: RectSelection,
) -> Result<EditorPayload, String> {
    let mut lock = state
        .lock()
        .map_err(|_| "Error al bloquear estado de captura".to_string())?;

    let snapshot = lock
        .snapshot
        .as_ref()
        .ok_or_else(|| "No hay ninguna captura activa en memoria".to_string())?;

    let cropped = snapshot.crop(rect.x, rect.y, rect.width, rect.height)?;

    let mut png_bytes = Vec::new();
    cropped
        .write_to(
            &mut std::io::Cursor::new(&mut png_bytes),
            image::ImageFormat::Png,
        )
        .map_err(|e| format!("Error al codificar imagen PNG en memoria: {e}"))?;

    let data_url = format!("data:image/png;base64,{}", STANDARD.encode(&png_bytes));
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let payload = EditorPayload {
        data_url,
        width: cropped.width(),
        height: cropped.height(),
        timestamp: now,
        x: rect.x,
        y: rect.y,
    };

    lock.editor_payload = Some(payload.clone());
    // Conservar el original mientras se ajusta el recorte; cancelar libera la sesión.

    Ok(payload)
}

pub fn get_subregion(
    parent_hwnd: u64,
    screen_x: i32,
    screen_y: i32,
) -> Option<DetectedTarget> {
    detect_subregions_at(parent_hwnd, screen_x, screen_y)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PickColorResult {
    pub hex: String,
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

pub fn pick_color_at(
    state: &SharedCaptureState,
    screen_x: i32,
    screen_y: i32,
) -> Result<PickColorResult, String> {
    let lock = state
        .lock()
        .map_err(|_| "Error al bloquear estado de captura".to_string())?;

    let snapshot = lock
        .snapshot
        .as_ref()
        .ok_or_else(|| "No hay ninguna captura activa en memoria".to_string())?;

    let (r, g, b) = snapshot
        .get_pixel_color(screen_x, screen_y)
        .ok_or_else(|| "Píxel fuera de los límites de pantalla".to_string())?;

    let hex = format!("#{:02X}{:02X}{:02X}", r, g, b);
    Ok(PickColorResult { hex, r, g, b })
}
