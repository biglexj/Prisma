use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::State;
use crate::features::quick_look::keyboard_hook::{get_shortcut_mode, set_shortcut_mode};
use crate::features::quick_look::{QuickLookPayload, QuickLookState};
use crate::infrastructure::autostart::{is_autostart_enabled, set_autostart};

static MINIMIZE_TO_TRAY: AtomicBool = AtomicBool::new(true);
static PREV_BOUNDS: Mutex<Option<HashMap<String, (f64, f64, f64, f64)>>> = Mutex::new(None);
static WINDOWS_MAXIMIZED: Mutex<Option<HashMap<String, bool>>> = Mutex::new(None);

pub fn reset_maximize_state() {
    if let Ok(mut map) = WINDOWS_MAXIMIZED.lock() {
        if let Some(m) = map.as_mut() {
            m.insert("quicklook".to_string(), false);
        }
    }
    if let Ok(mut lock) = PREV_BOUNDS.lock() {
        if let Some(m) = lock.as_mut() {
            m.remove("quicklook");
        }
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
    let label = window.label().to_string();
    let currently_maximized = {
        let mut map = WINDOWS_MAXIMIZED.lock().unwrap();
        let m = map.get_or_insert_with(HashMap::new);
        m.get(&label).copied().unwrap_or(false)
    };

    if currently_maximized {
        let prev = {
            let mut lock = PREV_BOUNDS.lock().unwrap();
            let m = lock.get_or_insert_with(HashMap::new);
            m.remove(&label)
        };

        if let Some((x, y, w, h)) = prev {
            let _ = window.set_size(tauri::LogicalSize::new(w, h));
            let _ = window.set_position(tauri::LogicalPosition::new(x, y));
        } else {
            let (screen_w, screen_h) = window
                .current_monitor()
                .ok()
                .flatten()
                .map(|m| {
                    let s = m.scale_factor();
                    (
                        (m.size().width as f64 / s).round(),
                        (m.size().height as f64 / s).round(),
                    )
                })
                .unwrap_or((1920.0, 1080.0));
            let def_w = (screen_w * 0.60).round().max(680.0);
            let def_h = (screen_h * 0.80).round().max(580.0);
            let _ = window.set_size(tauri::LogicalSize::new(def_w, def_h));
            let _ = window.center();
        }

        if let Ok(mut map) = WINDOWS_MAXIMIZED.lock() {
            let m = map.get_or_insert_with(HashMap::new);
            m.insert(label, false);
        }
        Ok(false)
    } else {
        let scale = window.scale_factor().unwrap_or(1.0);
        let cur_size = window
            .inner_size()
            .map(|s| s.to_logical::<f64>(scale))
            .unwrap_or(tauri::LogicalSize::new(830.0, 630.0));
        let cur_pos = window
            .outer_position()
            .map(|p| p.to_logical::<f64>(scale))
            .unwrap_or(tauri::LogicalPosition::new(100.0, 100.0));

        {
            let mut lock = PREV_BOUNDS.lock().unwrap();
            let m = lock.get_or_insert_with(HashMap::new);
            m.insert(label.clone(), (cur_pos.x, cur_pos.y, cur_size.width, cur_size.height));
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

        if let Ok(mut map) = WINDOWS_MAXIMIZED.lock() {
            let m = map.get_or_insert_with(HashMap::new);
            m.insert(label, true);
        }
        Ok(true)
    }
}

#[tauri::command]
pub fn quick_look_is_maximized(window: tauri::WebviewWindow) -> bool {
    let label = window.label().to_string();
    if let Ok(mut map) = WINDOWS_MAXIMIZED.lock() {
        let m = map.get_or_insert_with(HashMap::new);
        if let Some(&max) = m.get(&label) {
            return max;
        }
    }
    window.is_maximized().unwrap_or(false)
}

#[tauri::command]
pub fn quick_look_start_dragging(window: tauri::WebviewWindow) -> Result<(), String> {
    let is_max = quick_look_is_maximized(window.clone());
    if !is_max {
        window.start_dragging().map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn quick_look_get_position(window: tauri::WebviewWindow) -> Result<(f64, f64), String> {
    let scale = window.scale_factor().unwrap_or(1.0);
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let logical = pos.to_logical::<f64>(scale);
    Ok((logical.x, logical.y))
}

#[tauri::command]
pub fn quick_look_set_position(window: tauri::WebviewWindow, x: f64, y: f64) -> Result<(), String> {
    let is_max = quick_look_is_maximized(window.clone());
    if !is_max {
        window.set_position(tauri::LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn quick_look_set_size(window: tauri::WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    let is_max = quick_look_is_maximized(window.clone());
    if !is_max {
        let _ = window.set_size(tauri::LogicalSize::new(width, height));
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
        if let Ok(mut map) = PREV_BOUNDS.lock() {
            if let Some(m) = map.as_mut() {
                m.remove(&label);
            }
        }
        if let Ok(mut map) = WINDOWS_MAXIMIZED.lock() {
            if let Some(m) = map.as_mut() {
                m.remove(&label);
            }
        }
        let _ = window.close();
    }
    Ok(())
}

#[tauri::command]
pub async fn quick_look_edit_file(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean_path = path.trim_start_matches(r"\\?\").trim_start_matches(r"\\?\UNC\").to_string();
        let p = std::path::Path::new(&clean_path);
        if !p.exists() {
            return Err("El archivo no existe".to_string());
        }

        #[cfg(target_os = "windows")]
        {
            use windows::core::HSTRING;
            use windows::Win32::UI::Shell::ShellExecuteW;
            use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

            let wide_path = HSTRING::from(&clean_path);
            let wide_edit = HSTRING::from("edit");
            let wide_open = HSTRING::from("open");

            unsafe {
                let result = ShellExecuteW(
                    None,
                    &wide_edit,
                    &wide_path,
                    None,
                    None,
                    SW_SHOWNORMAL,
                );

                if result.0 as usize <= 32 {
                    let fallback = ShellExecuteW(
                        None,
                        &wide_open,
                        &wide_path,
                        None,
                        None,
                        SW_SHOWNORMAL,
                    );
                    if fallback.0 as usize <= 32 {
                        return Err(format!("No se pudo abrir el editor para {:?}", clean_path));
                    }
                }
            }
            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = clean_path;
            Ok(())
        }
    })
    .await
    .map_err(|e| format!("Error en runtime al editar archivo: {e}"))?
}

