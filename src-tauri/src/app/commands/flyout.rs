use std::sync::{Mutex, atomic::{AtomicBool, Ordering}};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewWindow};

static LAST_ZONE: Mutex<Option<String>> = Mutex::new(None);
static LAST_SIZE: Mutex<(f64, f64)> = Mutex::new((380.0, 160.0));
static ENABLED: AtomicBool = AtomicBool::new(false);
static VOLUME_WORKER_READY: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub async fn flyout_get_system_media() -> Result<Option<crate::infrastructure::media::system_media::SystemMedia>, String> {
    tauri::async_runtime::spawn_blocking(crate::infrastructure::media::system_media::read)
        .await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn flyout_system_media_action(source_app_id: String, action: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || crate::infrastructure::media::system_media::transport(&source_app_id, &action))
        .await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn flyout_open_media_app(app: AppHandle, source_app_id: Option<String>) -> Result<(), String> {
    let target = match source_app_id {
        Some(source) => tauri::async_runtime::spawn_blocking(move || crate::infrastructure::media::system_media::resolve_app(&source))
            .await.map_err(|error| error.to_string())?,
        None => None,
    };
    app.clone().run_on_main_thread(move || {
        let opened = target.is_some_and(crate::infrastructure::media::system_media::activate_app);
        if !opened {
            let _ = super::quick_look::window_restore_from_background(app);
        }
    }).map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(windows)]
fn get_work_area_for_cursor() -> (i32, i32, i32, i32, f64) {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTOPRIMARY,
    };
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

    unsafe {
        let mut pt = POINT { x: 0, y: 0 };
        let _ = GetCursorPos(&mut pt);
        let hmon = MonitorFromPoint(pt, MONITOR_DEFAULTTOPRIMARY);
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;

        if GetMonitorInfoW(hmon, &mut mi).as_bool() {
            let left = mi.rcWork.left;
            let top = mi.rcWork.top;
            let width = mi.rcWork.right - mi.rcWork.left;
            let height = mi.rcWork.bottom - mi.rcWork.top;
            (left, top, width, height, 1.0)
        } else {
            (0, 0, 1920, 1040, 1.0)
        }
    }
}

#[cfg(not(windows))]
fn get_work_area_for_cursor() -> (i32, i32, i32, i32, f64) {
    (0, 0, 1920, 1040, 1.0)
}

fn calculate_flyout_coordinates(
    zone: &str,
    flyout_w: f64,
    flyout_h: f64,
    scale_factor: f64,
) -> (f64, f64) {
    let (work_left, work_top, work_w, work_h, _) = get_work_area_for_cursor();

    // Convert work area physical pixels to logical pixels according to scale factor
    let scale = if scale_factor > 0.0 { scale_factor } else { 1.0 };
    let l_left = work_left as f64 / scale;
    let l_top = work_top as f64 / scale;
    let l_width = work_w as f64 / scale;
    let l_height = work_h as f64 / scale;

    let margin_x = 18.0;
    let margin_y = 16.0;

    match zone {
        "bottom-center" => {
            let x = l_left + (l_width - flyout_w) / 2.0;
            let y = l_top + l_height - flyout_h - margin_y;
            (x, y)
        }
        "bottom-right" => {
            let x = l_left + l_width - flyout_w - margin_x;
            let y = l_top + l_height - flyout_h - margin_y;
            (x, y)
        }
        "top-left" => {
            let x = l_left + margin_x;
            let y = l_top + margin_y;
            (x, y)
        }
        "top-center" => {
            let x = l_left + (l_width - flyout_w) / 2.0;
            let y = l_top + margin_y;
            (x, y)
        }
        "top-right" => {
            let x = l_left + l_width - flyout_w - margin_x;
            let y = l_top + margin_y;
            (x, y)
        }
        _ /* "bottom-left" default */ => {
            let x = l_left + margin_x;
            let y = l_top + l_height - flyout_h - margin_y;
            (x, y)
        }
    }
}

pub fn position_window_inner(
    window: &WebviewWindow,
    zone: &str,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let scale = window.scale_factor().unwrap_or(1.0);
    let size = window.inner_size().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    if (size.width - width).abs() > 1.0 || (size.height - height).abs() > 1.0 {
        window.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
    }
    let (target_x, target_y) = calculate_flyout_coordinates(zone, width, height, scale);
    window
        .set_position(LogicalPosition::new(target_x, target_y))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn flyout_set_position(
    app: AppHandle,
    zone: String,
    width: Option<f64>,
    height: Option<f64>,
) -> Result<(), String> {
    let win = app
        .get_webview_window("flyout")
        .ok_or_else(|| "Ventana flyout no encontrada".to_string())?;

    // Release before window calls: a callback thread can otherwise wait on the
    // UI thread while the UI thread waits on this same mutex.
    let (w, h) = {
        let mut current_size = LAST_SIZE.lock().unwrap();
        if let (Some(w), Some(h)) = (width, height) { *current_size = (w, h); }
        *current_size
    };

    if let Ok(mut z_lock) = LAST_ZONE.lock() {
        *z_lock = Some(zone.clone());
    }

    position_window_inner(&win, &zone, w, h)
}

#[tauri::command]
pub fn flyout_show(
    app: AppHandle,
    zone: Option<String>,
    width: Option<f64>,
    height: Option<f64>,
) -> Result<(), String> {
    let win = app
        .get_webview_window("flyout")
        .ok_or_else(|| "Ventana flyout no encontrada".to_string())?;

    let target_zone = zone.or_else(|| LAST_ZONE.lock().ok()?.clone()).unwrap_or_else(|| "bottom-left".to_string());
    
    let (w, h) = {
        let mut current_size = LAST_SIZE.lock().unwrap();
        if let (Some(w), Some(h)) = (width, height) { *current_size = (w, h); }
        *current_size
    };

    position_window_inner(&win, &target_zone, w, h)?;

    #[cfg(not(windows))]
    win.show().map_err(|e| e.to_string())?;

    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW,
        };
        if let Ok(hwnd) = win.hwnd() {
            let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0);
            unsafe {
                SetWindowPos(
                    win_hwnd,
                    HWND_TOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
                ).map_err(|e| e.to_string())?;
            }
        }
        // Native visibility bypasses Tao's window flags. Wake the renderer too,
        // so its timers and playback animations run while the overlay is shown.
        win.with_webview(|webview| unsafe {
            if let Err(error) = webview.controller().SetIsVisible(true) {
                eprintln!("[Flyout] No se pudo mostrar la vista web: {error}");
            }
        }).map_err(|error| error.to_string())?;
    }

    let _ = app.emit_to("flyout", "prisma://flyout-shown", ());
    Ok(())
}

#[tauri::command]
pub fn flyout_hide(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("flyout") {
        #[cfg(windows)]
        {
            // Match the native show path. Tao still records this initially hidden
            // window as hidden, so win.hide() alone can be a no-op.
            use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE};
            let hwnd = win.hwnd().map_err(|error| error.to_string())?;
            unsafe { let _ = ShowWindow(windows::Win32::Foundation::HWND(hwnd.0), SW_HIDE); }
            win.with_webview(|webview| unsafe {
                if let Err(error) = webview.controller().SetIsVisible(false) {
                    eprintln!("[Flyout] No se pudo ocultar la vista web: {error}");
                }
            }).map_err(|error| error.to_string())?;
        }
        #[cfg(not(windows))]
        win.hide().map_err(|e| e.to_string())?;
        let _ = app.emit_to("flyout", "prisma://flyout-hidden", ());
    }
    Ok(())
}

#[tauri::command]
pub fn flyout_is_visible(app: AppHandle) -> bool {
    app.get_webview_window("flyout")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

pub fn flyout_show_from_app(app: &AppHandle) -> Result<(), String> {
    show_from_app_with_feedback(app, false)
}

fn show_from_app_with_feedback(app: &AppHandle, at_limit: bool) -> Result<(), String> {
    if !ENABLED.load(Ordering::Relaxed) { return Ok(()); }
    let handle = app.clone();
    app.run_on_main_thread(move || {
        if ENABLED.load(Ordering::Relaxed) {
            let _ = flyout_show(handle.clone(), None, None, None);
            if at_limit { let _ = handle.emit_to("flyout", "prisma://flyout-volume-limit", ()); }
        }
    }).map_err(|e| e.to_string())
}

use tauri::Emitter;
use crate::infrastructure::media::system_volume::{SystemVolume, VolumeKey};

#[tauri::command]
pub fn flyout_configure(app: AppHandle, enabled: bool, zone: String) -> Result<(), String> {
    ENABLED.store(enabled, Ordering::Relaxed);
    *LAST_ZONE.lock().map_err(|e| e.to_string())? = Some(zone);
    if !enabled { flyout_hide(app)?; }
    Ok(())
}

#[tauri::command]
pub async fn flyout_get_system_volume() -> Result<SystemVolume, String> {
    #[cfg(windows)]
    { crate::infrastructure::media::system_volume::native::read() }
    #[cfg(not(windows))]
    { Err("El volumen global está disponible en Windows".into()) }
}

#[tauri::command]
pub async fn flyout_set_system_volume(app: AppHandle, volume: f32, muted: Option<bool>) -> Result<SystemVolume, String> {
    #[cfg(windows)]
    {
        let _ = app;
        let sender = VOLUME_KEYS.get().ok_or("El control de volumen no está disponible")?;
        if !VOLUME_WORKER_READY.load(Ordering::Relaxed) {
            return Err("El control de volumen se está iniciando".into());
        }
        let (reply, result) = tokio::sync::oneshot::channel();
        sender.send(VolumeCommand::Set { volume, muted, reply }).map_err(|e| e.to_string())?;
        result.await.map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    { let _ = (app, volume, muted); Err("El volumen global está disponible en Windows".into()) }
}

#[tauri::command]
pub async fn flyout_get_audio_peak() -> Result<f32, String> {
    #[cfg(windows)]
    { crate::infrastructure::media::system_volume::native::peak() }
    #[cfg(not(windows))]
    { Ok(0.0) }
}

fn publish_volume(app: &AppHandle, volume: SystemVolume, show: bool) {
    let _ = app.emit("prisma://system-volume-changed", volume);
    if show { let _ = flyout_show_from_app(app); }
}

#[cfg(windows)]
enum VolumeCommand {
    Key(VolumeKey),
    Set { volume: f32, muted: Option<bool>, reply: tokio::sync::oneshot::Sender<Result<SystemVolume, String>> },
}

#[cfg(windows)]
static VOLUME_KEYS: std::sync::OnceLock<std::sync::mpsc::Sender<VolumeCommand>> = std::sync::OnceLock::new();

// Called inside the dedicated WH_KEYBOARD_LL. No COM or window operations here.
pub fn handle_volume_key(key: u16, pressed: bool) -> bool {
    if !ENABLED.load(Ordering::Relaxed) || !VOLUME_WORKER_READY.load(Ordering::Relaxed) { return false; }
    #[cfg(windows)]
    {
        let Some(sender) = VOLUME_KEYS.get() else { return false; };
        let action = match key {
            0xAF => VolumeKey::Up,
            0xAE => VolumeKey::Down,
            0xAD => VolumeKey::Mute,
            _ => return false,
        };
        return !pressed || sender.send(VolumeCommand::Key(action)).is_ok();
    }
    #[cfg(not(windows))]
    { let _ = (key, pressed); false }
}

#[cfg(windows)]
#[windows::core::implement(windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolumeCallback)]
struct NativeVolumeChangeCallback {
    app: AppHandle,
    last_volume: Mutex<Option<(i32, bool)>>,
}

#[cfg(windows)]
#[allow(non_snake_case)]
impl windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolumeCallback_Impl for NativeVolumeChangeCallback_Impl {
    fn OnNotify(&self, notification: *mut windows::Win32::Media::Audio::AUDIO_VOLUME_NOTIFICATION_DATA) -> windows::core::Result<()> {
        if let Some(data) = unsafe { notification.as_ref() } {
            let own_change = data.guidEventContext == crate::infrastructure::media::system_volume::native::VOLUME_CONTEXT;
            let state = ((data.fMasterVolume * 100.0).round() as i32, data.bMuted.as_bool());
            let changed = {
                let mut last = self.last_volume.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
                let changed = *last != Some(state);
                *last = Some(state);
                changed
            };
            publish_volume(&self.app, SystemVolume {
                volume: state.0 as f32,
                is_muted: state.1,
            }, !own_change && changed);
        }
        Ok(())
    }
}

pub fn init_system_volume_listener(app: AppHandle) {
    #[cfg(windows)]
    {
        use crate::infrastructure::media::system_volume::{native, next_volume};
        use windows::Win32::Media::Audio::Endpoints::{IAudioEndpointVolume, IAudioEndpointVolumeCallback};
        let (sender, receiver) = std::sync::mpsc::channel();
        let _ = VOLUME_KEYS.set(sender);
        let _ = std::thread::Builder::new().name("prisma-system-volume".into()).spawn(move || {
            let Ok(_com) = crate::infrastructure::windows_com::ComApartment::multithreaded() else { return; };
            VOLUME_WORKER_READY.store(true, Ordering::Relaxed);
            let callback: IAudioEndpointVolumeCallback = NativeVolumeChangeCallback {
                app: app.clone(), last_volume: Mutex::new(None),
            }.into();
            let mut bound: Option<(String, IAudioEndpointVolume)> = None;
            let mut refreshed = std::time::Instant::now() - std::time::Duration::from_secs(1);
            loop {
                // Rebind after a default-device change or a disconnected endpoint.
                if refreshed.elapsed() >= std::time::Duration::from_millis(500) {
                    refreshed = std::time::Instant::now();
                    let next = native::default_endpoint().ok();
                    if bound.as_ref().map(|v| &v.0) != next.as_ref().map(|v| &v.0) {
                        if let Some((_, old)) = bound.take() {
                            unsafe { let _ = old.UnregisterControlChangeNotify(&callback); }
                        }
                        if let Some((id, endpoint)) = next {
                            if unsafe { endpoint.RegisterControlChangeNotify(&callback) }.is_ok() {
                                bound = Some((id, endpoint));
                                if let Ok(volume) = native::read() { publish_volume(&app, volume, false); }
                            }
                        }
                    }
                }
                match receiver.recv_timeout(std::time::Duration::from_millis(100)) {
                    Ok(VolumeCommand::Key(key)) => {
                        #[cfg(debug_assertions)]
                        eprintln!("[Flyout] Pulsación capturada: {key:?}");
                        if let Ok(current) = native::read() {
                            let next = next_volume(current, key);
                            let at_limit = matches!(key, VolumeKey::Up) && current.volume >= 100.0
                                || matches!(key, VolumeKey::Down) && current.volume <= 0.0;
                            match native::write(next.volume, Some(next.is_muted)) {
                                Ok(actual) => {
                                    publish_volume(&app, actual, false);
                                    let _ = show_from_app_with_feedback(&app, at_limit);
                                },
                                Err(error) => eprintln!("[Flyout] No se pudo ajustar el volumen: {error}"),
                            }
                        }
                    }
                    Ok(VolumeCommand::Set { volume, muted, reply }) => {
                        let result = native::write(volume, muted);
                        if let Ok(actual) = result.as_ref() { publish_volume(&app, *actual, false); }
                        let _ = reply.send(result);
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {},
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                        VOLUME_WORKER_READY.store(false, Ordering::Relaxed);
                        break;
                    },
                }
            }
        });
        crate::infrastructure::media::volume_keys::start(handle_volume_key);
    }
    #[cfg(not(windows))]
    { let _ = app; }
}
