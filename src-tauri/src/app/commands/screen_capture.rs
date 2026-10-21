use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::path::Path;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutEvent, ShortcutState};

use crate::features::screen_capture::{
    clear_session, confirm_crop, detect_window_at, get_session, get_subregion, init_capture_session,
    pick_color_at, preferences, CaptureSessionInit, CaptureShortcutPreferences, DetectedTarget,
    EditorPayload, PickColorResult, RectSelection, SharedCaptureState, DEFAULT_SHORTCUT,
    FALLBACK_SHORTCUT,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenCaptureShortcutStatus {
    /// Atajo realmente registrado en el sistema operativo.
    pub shortcut: String,
    /// Atajo solicitado por el usuario.
    pub requested_shortcut: String,
    /// El atajo global está habilitado.
    pub enabled: bool,
    /// El sistema operativo aceptó un atajo y está activo.
    pub is_registered: bool,
    /// Motivo por el que el atajo solicitado no pudo activarse.
    pub error: Option<String>,
    /// Ya existe una preferencia guardada por el usuario.
    pub has_stored_preference: bool,
}

#[tauri::command]
pub async fn screen_capture_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, SharedCaptureState>,
    _mode: Option<String>,
) -> Result<CaptureSessionInit, String> {
    start_capture_session(&app, &state)
}

fn start_capture_session(app: &tauri::AppHandle, state: &SharedCaptureState) -> Result<CaptureSessionInit, String> {
    // No congelar ni volver a mostrar el lienzo de la captura anterior.
    #[cfg(windows)]
    let was_visible = ["screen_capture_overlay", "screen_capture_editor"].iter().any(|label| {
        app.get_webview_window(label).is_some_and(|window| window.is_visible().unwrap_or(false))
    });
    hide_capture_windows(app);
    #[cfg(windows)]
    if was_visible {
        // Esperar a que el compositor retire la captura A antes de congelar la B.
        let _ = unsafe { windows::Win32::Graphics::Dwm::DwmFlush() };
    }
    let init = init_capture_session(state)?;

    if let Some(overlay) = app.get_webview_window("screen_capture_overlay") {
        // Una ventana minimizada (por ejemplo tras Win+D) ignora set_position/set_size y
        // show() no la restaura: quedaría fuera de pantalla y la captura no se vería.
        let _ = overlay.unminimize();
        let _ = overlay.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: init.virtual_x,
            y: init.virtual_y,
        }));
        let _ = overlay.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: init.virtual_width,
            height: init.virtual_height,
        }));
        let _ = overlay.emit("screen_capture://session-started", &init);
    }

    Ok(init)
}

#[tauri::command]
pub async fn screen_capture_overlay_ready(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, SharedCaptureState>,
    session_id: u64,
) -> Result<(), String> {
    if window.label() != "screen_capture_overlay"
        || get_session(&state).is_none_or(|session| session.session_id != session_id)
    {
        return Ok(());
    }
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn screen_capture_detect_subregion(
    parent_hwnd: u64,
    screen_x: i32,
    screen_y: i32,
) -> Result<Option<DetectedTarget>, String> {
    Ok(get_subregion(parent_hwnd, screen_x, screen_y))
}

/// Resuelve la ventana de aplicación situada bajo el punto indicado usando el
/// hit-test del sistema operativo. Es la fuente de verdad para el modo Ventana:
/// no depende del evento de sesión ni de una lista de objetivos potencialmente obsoleta.
#[tauri::command]
pub async fn screen_capture_detect_window_at(
    app: tauri::AppHandle,
    screen_x: i32,
    screen_y: i32,
) -> Result<Option<DetectedTarget>, String> {
    // Apartar el overlay y el editor: el overlay cubre toda la pantalla y siempre
    // ganaría el hit-test. El resto de ventanas de Prisma sí son capturables.
    let mut excluded: Vec<u64> = Vec::new();
    for label in ["screen_capture_overlay", "screen_capture_editor"] {
        if let Some(window) = app.get_webview_window(label) {
            if let Ok(hwnd) = window.hwnd() {
                excluded.push(hwnd.0 as usize as u64);
            }
        }
    }
    Ok(detect_window_at(screen_x, screen_y, &excluded))
}

/// Devuelve la sesión de captura vigente. Permite al overlay resincronizarse
/// cuando el evento de sesión no llega (overlay oculto, webview pausada, etc.).
#[tauri::command]
pub async fn screen_capture_get_session(
    state: tauri::State<'_, SharedCaptureState>,
) -> Result<Option<CaptureSessionInit>, String> {
    Ok(get_session(&state))
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
    hide_capture_windows(&app);
    clear_session(&state);
    Ok(())
}

pub fn hide_capture_windows(app: &tauri::AppHandle) {
    if let Some(overlay) = app.get_webview_window("screen_capture_overlay") {
        let session_id = app.try_state::<SharedCaptureState>()
            .and_then(|state| get_session(&state).map(|session| session.session_id));
        let _ = overlay.emit("screen_capture://session-ended", session_id);
        let _ = overlay.hide();
    }
    if let Some(editor) = app.get_webview_window("screen_capture_editor") {
        let _ = editor.hide();
    }
}

#[tauri::command]
pub async fn screen_capture_pick_color(
    state: tauri::State<'_, SharedCaptureState>,
    screen_x: i32,
    screen_y: i32,
) -> Result<PickColorResult, String> {
    pick_color_at(&state, screen_x, screen_y)
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
    format: Option<String>,
) -> Result<String, String> {
    let clean_b64 = if let Some(idx) = data_base64.find(',') {
        &data_base64[idx + 1..]
    } else {
        &data_base64
    };

    let bytes = STANDARD
        .decode(clean_b64.trim())
        .map_err(|e| format!("Error decodificando imagen base64: {e}"))?;

    tauri::async_runtime::spawn_blocking(move || {
        use crate::infrastructure::codecs::capture_image::{capture_extension, encode_capture_image};
        let format = format.as_deref().unwrap_or("png");
        let extension = capture_extension(format)?;
        let encoded = encode_capture_image(&bytes, format)?;
        let mut path = std::path::PathBuf::from(file_path);
        path.set_extension(extension);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("No se pudo crear el directorio de destino: {e}"))?;
        }
        std::fs::write(&path, encoded).map_err(|e| format!("No se pudo guardar la captura: {e}"))?;
        Ok(path.to_string_lossy().into_owned())
    }).await.map_err(|e| format!("Error procesando la captura: {e}"))?

}

#[tauri::command]
pub async fn screen_capture_get_shortcut_status(
    state: tauri::State<'_, SharedCaptureState>,
) -> Result<ScreenCaptureShortcutStatus, String> {
    let lock = state
        .lock()
        .map_err(|_| "Error al leer atajo".to_string())?;
    Ok(build_shortcut_status(&lock))
}

#[tauri::command]
pub async fn screen_capture_configure(
    app: tauri::AppHandle,
    state: tauri::State<'_, SharedCaptureState>,
    enabled: bool,
    shortcut: String,
) -> Result<ScreenCaptureShortcutStatus, String> {
    apply_capture_shortcut(&app, &state, enabled, &shortcut)
}

/// Construye el estado público del atajo a partir del estado interno.
fn build_shortcut_status(lock: &crate::features::screen_capture::CaptureSessionState) -> ScreenCaptureShortcutStatus {
    ScreenCaptureShortcutStatus {
        shortcut: lock
            .registered_shortcut
            .clone()
            .unwrap_or_else(|| lock.active_shortcut.clone()),
        requested_shortcut: lock.active_shortcut.clone(),
        enabled: lock.shortcut_enabled,
        is_registered: lock.registered_shortcut.is_some(),
        error: lock.shortcut_error.clone(),
        has_stored_preference: lock.has_stored_preference,
    }
}

/// Aplica la preferencia de atajo: registra en el sistema operativo, guarda la
/// preferencia y devuelve el estado resultante. Nunca falla por conflicto: el
/// conflicto viaja en `error` para que la interfaz pueda explicarlo.
pub fn apply_capture_shortcut(
    app: &tauri::AppHandle,
    state: &SharedCaptureState,
    enabled: bool,
    shortcut: &str,
) -> Result<ScreenCaptureShortcutStatus, String> {
    let global_shortcut = app.global_shortcut();
    let requested = shortcut.trim().to_string();

    // Desregistrar el atajo anterior: el sistema no admite dos registros del mismo atajo.
    {
        let mut lock = state
            .lock()
            .map_err(|_| "Error bloqueando estado".to_string())?;
        if let Some(previous) = lock.registered_shortcut.take() {
            let _ = global_shortcut.unregister(previous.as_str());
        }
        lock.shortcut_error = None;
        lock.registered_shortcut = None;
        lock.shortcut_enabled = enabled;
        lock.active_shortcut = if requested.is_empty() {
            DEFAULT_SHORTCUT.to_string()
        } else {
            requested.clone()
        };
    }

    if !enabled {
        persist_capture_preferences(state);
        let lock = state
            .lock()
            .map_err(|_| "Error bloqueando estado".to_string())?;
        return Ok(build_shortcut_status(&lock));
    }

    let registration = global_shortcut.on_shortcut(
        requested.as_str(),
        build_capture_handler(app.clone(), state.clone()),
    );

    let mut lock = state
        .lock()
        .map_err(|_| "Error bloqueando estado".to_string())?;

    match registration {
        Ok(_) => {
            lock.registered_shortcut = Some(requested.clone());
            lock.shortcut_error = None;
            println!("[Capturador] Atajo global '{requested}' registrado con éxito");
        }
        Err(error) => {
            // El atajo pedido está ocupado: se prueban las alternativas libres.
            let mut alternatives = Vec::new();
            if !requested.eq_ignore_ascii_case(FALLBACK_SHORTCUT) {
                alternatives.push(FALLBACK_SHORTCUT);
            }
            if !requested.eq_ignore_ascii_case(DEFAULT_SHORTCUT)
                && !alternatives.iter().any(|item| item.eq_ignore_ascii_case(DEFAULT_SHORTCUT))
            {
                alternatives.push(DEFAULT_SHORTCUT);
            }

            let mut fallback_error = None;
            for alternative in alternatives {
                match global_shortcut.on_shortcut(
                    alternative,
                    build_capture_handler(app.clone(), state.clone()),
                ) {
                    Ok(_) => {
                        lock.registered_shortcut = Some(alternative.to_string());
                        lock.shortcut_error = Some(format!(
                            "«{requested}» está en uso por otra aplicación (Recortes de Windows, ShareX u otra). Se activó «{alternative}» en su lugar."
                        ));
                        println!(
                            "[Capturador] Atajo '{requested}' ocupado; se activó '{alternative}' como alternativa"
                        );
                        fallback_error = None;
                        break;
                    }
                    Err(alternative_error) => {
                        fallback_error = Some(alternative_error.to_string());
                    }
                }
            }

            if let Some(alternative_error) = fallback_error {
                lock.registered_shortcut = None;
                lock.shortcut_error = Some(format!(
                    "«{requested}» no se pudo registrar: {error}. «{FALLBACK_SHORTCUT}» tampoco está disponible: {alternative_error}"
                ));
                eprintln!("[Capturador] {}", lock.shortcut_error.clone().unwrap_or_default());
            }
        }
    }

    drop(lock);
    persist_capture_preferences(state);

    let lock = state
        .lock()
        .map_err(|_| "Error bloqueando estado".to_string())?;
    Ok(build_shortcut_status(&lock))
}

/// Construye el manejador que abre una sesión de captura al pulsar el atajo.
fn build_capture_handler(
    app_handle: tauri::AppHandle,
    state: SharedCaptureState,
) -> impl Fn(&tauri::AppHandle, &tauri_plugin_global_shortcut::Shortcut, ShortcutEvent) + Send + Sync + 'static {
    let is_running = Arc::new(AtomicBool::new(false));
    move |_app, _shortcut, event| {
        if event.state() == ShortcutState::Released {
            is_running.store(false, Ordering::Relaxed);
            return;
        }

        if is_running.swap(true, Ordering::Relaxed) {
            return;
        }

        let app = app_handle.clone();
        let state = state.clone();

        tauri::async_runtime::spawn(async move {
            let _ = start_capture_session(&app, &state);
        });
    }
}

/// Guarda la preferencia de atajo en el directorio de datos de la aplicación.
fn persist_capture_preferences(state: &SharedCaptureState) {
    let (path, preferences) = {
        let Ok(lock) = state.lock() else { return; };
        if lock.preferences_path.as_os_str().is_empty() {
            return;
        }
        (
            lock.preferences_path.clone(),
            CaptureShortcutPreferences {
                version: 1,
                enabled: lock.shortcut_enabled,
                shortcut: lock.active_shortcut.clone(),
            },
        )
    };

    if let Err(error) = preferences::save(&path, &preferences) {
        eprintln!("[Capturador] {error}");
    }
}

/// Deja el atajo global activo desde el arranque de la aplicación, sin depender
/// del frontend: en bandeja o minimizada, el capturador responde igual.
pub fn apply_capture_shortcut_at_startup(
    app: &tauri::AppHandle,
    state: &SharedCaptureState,
    preferences_path: &Path,
) {
    {
        let Ok(mut lock) = state.lock() else { return; };
        lock.preferences_path = preferences_path.to_path_buf();
    }

    let stored = preferences::load(preferences_path);
    let (enabled, shortcut) = match stored {
        Some(preferences) => {
            if let Ok(mut lock) = state.lock() {
                lock.has_stored_preference = true;
            }
            (preferences.enabled, preferences.shortcut)
        }
        None => (true, DEFAULT_SHORTCUT.to_string()),
    };

    if let Err(error) = apply_capture_shortcut(app, state, enabled, &shortcut) {
        eprintln!("[Capturador] No se pudo aplicar el atajo al arrancar: {error}");
    }
}

#[cfg(test)]
mod save_format_tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn screen_capture_saves_real_files_in_each_selected_format() {
        let image = image::RgbImage::from_pixel(17, 13, image::Rgb([0, 201, 185]));
        let mut png = Cursor::new(Vec::new());
        image.write_to(&mut png, image::ImageFormat::Png).unwrap();
        let data = format!("data:image/png;base64,{}", STANDARD.encode(png.get_ref()));
        let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        for format in ["png", "webp", "jpeg", "elx"] {
            let path = std::env::temp_dir().join(format!("prisma-capture-{stamp}-{format}.png"));
            let saved = tauri::async_runtime::block_on(screen_capture_save_file(
                path.to_string_lossy().into_owned(), data.clone(), Some(format.into()),
            )).unwrap();
            let bytes = std::fs::read(&saved).unwrap();
            let decoded = if format == "elx" {
                crate::infrastructure::codecs::elyx::decode_elyx_file(std::path::Path::new(&saved)).unwrap().0
            } else { image::load_from_memory(&bytes).unwrap().to_rgb8() };
            assert_eq!(decoded.dimensions(), (17, 13));
            let extension = crate::infrastructure::codecs::capture_image::capture_extension(format).unwrap();
            assert_eq!(std::path::Path::new(&saved).extension().unwrap(), extension);
            std::fs::remove_file(saved).unwrap();
        }
    }
}
