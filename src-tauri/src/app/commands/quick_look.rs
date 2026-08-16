use std::sync::atomic::{AtomicBool, Ordering};
use tauri::State;
use crate::features::quick_look::keyboard_hook::{get_shortcut_mode, set_shortcut_mode};
use crate::features::quick_look::{QuickLookPayload, QuickLookState};
use crate::infrastructure::autostart::{is_autostart_enabled, set_autostart};

static MINIMIZE_TO_TRAY: AtomicBool = AtomicBool::new(true);

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
pub fn quick_look_toggle_maximize(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("quicklook") {
        let is_max = win.is_maximized().map_err(|e| e.to_string())?;
        if is_max {
            win.unmaximize().map_err(|e| e.to_string())?;
            Ok(false)
        } else {
            win.maximize().map_err(|e| e.to_string())?;
            Ok(true)
        }
    } else {
        Err("Ventana de QuickLook no encontrada".to_string())
    }
}

#[tauri::command]
pub fn quick_look_is_maximized(app: tauri::AppHandle) -> bool {
    use tauri::Manager;
    app.get_webview_window("quicklook")
        .and_then(|w| w.is_maximized().ok())
        .unwrap_or(false)
}

#[tauri::command]
pub fn quick_look_start_dragging(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn quick_look_set_size(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("quicklook") {
        if !win.is_maximized().unwrap_or(false) {
            let _ = win.set_size(tauri::LogicalSize::new(width, height));
            let _ = win.center();
        }
    }
    Ok(())
}
