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
pub fn quick_look_open_in_main(path: String, state: State<'_, QuickLookState>) {
    state.open_in_main(path);
}

#[tauri::command]
pub fn quick_look_get_current(state: State<'_, QuickLookState>) -> Option<QuickLookPayload> {
    state.get_current_payload()
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
