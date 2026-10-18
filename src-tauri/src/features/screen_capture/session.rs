use std::sync::{Arc, Mutex};
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
}

pub struct CaptureSessionState {
    pub snapshot: Option<ScreenSnapshot>,
    pub targets: Vec<DetectedTarget>,
    pub monitors: Vec<MonitorTarget>,
    pub editor_payload: Option<EditorPayload>,
    pub active_shortcut: String,
    pub shortcut_error: Option<String>,
}

impl Default for CaptureSessionState {
    fn default() -> Self {
        Self {
            snapshot: None,
            targets: Vec::new(),
            monitors: Vec::new(),
            editor_payload: None,
            active_shortcut: "Shift+PrintScreen".to_string(),
            shortcut_error: None,
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
    lock.targets = targets.clone();
    lock.monitors = monitors.clone();

    Ok(CaptureSessionInit {
        virtual_x,
        virtual_y,
        virtual_width,
        virtual_height,
        targets,
        monitors,
        default_mode: "window".to_string(), // Modo por defecto requerido: Ventana
    })
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
    };

    lock.editor_payload = Some(payload.clone());
    // Liberar el snapshot completo para recuperar memoria de inmediato
    lock.snapshot = None;

    Ok(payload)
}

pub fn get_subregion(
    parent_x: i32,
    parent_y: i32,
    screen_x: i32,
    screen_y: i32,
) -> Option<DetectedTarget> {
    detect_subregions_at(parent_x, parent_y, screen_x, screen_y)
}
