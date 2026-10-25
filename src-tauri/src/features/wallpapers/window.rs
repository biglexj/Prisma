#[cfg(windows)]
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(windows)]
use windows::{
    core::{w, PCWSTR},
    Win32::{
        Foundation::{BOOL, HWND, LPARAM, LRESULT, WPARAM},
        Graphics::Gdi::HBRUSH,
        System::LibraryLoader::GetModuleHandleW,
        UI::WindowsAndMessaging::{
            CreateWindowExW, DefWindowProcW, DestroyWindow, EnumChildWindows, EnumWindows,
            FindWindowExW, FindWindowW, GetClassNameW, GetSystemMetrics, RegisterClassW,
            SendMessageTimeoutW, SetWindowPos, ShowWindow, CS_HREDRAW, CS_VREDRAW,
            SMTO_NORMAL, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
            SM_YVIRTUALSCREEN, SWP_NOACTIVATE, SWP_NOZORDER, SWP_SHOWWINDOW, SW_HIDE, SW_SHOW,
            WINDOW_EX_STYLE, WNDCLASSW, WS_CHILD, WS_CLIPCHILDREN,
            WS_CLIPSIBLINGS, WS_EX_NOACTIVATE, WS_EX_NOREDIRECTIONBITMAP, WS_EX_TOOLWINDOW,
            WS_VISIBLE,
        },
    },
};

static CLASS_REGISTERED: AtomicBool = AtomicBool::new(false);
const WALLPAPER_CLASS_NAME: PCWSTR = w!("PrismaDesktopWallpaperHost");

#[derive(Debug, Clone, Copy)]
pub struct ScreenGeometry {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

impl ScreenGeometry {
    pub fn current() -> Self {
        #[cfg(windows)]
        unsafe {
            let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            let height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
            Self {
                x,
                y,
                width: if width > 0 { width } else { 1920 },
                height: if height > 0 { height } else { 1080 },
            }
        }
        #[cfg(not(windows))]
        Self {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        }
    }
}

#[allow(dead_code)]
pub struct DesktopWallpaperWindow {
    #[cfg(windows)]
    pub hwnd: HWND,
    #[cfg(windows)]
    pub parent_hwnd: HWND,
}

unsafe impl Send for DesktopWallpaperWindow {}
unsafe impl Sync for DesktopWallpaperWindow {}

impl DesktopWallpaperWindow {
    #[cfg(windows)]
    pub fn create() -> Result<Self, String> {
        let parent = unsafe { find_or_spawn_desktop_host() }
            .ok_or_else(|| "No se encontró el contenedor de fondo del escritorio de Windows (WorkerW / Progman)".to_string())?;

        unsafe { register_window_class()? };

        let geo = ScreenGeometry::current();
        let hinstance = unsafe { GetModuleHandleW(None) }.map_err(|e| e.to_string())?;

        let style = WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | WS_CLIPCHILDREN;
        let ex_style = WINDOW_EX_STYLE(
            WS_EX_NOREDIRECTIONBITMAP.0 | WS_EX_TOOLWINDOW.0 | WS_EX_NOACTIVATE.0,
        );

        let hwnd = unsafe {
            CreateWindowExW(
                ex_style,
                WALLPAPER_CLASS_NAME,
                w!("PrismaWallpaperHost"),
                style,
                geo.x,
                geo.y,
                geo.width,
                geo.height,
                parent,
                None,
                hinstance,
                None,
            )
        }
        .map_err(|e| format!("Error al crear la ventana de fondo: {e}"))?;

        unsafe {
            let _ = ShowWindow(hwnd, SW_SHOW);
            let _ = SetWindowPos(
                hwnd,
                HWND::default(),
                geo.x,
                geo.y,
                geo.width,
                geo.height,
                SWP_SHOWWINDOW,
            );
            let _ = windows::Win32::UI::WindowsAndMessaging::BringWindowToTop(hwnd);
        }

        Ok(Self {
            hwnd,
            parent_hwnd: parent,
        })
    }

    #[cfg(not(windows))]
    pub fn create() -> Result<Self, String> {
        Err("Los fondos de escritorio vivos solo están soportados en Windows".to_string())
    }

    pub fn raw_handle(&self) -> i64 {
        #[cfg(windows)]
        {
            self.hwnd.0 as i64
        }
        #[cfg(not(windows))]
        0
    }

    #[allow(dead_code)]
    pub fn resize_to_desktop(&self) {
        #[cfg(windows)]
        unsafe {
            let geo = ScreenGeometry::current();
            let _ = SetWindowPos(
                self.hwnd,
                HWND::default(),
                geo.x,
                geo.y,
                geo.width,
                geo.height,
                SWP_NOZORDER | SWP_NOACTIVATE,
            );
        }
    }

    #[allow(dead_code)]
    pub fn hide(&self) {
        #[cfg(windows)]
        unsafe {
            let _ = ShowWindow(self.hwnd, SW_HIDE);
        }
    }

    #[allow(dead_code)]
    pub fn show(&self) {
        #[cfg(windows)]
        unsafe {
            let _ = ShowWindow(self.hwnd, SW_SHOW);
        }
    }
}

impl Drop for DesktopWallpaperWindow {
    fn drop(&mut self) {
        #[cfg(windows)]
        unsafe {
            if !self.hwnd.is_invalid() {
                let _ = ShowWindow(self.hwnd, SW_HIDE);
                let _ = DestroyWindow(self.hwnd);
            }
        }
    }
}

#[cfg(windows)]
unsafe fn register_window_class() -> Result<(), String> {
    if CLASS_REGISTERED.load(Ordering::Acquire) {
        return Ok(());
    }

    let hinstance = unsafe { GetModuleHandleW(None) }.map_err(|e| e.to_string())?;

    let wnd_class = WNDCLASSW {
        style: CS_HREDRAW | CS_VREDRAW,
        lpfnWndProc: Some(wallpaper_wnd_proc),
        cbClsExtra: 0,
        cbWndExtra: 0,
        hInstance: hinstance.into(),
        hIcon: windows::Win32::UI::WindowsAndMessaging::HICON::default(),
        hCursor: windows::Win32::UI::WindowsAndMessaging::HCURSOR::default(),
        hbrBackground: HBRUSH(std::ptr::null_mut()),
        lpszMenuName: PCWSTR::null(),
        lpszClassName: WALLPAPER_CLASS_NAME,
    };

    let atom = unsafe { RegisterClassW(&wnd_class) };
    if atom == 0 {
        let err = std::io::Error::last_os_error();
        if err.raw_os_error() != Some(1410) {
            return Err(format!("No se pudo registrar la clase de ventana: {err}"));
        }
    }

    CLASS_REGISTERED.store(true, Ordering::Release);
    Ok(())
}

#[cfg(windows)]
unsafe extern "system" fn wallpaper_wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        0x0014 => LRESULT(1),
        _ => unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) },
    }
}

#[cfg(windows)]
unsafe fn find_or_spawn_desktop_host() -> Option<HWND> {
    let progman = unsafe { FindWindowW(w!("Progman"), None) }.ok()?;
    if progman.is_invalid() {
        return None;
    }

    let mut res: usize = 0;
    unsafe {
        let _ = SendMessageTimeoutW(
            progman,
            0x052C,
            WPARAM(0xD),
            LPARAM(0),
            SMTO_NORMAL,
            1000,
            Some(&mut res),
        );
        let _ = SendMessageTimeoutW(
            progman,
            0x052C,
            WPARAM(0xD),
            LPARAM(1),
            SMTO_NORMAL,
            1000,
            Some(&mut res),
        );
    }

    // 1. Verificar si Progman tiene directamente un hijo WorkerW
    let mut found_worker: Option<HWND> = None;
    unsafe {
        let _ = EnumChildWindows(
            progman,
            Some(enum_progman_children),
            LPARAM(&mut found_worker as *mut _ as isize),
        );
    }

    if let Some(worker) = found_worker {
        return Some(worker);
    }

    // 2. Si no, buscar la ventana que alberga SHELLDLL_DefView y su siguiente WorkerW
    let mut target_worker: Option<HWND> = None;
    unsafe {
        let _ = EnumWindows(
            Some(enum_desktop_windows),
            LPARAM(&mut target_worker as *mut _ as isize),
        );
    }

    if let Some(worker) = target_worker {
        return Some(worker);
    }

    // 3. Fallback: usar Progman si no se separó WorkerW
    Some(progman)
}

#[cfg(windows)]
unsafe extern "system" fn enum_progman_children(child: HWND, lparam: LPARAM) -> BOOL {
    unsafe {
        let target = &mut *(lparam.0 as *mut Option<HWND>);
        let mut class_name = [0u16; 256];
        let len = GetClassNameW(child, &mut class_name);
        if len > 0 {
            let name = String::from_utf16_lossy(&class_name[..len as usize]);
            if name == "WorkerW" {
                *target = Some(child);
                return BOOL(0);
            }
        }
        BOOL(1)
    }
}

#[cfg(windows)]
unsafe extern "system" fn enum_desktop_windows(hwnd: HWND, lparam: LPARAM) -> BOOL {
    unsafe {
        let target = &mut *(lparam.0 as *mut Option<HWND>);
        let shelldll = FindWindowExW(hwnd, HWND::default(), w!("SHELLDLL_DefView"), None);
        if let Ok(sd) = shelldll {
            if !sd.is_invalid() {
                let next_worker = FindWindowExW(HWND::default(), hwnd, w!("WorkerW"), None);
                if let Ok(worker) = next_worker {
                    if !worker.is_invalid() {
                        *target = Some(worker);
                        return BOOL(0);
                    }
                }
            }
        }
        BOOL(1)
    }
}
