use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

static GENERATION: AtomicU64 = AtomicU64::new(0);
const LABEL: &str = "mobile-audio-toast";

/// A desktop OSD, matching the in-app message without activating another window.
pub(super) fn show(app: &AppHandle, message: String) {
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if GENERATION.load(Ordering::SeqCst) != generation { return; }
        let encoded = serde_json::to_string(&message).unwrap_or_default();
        let window = if let Some(window) = handle.get_webview_window(LABEL) {
            let script = format!("window.__audioToast={encoded};window.dispatchEvent(new Event('audio-toast'));");
            let _ = window.eval(&script);
            window
        } else {
            match WebviewWindowBuilder::new(&handle, LABEL, WebviewUrl::App("audio-toast.html".into()))
                .title("Prisma · Audio al teléfono").inner_size(480.0, 100.0)
                .decorations(false).transparent(true).shadow(false).resizable(false)
                .always_on_top(true).skip_taskbar(true).focused(false).focusable(false).visible(false)
                .initialization_script(format!("window.__audioToast={encoded};"))
                .build() {
                    Ok(window) => window,
                    Err(error) => { eprintln!("Audio OSD: {error}"); return; }
                }
        };
        let monitor = handle.get_webview_window("main")
            .and_then(|main| main.current_monitor().ok().flatten())
            .or_else(|| window.primary_monitor().ok().flatten());
        if let Some(monitor) = monitor {
            let scale = monitor.scale_factor();
            let width = (480.0 * scale).round() as i32;
            let _ = window.set_position(tauri::PhysicalPosition::new(
                monitor.position().x + (monitor.size().width as i32 - width) / 2,
                monitor.position().y + (12.0 * scale).round() as i32,
            ));
        }
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.show();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(2200));
            let timer_handle = handle.clone();
            let _ = handle.run_on_main_thread(move || {
                if GENERATION.load(Ordering::SeqCst) == generation {
                    if let Some(window) = timer_handle.get_webview_window(LABEL) { let _ = window.hide(); }
                }
            });
        });
    });
}
