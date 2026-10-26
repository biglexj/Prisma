//! Prueba local optativa con perfiles aislados. No modifica la sesión del usuario.
use super::{sources::MediaKindMode, WallpaperController};
use std::{path::Path, time::Duration};
use tauri::{AppHandle, Manager};

pub fn prepare(controller: &WallpaperController, root: &Path) -> Result<(), String> {
    controller.add_folder(root.join("media").to_str().ok_or("Ruta de prueba inválida")?)?;
    controller.set_media_kind_mode(MediaKindMode::Image)?;
    let mut config = controller.compositor_config()?;
    config.dynamic = "borealis".into();
    controller.set_compositor_config(config)?;
    let mut inner = controller.inner.lock().map_err(|e| e.to_string())?;
    inner.source_manager.settings_mut().is_active = true;
    inner.source_manager.save_to_disk()
}

pub fn observe(app: AppHandle, controller: WallpaperController, root: std::path::PathBuf, is_dev: bool) {
    std::thread::spawn(move || {
        let role = if is_dev { "dev" } else { "stable" };
        let state_path = root.join(format!("{role}-state.json"));
        while controller.handoff.running.load(std::sync::atomic::Ordering::SeqCst) {
            if let Ok(state) = controller.get_state() {
                let guarded = if state.control_blocked { controller.start().is_err() } else { true };
                let value = serde_json::json!({
                    "pid": std::process::id(), "state": state, "blockedCommandRejected": guarded,
                    "compositionWindow": app.get_webview_window(super::compositor::COMPOSITOR_LABEL).is_some(),
                });
                let _ = std::fs::write(&state_path, serde_json::to_vec(&value).unwrap());
            }
            if root.join(format!("{role}-exit")).exists() { app.exit(0); break; }
            std::thread::sleep(Duration::from_millis(200));
        }
    });
}
