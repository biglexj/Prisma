#[cfg(windows)]
use windows::Win32::Foundation::{BOOL, HWND, LPARAM, POINT, RECT};
#[cfg(windows)]
use windows::Win32::Graphics::Dwm::{
    DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    ChildWindowFromPointEx, EnumWindows, GetClassNameW, GetWindowLongW,
    GetWindowRect, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    IsIconic, IsWindowVisible, CWP_SKIPINVISIBLE, CWP_SKIPTRANSPARENT, GWL_EXSTYLE,
    WS_EX_TRANSPARENT,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedTarget {
    pub id: String,
    pub title: String,
    pub class_name: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub is_child: bool,
}

#[cfg(windows)]
pub fn enumerate_visible_windows() -> Vec<DetectedTarget> {
    use std::sync::Mutex;
    static DETECTED: Mutex<Vec<DetectedTarget>> = Mutex::new(Vec::new());

    if let Ok(mut lock) = DETECTED.lock() {
        lock.clear();
    }

    let current_pid = std::process::id();

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let current_pid = lparam.0 as u32;

        unsafe {
            if !IsWindowVisible(hwnd).as_bool() || IsIconic(hwnd).as_bool() {
                return BOOL(1);
            }

            let mut pid: u32 = 0;
            let _ = GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == current_pid {
                // Ignorar ventanas pertenecientes al proceso de Prisma (overlay, main, flyout, editor)
                return BOOL(1);
            }

            // Verificar si la ventana está oculta por DWM (UWP suspendidas, escritorios virtuales)
            let mut cloaked: u32 = 0;
            let dwm_cloaked_res = DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED,
                &mut cloaked as *mut _ as _,
                std::mem::size_of::<u32>() as u32,
            );
            if dwm_cloaked_res.is_ok() && cloaked != 0 {
                return BOOL(1);
            }

            let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
            if (ex_style & WS_EX_TRANSPARENT.0) != 0 {
                return BOOL(1);
            }

            // Obtener límites geométricos exactos mediante DWM (excluye sombras invisibles de Windows 10/11)
            let mut rect = RECT::default();
            let dwm_rect_res = DwmGetWindowAttribute(
                hwnd,
                DWMWA_EXTENDED_FRAME_BOUNDS,
                &mut rect as *mut _ as _,
                std::mem::size_of::<RECT>() as u32,
            );
            if dwm_rect_res.is_err() {
                let _ = GetWindowRect(hwnd, &mut rect);
            }

            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;

            // Descartar ventanas invisibles o de 0 dimensiones
            if width <= 8 || height <= 8 {
                return BOOL(1);
            }

            let title_len = GetWindowTextLengthW(hwnd);
            let mut title_buf = vec![0u16; (title_len + 1) as usize];
            let copied = GetWindowTextW(hwnd, &mut title_buf);
            let title = String::from_utf16_lossy(&title_buf[..copied as usize]);

            let mut class_buf = [0u16; 256];
            let class_copied = GetClassNameW(hwnd, &mut class_buf);
            let class_name = String::from_utf16_lossy(&class_buf[..class_copied as usize]);

            if let Ok(mut list) = DETECTED.lock() {
                list.push(DetectedTarget {
                    id: format!("{:?}", hwnd.0),
                    title,
                    class_name,
                    x: rect.left,
                    y: rect.top,
                    width,
                    height,
                    is_child: false,
                });
            }

            BOOL(1)
        }
    }

    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(current_pid as usize as _));
    }

    if let Ok(lock) = DETECTED.lock() {
        lock.clone()
    } else {
        Vec::new()
    }
}

#[cfg(not(windows))]
pub fn enumerate_visible_windows() -> Vec<DetectedTarget> {
    Vec::new()
}

/// Detecta subelementos o controles anidados bajo el punto del cursor (x, y) en coordenadas virtuales.
#[cfg(windows)]
pub fn detect_subregions_at(
    parent_x: i32,
    parent_y: i32,
    screen_x: i32,
    screen_y: i32,
) -> Option<DetectedTarget> {
    unsafe {
        let pt = POINT {
            x: screen_x,
            y: screen_y,
        };
        let hwnd_parent = windows::Win32::UI::WindowsAndMessaging::WindowFromPoint(pt);
        if hwnd_parent.0.is_null() {
            return None;
        }

        let mut pid: u32 = 0;
        let _ = GetWindowThreadProcessId(hwnd_parent, Some(&mut pid));
        if pid == std::process::id() {
            return None;
        }

        // Buscar control o elemento hijo directo en ese punto
        let pt_client = POINT {
            x: screen_x - parent_x,
            y: screen_y - parent_y,
        };
        let child_hwnd = ChildWindowFromPointEx(
            hwnd_parent,
            pt_client,
            CWP_SKIPINVISIBLE | CWP_SKIPTRANSPARENT,
        );

        if !child_hwnd.0.is_null() && child_hwnd != hwnd_parent {
            let mut child_rect = RECT::default();
            if GetWindowRect(child_hwnd, &mut child_rect).is_ok() {
                let w = child_rect.right - child_rect.left;
                let h = child_rect.bottom - child_rect.top;
                if w > 12 && h > 12 {
                    let mut class_buf = [0u16; 128];
                    let class_copied = GetClassNameW(child_hwnd, &mut class_buf);
                    let class_name = String::from_utf16_lossy(&class_buf[..class_copied as usize]);

                    return Some(DetectedTarget {
                        id: format!("{:?}", child_hwnd.0),
                        title: "Región Interna".to_string(),
                        class_name,
                        x: child_rect.left,
                        y: child_rect.top,
                        width: w,
                        height: h,
                        is_child: true,
                    });
                }
            }
        }
    }
    None
}

#[cfg(not(windows))]
pub fn detect_subregions_at(_parent_x: i32, _parent_y: i32, _screen_x: i32, _screen_y: i32) -> Option<DetectedTarget> {
    None
}
