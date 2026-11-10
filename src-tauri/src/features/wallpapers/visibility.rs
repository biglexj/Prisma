//! Pausa temporal cuando la aplicación activa cubre su monitor.
pub(super) fn desktop_covered() -> bool {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::{Foundation::RECT, Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST}, UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect, GetClassNameW, IsIconic, IsWindowVisible, IsZoomed}};
        let window = GetForegroundWindow();
        if window.is_invalid() || IsIconic(window).as_bool() || !IsWindowVisible(window).as_bool() { return false; }
        let mut name = [0u16; 128];
        let count = GetClassNameW(window, &mut name);
        let name = String::from_utf16_lossy(&name[..count.max(0) as usize]);
        if matches!(name.as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd" | "PrismaDesktopWallpaperHost") { return false; }
        if IsZoomed(window).as_bool() { return true; }
        let mut rect = RECT::default();
        if GetWindowRect(window, &mut rect).is_err() { return false; }
        let mut monitor = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
        if !GetMonitorInfoW(MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST), &mut monitor).as_bool() { return false; }
        covers((rect.left, rect.top, rect.right, rect.bottom), (monitor.rcMonitor.left, monitor.rcMonitor.top, monitor.rcMonitor.right, monitor.rcMonitor.bottom))
    }
    #[cfg(not(windows))]
    { false }
}

fn covers(window: (i32,i32,i32,i32), monitor: (i32,i32,i32,i32)) -> bool {
    window.0 <= monitor.0 && window.1 <= monitor.1 && window.2 >= monitor.2 && window.3 >= monitor.3
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fullscreen_and_borderless_cover_monitor_but_small_windows_do_not() {
        let screen = (-1920,0,0,1080);
        assert!(covers(screen, screen));
        assert!(covers((-1928,-8,8,1088), screen));
        assert!(!covers((-1800,50,-200,1000), screen));
        assert!(!covers((0,0,1920,1080), screen));
    }
}
