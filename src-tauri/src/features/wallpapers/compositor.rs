//! Superficie transparente sobre el medio base y debajo de los iconos.
use tauri::{AppHandle, Manager};
use super::composition_settings::{LayerControls, LayerVisibility, ParallaxSettings, OverlayParticles, valid_scene, validate_controls, valid_color};

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
    #[serde(default = "no_particles")]
    pub particle: String,
    #[serde(default)]
    pub controls: std::collections::BTreeMap<String, LayerControls>,
    #[serde(default)]
    pub visibility: LayerVisibility,
    #[serde(default)]
    pub parallax: ParallaxSettings,
    #[serde(default = "no_particles")]
    pub dynamic: String,
    #[serde(default)]
    pub overlay: OverlayParticles,
    #[serde(default = "default_color")]
    pub ambient_color: String,
    #[serde(default = "default_color2")]
    pub ambient_color2: String,
    #[serde(default = "full_opacity")]
    pub ambient_opacity: f32,
}

fn no_particles() -> String { "none".into() }
fn default_color() -> String { "#263b62".into() }
fn default_color2() -> String { "#703ca5".into() }
fn full_opacity() -> f32 { 1.0 }

impl Default for CompositorConfig {
    fn default() -> Self {
        Self { scenario: "none".into(), ambient: "original".into(), intensity: 0.5,
            audio_level: 0.0, paused: false, enabled: false, particle: no_particles(),
            controls: Default::default(), visibility: Default::default(), parallax: Default::default(),
            dynamic:no_particles(), overlay:Default::default(), ambient_color:default_color(), ambient_color2:default_color2(), ambient_opacity:1.0 }
    }
}

impl CompositorConfig {
    pub fn migrate_layers(&mut self) {
        // La galería canónica elige un escenario. Evitar que perfiles de la UI
        // anterior sigan renderizando escenarios adicionales ocultos a la vez.
        if self.scenario != "none" { self.dynamic="none".into(); self.particle="none".into(); }
        else if self.dynamic != "none" { self.particle="none".into(); }
        let prefix=match super::composition_settings::scene_category(&self.scenario) {
            Some("dynamic") if self.dynamic=="none" => { self.dynamic=self.scenario.clone(); "dynamic:" },
            Some("particles") if self.particle=="none" => { self.particle=self.scenario.clone(); "particles:" },
            _=>return,
        };
        if let Some(value)=self.controls.remove(&format!("scene:{}",self.scenario)) {
            self.controls.insert(format!("{prefix}{}",self.scenario),value);
        }
        self.scenario="none".into();
    }
    pub fn validate(&self) -> Result<(), String> {
        if !valid_scene(&self.scenario) || !valid_scene(&self.particle) || !valid_scene(&self.dynamic) {
            return Err("Escenario no disponible en esta entrega".into());
        }
        if !["original", "violet", "warm", "bio", "deep", "stars", "solid", "gradient"].contains(&self.ambient.as_str()) {
            return Err("Ambiente no disponible".into());
        }
        if !self.intensity.is_finite() || !(0.0..=1.0).contains(&self.intensity) {
            return Err("La intensidad debe estar entre 0 y 1".into());
        }
        validate_controls(&self.controls)?;
        self.overlay.validate()?;
        if !valid_color(&self.ambient_color) || !valid_color(&self.ambient_color2)
            || !self.ambient_opacity.is_finite() || !(0.0..=1.0).contains(&self.ambient_opacity) { return Err("Color de ambiente no válido".into()); }
        if !self.parallax.strength.is_finite() || !(0.0..=2.0).contains(&self.parallax.strength) {
            return Err("Intensidad de parallax fuera de rango".into());
        }
        Ok(())
    }

    pub fn has_layers(&self) -> bool {
        (self.visibility.ambient && self.ambient!="original") || (self.visibility.dynamic && self.dynamic!="none")
            || (self.visibility.scenario && self.scenario!="none") || (self.visibility.particles && self.particle!="none")
            || self.overlay.enabled || self.parallax.enabled
    }
}

pub fn raise(app:&AppHandle) {
    let handle=app.clone();
    let _=app.run_on_main_thread(move||{
        #[cfg(windows)]
        if let Some(window)=handle.get_webview_window(COMPOSITOR_LABEL) {
            if let Ok(raw)=window.hwnd() {
                use windows::Win32::{Foundation::HWND,UI::WindowsAndMessaging::{SetWindowPos,HWND_TOP,SWP_NOMOVE,SWP_NOSIZE,SWP_NOACTIVATE}};
                let _=unsafe{SetWindowPos(HWND(raw.0 as *mut _),HWND_TOP,0,0,0,0,SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE)};
            }
        }
    });
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
            // Sincronizar la visibilidad de la ventana y del controlador WebView2,
            // además de mostrar el HWND al alojarlo en el escritorio.
            window.show().map_err(|e| e.to_string())?;
            window.as_ref().show().map_err(|e| e.to_string())?;
            #[cfg(debug_assertions)]
            window.with_webview(|webview| unsafe {
                let mut visible = Default::default();
                if webview.controller().IsVisible(&mut visible).is_ok() {
                    eprintln!("[Fondos Vivos] Superficie WebView2 visible: {}", visible.as_bool());
                }
            }).map_err(|e| e.to_string())?;
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
        assert_eq!(restored.scenario, "none");
        assert_eq!(restored.dynamic, "borealis");
        assert_eq!(restored.ambient, "bio");
        assert!(!restored.enabled);
        assert!(!restored.paused);
        assert_eq!(restored.audio_level, 0.0);
    }

    #[test]
    fn layer_parameters_are_validated_and_round_trip_independently() {
        let mut config = CompositorConfig::default();
        config.scenario = "gargantua".into();
        config.particle = "nebula".into();
        let mut scene = LayerControls::default();
        scene.speed = 1.8;
        let mut particles = LayerControls::default();
        particles.speed = 0.2;
        particles.paused = true;
        config.controls.insert("scene:gargantua".into(), scene);
        config.controls.insert("particles:nebula".into(), particles);
        config.parallax.enabled = true;
        assert!(config.validate().is_ok());
        let restored: CompositorConfig = serde_json::from_str(&serde_json::to_string(&config).unwrap()).unwrap();
        assert_eq!(restored.controls["scene:gargantua"].speed, 1.8);
        assert_eq!(restored.controls["particles:nebula"].speed, 0.2);
        assert!(restored.controls["particles:nebula"].paused);
        config.controls.get_mut("scene:gargantua").unwrap().zoom = f32::INFINITY;
        assert!(config.validate().is_err());
    }

    #[test]
    fn legacy_composition_loads_with_independent_layers_enabled() {
        let old = r#"{"scenario":"cybercity","ambient":"original","intensity":0.5,"audioLevel":0,"paused":false}"#;
        let config: CompositorConfig = serde_json::from_str(old).unwrap();
        assert!(config.validate().is_ok());
        assert_eq!(config.particle, "none");
        assert!(config.visibility.scenario);
        assert!(!config.parallax.enabled);
    }

    #[test]
    fn legacy_scene_moves_to_its_own_layer_with_saved_controls() {
        let mut config=CompositorConfig::default();
        config.scenario="nebula".into();
        let mut controls=LayerControls::default();controls.speed=1.7;
        config.controls.insert("scene:nebula".into(),controls);
        config.migrate_layers();
        assert_eq!(config.scenario,"none");
        assert_eq!(config.particle,"nebula");
        assert_eq!(config.controls["particles:nebula"].speed,1.7);
        config.migrate_layers();
        assert_eq!(config.particle,"nebula");
    }

    #[test]
    fn old_multi_scenario_profile_keeps_the_visible_selection_only() {
        let mut config=CompositorConfig::default();
        config.scenario="gargantua".into();config.dynamic="borealis".into();config.particle="nebula".into();
        config.migrate_layers();
        assert_eq!(config.scenario,"gargantua");assert_eq!(config.dynamic,"none");assert_eq!(config.particle,"none");
    }

    #[test]
    fn ambient_and_overlay_are_valid_without_a_scenario() {
        let mut config=CompositorConfig::default();
        assert!(!config.has_layers());
        config.ambient="solid".into();config.ambient_opacity=0.5;
        assert!(config.has_layers());assert!(config.validate().is_ok());
        config.ambient="original".into();config.overlay.enabled=true;
        assert!(config.has_layers());assert!(config.validate().is_ok());
        config.overlay.shape="invalid".into();assert!(config.validate().is_err());
        config.overlay.shape="snow".into();config.ambient_color="url(...)".into();
        assert!(config.validate().is_err());
    }
}
