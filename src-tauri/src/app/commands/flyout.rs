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

    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_SHOWNOACTIVATE};
        if let Ok(hwnd) = win.hwnd() {
            let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0);
            unsafe {
                let _ = ShowWindow(win_hwnd, SW_SHOWNOACTIVATE);
            }
        } else {
            let _ = win.show();
        }
    }

    #[cfg(not(windows))]
    {
        let _ = win.show();
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
