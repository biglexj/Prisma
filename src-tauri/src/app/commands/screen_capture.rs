use std::sync::Arc;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::features::screen_capture::{
    confirm_crop, get_subregion, init_capture_session, CaptureSessionInit,
    DetectedTarget, EditorPayload, RectSelection, SharedCaptureState,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenCaptureShortcutStatus {
    pub shortcut: String,
    pub is_registered: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn screen_capture_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, SharedCaptureState>,
    _mode: Option<String>,
) -> Result<CaptureSessionInit, String> {
    let init = init_capture_session(&state)?;

    if let Some(overlay) = app.get_webview_window("screen_capture_overlay") {
        let _ = overlay.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: init.virtual_x,
            y: init.virtual_y,
        }));
        let _ = overlay.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: init.virtual_width,
            height: init.virtual_height,
        }));
        let _ = overlay.show();
        let _ = overlay.set_focus();
        let _ = overlay.emit("screen_capture://session-started", &init);
    }

    Ok(init)
}

#[tauri::command]
pub async fn screen_capture_detect_subregion(
    parent_x: i32,
    parent_y: i32,
    screen_x: i32,
    screen_y: i32,
) -> Result<Option<DetectedTarget>, String> {
    Ok(get_subregion(parent_x, parent_y, screen_x, screen_y))
}

#[tauri::command]
pub async fn screen_capture_confirm(
    _app: tauri::AppHandle,
    state: tauri::State<'_, SharedCaptureState>,
    rect: RectSelection,
) -> Result<EditorPayload, String> {
    let payload = confirm_crop(&state, rect)?;
    Ok(payload)
}

#[tauri::command]
pub async fn screen_capture_cancel(
    app: tauri::AppHandle,
    state: tauri::State<'_, SharedCaptureState>,
) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("screen_capture_overlay") {
        let _ = overlay.hide();
    }
    if let Some(editor) = app.get_webview_window("screen_capture_editor") {
        let _ = editor.hide();
    }
    if let Ok(mut lock) = state.lock() {
        lock.snapshot = None;
    }
    Ok(())
}

#[tauri::command]
pub async fn screen_capture_get_editor_payload(
    state: tauri::State<'_, SharedCaptureState>,
) -> Result<Option<EditorPayload>, String> {
    let lock = state
        .lock()
        .map_err(|_| "Error al acceder al estado de captura".to_string())?;
    Ok(lock.editor_payload.clone())
}

#[tauri::command]
pub async fn screen_capture_save_file(
    file_path: String,
    data_base64: String,
) -> Result<String, String> {
    let clean_b64 = if let Some(idx) = data_base64.find(',') {
        &data_base64[idx + 1..]
    } else {
        &data_base64
    };

    let bytes = STANDARD
        .decode(clean_b64.trim())
        .map_err(|e| format!("Error decodificando imagen base64: {e}"))?;

    let path = std::path::Path::new(&file_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("No se pudo crear el directorio de destino: {e}"))?;
    }

    std::fs::write(path, bytes)
        .map_err(|e| format!("No se pudo escribir el archivo PNG: {e}"))?;

    Ok(file_path)
}

#[tauri::command]
pub async fn screen_capture_get_shortcut_status(
    state: tauri::State<'_, SharedCaptureState>,
) -> Result<ScreenCaptureShortcutStatus, String> {
    let lock = state
        .lock()
        .map_err(|_| "Error al leer atajo".to_string())?;
    Ok(ScreenCaptureShortcutStatus {
        shortcut: lock.active_shortcut.clone(),
        is_registered: lock.shortcut_error.is_none(),
        error: lock.shortcut_error.clone(),
    })
}

#[tauri::command]
pub async fn screen_capture_set_shortcut(
    app: tauri::AppHandle,
    state: tauri::State<'_, SharedCaptureState>,
    shortcut: String,
) -> Result<(), String> {
    register_capture_shortcut(&app, &state, &shortcut)
}

/// Registra el atajo global de captura de pantalla en el sistema operativo.
pub fn register_capture_shortcut(
    app: &tauri::AppHandle,
    state: &SharedCaptureState,
    shortcut: &str,
) -> Result<(), String> {
    let global_shortcut = app.global_shortcut();

    // Desregistrar atajo previo si existía
    if let Ok(mut lock) = state.lock() {
        if !lock.active_shortcut.is_empty() {
            let _ = global_shortcut.unregister(lock.active_shortcut.as_str());
        }
        if shortcut.trim().is_empty() || shortcut == "disabled" {
            lock.active_shortcut = String::new();
            lock.shortcut_error = None;
            return Ok(());
        }
    }

    let is_running = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let app_handle = app.clone();
    let state_clone = state.clone();

    let shortcut_str = shortcut.to_string();
    let reg_result = global_shortcut.on_shortcut(shortcut_str.as_str(), move |_app, _sc, event| {
        if event.state() == ShortcutState::Released {
            is_running.store(false, std::sync::atomic::Ordering::Relaxed);
            return;
        }

        if is_running.swap(true, std::sync::atomic::Ordering::Relaxed) {
            return;
        }

        let app = app_handle.clone();
        let state = state_clone.clone();

        tauri::async_runtime::spawn(async move {
            if let Ok(init) = init_capture_session(&state) {
                if let Some(overlay) = app.get_webview_window("screen_capture_overlay") {
                    let _ = overlay.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                        x: init.virtual_x,
                        y: init.virtual_y,
                    }));
                    let _ = overlay.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                        width: init.virtual_width,
                        height: init.virtual_height,
                    }));
                    let _ = overlay.show();
                    let _ = overlay.set_focus();
                    let _ = overlay.emit("screen_capture://session-started", &init);
                }
            }
        });
    });

    let mut lock = state
        .lock()
        .map_err(|_| "Error bloqueando estado".to_string())?;

    lock.active_shortcut = shortcut_str;

    match reg_result {
        Ok(_) => {
            lock.shortcut_error = None;
            println!("[Capturador] Atajo global '{shortcut}' registrado con éxito");
            Ok(())
        }
        Err(e) => {
            let err_msg = format!("El atajo '{shortcut}' no se pudo registrar (puede estar ocupado por otra aplicación): {e}");
            eprintln!("[Capturador] {err_msg}");
            lock.shortcut_error = Some(err_msg.clone());
            Err(err_msg)
        }
    }
}
