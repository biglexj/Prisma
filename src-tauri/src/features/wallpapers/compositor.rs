//! Superficie transparente sobre el medio base y debajo de los iconos.
use tauri::{AppHandle, Manager};

pub const COMPOSITOR_LABEL: &str = "wallpaper-compositor";
pub const COMPOSITOR_EVENT: &str = "prisma://compositor-config";

pub fn create_host(app: &AppHandle) -> Result<super::window::DesktopWallpaperWindow, String> {
    let (sender, receiver) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = sender.send(super::window::DesktopWallpaperWindow::create());
    }).map_err(|e| e.to_string())?;
    receiver.recv().map_err(|e| e.to_string())?
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompositorConfig {
    pub scenario: String,
    pub ambient: String,
    pub intensity: f32,
    pub audio_level: f32,
    pub paused: bool,
    #[serde(default)]
    pub enabled: bool,
}

impl Default for CompositorConfig {
    fn default() -> Self {
        Self { scenario: "prisma".into(), ambient: "original".into(), intensity: 0.5,
            audio_level: 0.0, paused: false, enabled: false }
    }
}

impl CompositorConfig {
    pub fn validate(&self) -> Result<(), String> {
        if !["none", "prisma", "borealis", "cybercity"].contains(&self.scenario.as_str()) {
            return Err("Escenario no disponible en esta entrega".into());
        }
        if !["original", "violet", "warm", "bio", "deep", "stars"].contains(&self.ambient.as_str()) {
            return Err("Ambiente no disponible".into());
        }
        if !self.intensity.is_finite() || !(0.0..=1.0).contains(&self.intensity) {
            return Err("La intensidad debe estar entre 0 y 1".into());
        }
        Ok(())
    }
}

// Se llama desde spawn_blocking. Crear y alojar el webview corresponde al hilo UI;
// un comando síncrono que espere ese mismo hilo produciría un interbloqueo.
#[cfg(windows)]
pub fn create(app: &AppHandle, parent: isize, width: u32, height: u32) -> Result<(), String> {
    let handle = app.clone();
    let (sender, receiver) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        use tauri::{WebviewUrl, WebviewWindowBuilder};
        use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::{
            GetWindowLongPtrW, SetParent, SetWindowLongPtrW, SetWindowPos, HWND_TOP,
            GWL_STYLE, SWP_NOACTIVATE, SWP_SHOWWINDOW, WS_CHILD, WS_POPUP,
        }};
        let result = (|| -> Result<(), String> {
            let window = if let Some(existing) = handle.get_webview_window(COMPOSITOR_LABEL) {
                existing
            } else {
                WebviewWindowBuilder::new(&handle, COMPOSITOR_LABEL, WebviewUrl::App("compositor.html".into()))
                    .title("Prisma · Fondos Aurora").decorations(false).transparent(true)
                    .shadow(false).resizable(false).skip_taskbar(true).focused(false)
                    .focusable(false).visible(false).build().map_err(|e| e.to_string())?
            };
            window.set_ignore_cursor_events(true).map_err(|e| e.to_string())?;
            let raw = window.hwnd().map_err(|e| e.to_string())?;
            let hwnd = HWND(raw.0 as *mut std::ffi::c_void);
            unsafe {
                let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
                SetWindowLongPtrW(hwnd, GWL_STYLE, (style & !(WS_POPUP.0 as isize)) | WS_CHILD.0 as isize);
                SetParent(hwnd, HWND(parent as *mut std::ffi::c_void)).map_err(|e| e.to_string())?;
                SetWindowPos(hwnd, HWND_TOP, 0, 0, width as i32, height as i32,
                    SWP_SHOWWINDOW | SWP_NOACTIVATE).map_err(|e| e.to_string())?;
            }
            Ok(())
        })();
        if result.is_err() { destroy(&handle); }
        let _ = sender.send(result);
    }).map_err(|e| e.to_string())?;
    receiver.recv().map_err(|e| e.to_string())?
}

#[cfg(not(windows))]
pub fn create(_: &AppHandle, _: isize, _: u32, _: u32) -> Result<(), String> {
    Err("La composición de escritorio requiere Windows".into())
}

pub fn push_config(app: &AppHandle, config: &CompositorConfig) {
    use tauri::Emitter;
    let _ = app.emit_to(COMPOSITOR_LABEL, COMPOSITOR_EVENT, config);
}

pub fn destroy(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(COMPOSITOR_LABEL) {
        let _ = window.destroy();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn config_rejects_unknown_scenes_and_invalid_intensity() {
        let mut config = CompositorConfig::default();
        assert!(config.validate().is_ok());
        config.scenario = "../../scene".into();
        assert!(config.validate().is_err());
        config.scenario = "none".into();
        config.intensity = f32::NAN;
        assert!(config.validate().is_err());
    }
    #[test]
    fn config_uses_frontend_camel_case_contract() {
        let json = serde_json::to_value(CompositorConfig::default()).unwrap();
        assert!(json.get("audioLevel").is_some());
        assert!(json.get("audio_level").is_none());
    }

    #[test]
    fn selection_persists_without_restoring_runtime_flags() {
        use crate::features::wallpapers::WallpaperController;
        let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let root = std::env::temp_dir().join(format!("prisma-compositor-{stamp}"));
        let controller = WallpaperController::new(root.clone());
        let mut config = CompositorConfig::default();
        config.scenario = "borealis".into();
        config.ambient = "bio".into();
        config.enabled = true;
        config.paused = true;
        config.audio_level = 0.8;
        controller.set_compositor_config(config).unwrap();
        let restored = WallpaperController::new(root).compositor_config().unwrap();
        assert_eq!(restored.scenario, "borealis");
        assert_eq!(restored.ambient, "bio");
        assert!(!restored.enabled);
        assert!(!restored.paused);
        assert_eq!(restored.audio_level, 0.0);
    }
}
