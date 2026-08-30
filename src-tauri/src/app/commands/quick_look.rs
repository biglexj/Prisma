use std::sync::atomic::{AtomicBool, Ordering};
use tauri::State;
use crate::features::quick_look::keyboard_hook::{get_shortcut_mode, set_shortcut_mode};
use crate::features::quick_look::{QuickLookPayload, QuickLookState};
use crate::infrastructure::autostart::{is_autostart_enabled, set_autostart};

use std::sync::Mutex;

static MINIMIZE_TO_TRAY: AtomicBool = AtomicBool::new(true);
static PREV_BOUNDS: Mutex<Option<(f64, f64, f64, f64)>> = Mutex::new(None);
static IS_CUSTOM_MAXIMIZED: AtomicBool = AtomicBool::new(false);

pub fn reset_maximize_state() {
    IS_CUSTOM_MAXIMIZED.store(false, Ordering::SeqCst);
    if let Ok(mut lock) = PREV_BOUNDS.lock() {
        *lock = None;
    }
}

pub fn is_minimize_to_tray_enabled() -> bool {
    MINIMIZE_TO_TRAY.load(Ordering::SeqCst)
}

#[tauri::command]
pub fn quick_look_toggle(state: State<'_, QuickLookState>) {
    state.toggle();
}

#[tauri::command]
pub fn quick_look_hide(state: State<'_, QuickLookState>) {
    state.hide();
}

#[tauri::command]
pub fn quick_look_open_in_main(
    state: State<'_, QuickLookState>,
    path: String,
    current_time: Option<f64>,
) {
    state.open_in_main(path, current_time);
}

#[tauri::command]
pub fn quick_look_get_current(state: State<'_, QuickLookState>) -> Option<QuickLookPayload> {
    state.get_current_payload()
}

#[tauri::command]
pub fn quick_look_open_detached(
    state: State<'_, QuickLookState>,
    path: String,
) -> Result<String, String> {
    state.open_detached(&path)
}

#[tauri::command]
pub fn quick_look_get_detached_payload(
    state: State<'_, QuickLookState>,
    label: String,
) -> Option<QuickLookPayload> {
    state.get_detached_payload(&label)
}

#[tauri::command]
pub fn quick_look_step_selection(state: State<'_, QuickLookState>, forward: bool) -> bool {
    state.step_selection(forward)
}

#[tauri::command]
pub fn quick_look_show_file(path: String, state: State<'_, QuickLookState>) -> bool {
    state.show_file_path(std::path::Path::new(&path))
}

#[tauri::command]
pub fn quick_look_set_shortcut(shortcut: String) {
    set_shortcut_mode(&shortcut);
}

#[tauri::command]
pub fn quick_look_get_shortcut() -> String {
    get_shortcut_mode()
}

#[tauri::command]
pub fn autostart_get_status() -> bool {
    is_autostart_enabled()
}

#[tauri::command]
pub fn autostart_set(enabled: bool) -> Result<(), String> {
    set_autostart(enabled)
}

#[tauri::command]
pub fn set_minimize_to_tray(enabled: bool) {
    MINIMIZE_TO_TRAY.store(enabled, Ordering::SeqCst);
}

#[tauri::command]
pub fn get_minimize_to_tray() -> bool {
    MINIMIZE_TO_TRAY.load(Ordering::SeqCst)
}

#[tauri::command]
pub fn quick_look_toggle_maximize(window: tauri::WebviewWindow) -> Result<bool, String> {
    let currently_maximized = IS_CUSTOM_MAXIMIZED.load(Ordering::SeqCst);

    if currently_maximized {
        let prev = {
            let lock = PREV_BOUNDS.lock().unwrap();
            *lock
        };

        if let Some((x, y, w, h)) = prev {
            let _ = window.set_size(tauri::LogicalSize::new(w, h));
            let _ = window.set_position(tauri::LogicalPosition::new(x, y));
        } else {
            let _ = window.set_size(tauri::LogicalSize::new(800.0, 560.0));
            let _ = window.center();
        }

        IS_CUSTOM_MAXIMIZED.store(false, Ordering::SeqCst);
        Ok(false)
    } else {
        let scale = window.scale_factor().unwrap_or(1.0);
        let cur_size = window
            .inner_size()
            .map(|s| s.to_logical::<f64>(scale))
            .unwrap_or(tauri::LogicalSize::new(800.0, 560.0));
        let cur_pos = window
            .outer_position()
            .map(|p| p.to_logical::<f64>(scale))
            .unwrap_or(tauri::LogicalPosition::new(100.0, 100.0));

        {
            let mut lock = PREV_BOUNDS.lock().unwrap();
            *lock = Some((cur_pos.x, cur_pos.y, cur_size.width, cur_size.height));
        }

        if let Ok(Some(monitor)) = window.current_monitor() {
            let m_scale = monitor.scale_factor();
            let m_pos = monitor.position().to_logical::<f64>(m_scale);
            let m_size = monitor.size().to_logical::<f64>(m_scale);

            let _ = window.set_position(tauri::LogicalPosition::new(m_pos.x, m_pos.y));
            let _ = window.set_size(tauri::LogicalSize::new(m_size.width, m_size.height));
        } else {
            let _ = window.set_size(tauri::LogicalSize::new(1920.0, 1080.0));
            let _ = window.center();
        }

        IS_CUSTOM_MAXIMIZED.store(true, Ordering::SeqCst);
        Ok(true)
    }
}

#[tauri::command]
pub fn quick_look_is_maximized(_window: tauri::WebviewWindow) -> bool {
    IS_CUSTOM_MAXIMIZED.load(Ordering::SeqCst)
}

#[tauri::command]
pub fn quick_look_start_dragging(window: tauri::WebviewWindow) -> Result<(), String> {
    if !IS_CUSTOM_MAXIMIZED.load(Ordering::SeqCst) {
        window.start_dragging().map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn quick_look_set_size(window: tauri::WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    if !IS_CUSTOM_MAXIMIZED.load(Ordering::SeqCst) {
        let _ = window.set_size(tauri::LogicalSize::new(width, height));
        // Solo recentrar la vista previa principal; las instancias desacopladas
        // conservan su posición para permitir compararlas lado a lado.
        if window.label() == "quicklook" {
            let _ = window.center();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn quick_look_close_window(
    window: tauri::WebviewWindow,
    state: State<'_, QuickLookState>,
) -> Result<(), String> {
    let label = window.label().to_string();
    if label == "quicklook" {
        state.hide();
    } else {
        if label.starts_with(crate::features::quick_look::DETACHED_LABEL_PREFIX) {
            state.remove_detached(&label);
        }
        let _ = window.destroy();
    }
    Ok(())
}

