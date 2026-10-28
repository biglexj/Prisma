//! Esperar al escritorio sin bloquear el hilo principal ni retrasar el inicio manual.
use std::{sync::atomic::{AtomicBool, Ordering}, time::{Duration, Instant}};

const STABLE_FOR: Duration = Duration::from_secs(2);
const MAX_WAIT: Duration = Duration::from_secs(15);

#[derive(Default)]
struct Stability<T> {
    previous: Option<T>,
    since: Option<Duration>,
}

impl<T: PartialEq> Stability<T> {
    fn observe(&mut self, sample: Option<T>, elapsed: Duration) -> bool {
        if sample.is_none() || sample != self.previous {
            self.since = sample.as_ref().map(|_| elapsed);
            self.previous = sample;
        }
        self.since.is_some_and(|since| elapsed.saturating_sub(since) >= STABLE_FOR)
    }
}

/// Solo se usa al restaurar automáticamente: no retiene mutexes ni HWND propios.
pub(super) fn wait_for_desktop(running: &AtomicBool) -> bool {
    let started = Instant::now();
    let mut stability = Stability::default();
    while running.load(Ordering::SeqCst) {
        let elapsed = started.elapsed();
        if stability.observe(desktop_sample(), elapsed) { return true; }
        if elapsed >= MAX_WAIT {
            eprintln!("[Fondos Vivos] El escritorio no confirmó estabilidad en 15 s; se intentará iniciar el fondo.");
            return true;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    false
}

#[cfg(windows)]
fn desktop_sample() -> Option<(isize, i32, i32, i32, i32, i32, i32)> {
    use windows::Win32::{Foundation::RECT, UI::WindowsAndMessaging::{
        GetShellWindow, GetClientRect, GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN,
    }};
    // Durante el inicio de sesión puede existir Progman con un área provisional.
    // Comparar el escritorio principal y el virtual permite detectar cambios de
    // resolución, monitores y el reemplazo del contenedor del shell.
    unsafe {
        let shell = GetShellWindow();
        if shell.is_invalid() { return None; }
        let mut rect = RECT::default();
        GetClientRect(shell, &mut rect).ok()?;
        let (width, height) = (rect.right - rect.left, rect.bottom - rect.top);
        if width <= 0 || height <= 0 || width < GetSystemMetrics(SM_CXSCREEN)
            || height < GetSystemMetrics(SM_CYSCREEN) { return None; }
        let screen = super::window::ScreenGeometry::current();
        Some((shell.0 as isize, width, height, screen.x, screen.y, screen.width, screen.height))
    }
}

#[cfg(not(windows))]
fn desktop_sample() -> Option<(isize, i32, i32, i32, i32, i32, i32)> { None }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn waits_for_valid_stable_geometry() {
        let mut state = Stability::default();
        assert!(!state.observe(None, Duration::ZERO));
        assert!(!state.observe(Some(1920), Duration::from_secs(1)));
        assert!(!state.observe(Some(1920), Duration::from_secs(2)));
        assert!(!state.observe(Some(2560), Duration::from_secs(3)));
        assert!(!state.observe(Some(2560), Duration::from_secs(4)));
        assert!(state.observe(Some(2560), Duration::from_secs(5)));
    }
    #[test]
    fn losing_the_shell_resets_stability() {
        let mut state = Stability::default();
        state.observe(Some(1920), Duration::ZERO);
        assert!(!state.observe(None, Duration::from_secs(2)));
        assert!(!state.observe(Some(1920), Duration::from_secs(3)));
        assert!(!state.observe(Some(1920), Duration::from_secs(4)));
        assert!(state.observe(Some(1920), Duration::from_secs(5)));
    }
    #[test]
    fn shutdown_cancels_wait_without_delay() {
        assert!(!wait_for_desktop(&AtomicBool::new(false)));
    }
}
