use std::sync::Mutex;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewWindow};

static LAST_ZONE: Mutex<Option<String>> = Mutex::new(None);
static LAST_SIZE: Mutex<(f64, f64)> = Mutex::new((380.0, 160.0));

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
    let _ = window.set_size(LogicalSize::new(width, height));
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

    let mut current_size = LAST_SIZE.lock().unwrap();
    if let (Some(w), Some(h)) = (width, height) {
        *current_size = (w, h);
    }
    let (w, h) = *current_size;

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
    
    let mut current_size = LAST_SIZE.lock().unwrap();
    if let (Some(w), Some(h)) = (width, height) {
        *current_size = (w, h);
    }
    let (w, h) = *current_size;

    let _ = position_window_inner(&win, &target_zone, w, h);

    let _ = win.show();

    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW,
        };
        if let Ok(hwnd) = win.hwnd() {
            let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0);
            unsafe {
                let _ = SetWindowPos(
                    win_hwnd,
                    HWND_TOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn flyout_hide(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("flyout") {
        win.hide().map_err(|e| e.to_string())?;
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
    flyout_show(app.clone(), None, None, None)
}

#[cfg(windows)]
pub fn get_system_master_volume() -> Option<(f32, bool)> {
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia).ok()?;
        let endpoint_volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None).ok()?;
        let vol = endpoint_volume.GetMasterVolumeLevelScalar().ok()?;
        let muted = endpoint_volume.GetMute().ok()?.as_bool();
        Some((vol, muted))
    }
}

#[cfg(not(windows))]
pub fn get_system_master_volume() -> Option<(f32, bool)> {
    None
}

#[tauri::command]
pub fn flyout_get_system_volume() -> Result<serde_json::Value, String> {
    if let Some((vol, muted)) = get_system_master_volume() {
        let vol_pct = (vol * 100.0).round() as u32;
        Ok(serde_json::json!({
            "volume": vol_pct,
            "isMuted": muted
        }))
    } else {
        Err("No se pudo obtener el volumen del sistema".to_string())
    }
}

#[cfg(windows)]
#[tauri::command]
pub fn flyout_set_system_volume(volume: f32, muted: Option<bool>) -> Result<(), String> {
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| e.to_string())?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)
            .map_err(|e| e.to_string())?;
        let endpoint_volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)
            .map_err(|e| e.to_string())?;
        let clamped = (volume / 100.0).clamp(0.0, 1.0);
        let _ = endpoint_volume.SetMasterVolumeLevelScalar(clamped, std::ptr::null());
        if let Some(m) = muted {
            use windows::Win32::Foundation::BOOL;
            let _ = endpoint_volume.SetMute(BOOL(if m { 1 } else { 0 }), std::ptr::null());
        }
        Ok(())
    }
}

#[cfg(not(windows))]
#[tauri::command]
pub fn flyout_set_system_volume(_volume: f32, _muted: Option<bool>) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
use windows::core::implement;
#[cfg(windows)]
use windows::Win32::Media::Audio::Endpoints::{
    IAudioEndpointVolume, IAudioEndpointVolumeCallback, IAudioEndpointVolumeCallback_Impl,
};
#[cfg(windows)]
use windows::Win32::Media::Audio::{
    eMultimedia, eRender, AUDIO_VOLUME_NOTIFICATION_DATA, IMMDeviceEnumerator, MMDeviceEnumerator,
};
#[cfg(windows)]
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};
use tauri::Emitter;

#[cfg(windows)]
#[implement(IAudioEndpointVolumeCallback)]
struct NativeVolumeChangeCallback {
    app: AppHandle,
}

#[cfg(windows)]
#[allow(non_snake_case)]
impl IAudioEndpointVolumeCallback_Impl for NativeVolumeChangeCallback_Impl {
    fn OnNotify(&self, pnotify: *mut AUDIO_VOLUME_NOTIFICATION_DATA) -> windows::core::Result<()> {
        if !pnotify.is_null() {
            let (vol_pct, is_muted) = unsafe {
                let data = &*pnotify;
                (
                    (data.fMasterVolume * 100.0).round() as u32,
                    data.bMuted.as_bool(),
                )
            };
            let app = self.app.clone();
            std::thread::spawn(move || {
                let _ = app.emit(
                    "prisma://system-volume-changed",
                    serde_json::json!({
                        "volume": vol_pct,
                        "isMuted": is_muted
                    }),
                );
                let _ = flyout_show_from_app(&app);
            });
        }
        Ok(())
    }
}

pub fn init_system_volume_listener(app: AppHandle) {
    #[cfg(windows)]
    {
        std::thread::Builder::new()
            .name("prisma-volume-listener".to_string())
            .spawn(move || {
                unsafe {
                    let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
                    let enumerator: Result<IMMDeviceEnumerator, _> =
                        CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);
                    if let Ok(enum_dev) = enumerator {
                        if let Ok(device) = enum_dev.GetDefaultAudioEndpoint(eRender, eMultimedia) {
                            if let Ok(endpoint_volume) =
                                device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
                            {
                                let cb_impl: IAudioEndpointVolumeCallback =
                                    NativeVolumeChangeCallback { app: app.clone() }.into();
                                if endpoint_volume.RegisterControlChangeNotify(&cb_impl).is_ok() {
                                    println!("[Flyout] Windows IAudioEndpointVolumeCallback registered successfully");
                                    loop {
                                        std::thread::park();
                                    }
                                }
                            }
                        }
                    }
                }
            })
            .ok();
    }
    #[cfg(not(windows))]
    {
        let _ = app;
    }
}

