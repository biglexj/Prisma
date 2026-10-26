use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LayerControls {
    pub motion: String,
    pub view: String,
    pub speed: f32,
    pub zoom: f32,
    pub pan_x: f32,
    pub pan_y: f32,
    pub yaw: f32,
    pub pitch: f32,
    pub paused: bool,
    pub color_cycle: bool,
    pub quality: u8,
}

impl Default for LayerControls {
    fn default() -> Self {
        Self { motion: "spinAxis".into(), view: "front".into(), speed: 0.5, zoom: 1.0,
            pan_x: 0.0, pan_y: 0.0, yaw: 0.0, pitch: 0.0, paused: false, color_cycle: false, quality: 1 }
    }
}

impl LayerControls {
    pub fn validate(&self) -> Result<(), String> {
        if !["none", "spinAxis", "auto", "cam360", "leftright", "updown", "random"].contains(&self.motion.as_str())
            || !["front", "top", "bottom", "corner"].contains(&self.view.as_str()) || self.quality > 2 {
            return Err("Control de cámara o calidad no válido".into());
        }
        for (value, min, max) in [(self.speed, 0.1, 3.0), (self.zoom, 0.1, 2.5),
            (self.pan_x, -10.0, 10.0), (self.pan_y, -10.0, 10.0),
            (self.yaw, -180.0, 180.0), (self.pitch, -80.0, 80.0)] {
            if !value.is_finite() || !(min..=max).contains(&value) {
                return Err("Un ajuste de capa está fuera de rango".into());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct LayerVisibility {
    pub ambient: bool,
    pub dynamic: bool,
    pub scenario: bool,
    pub particles: bool,
}
impl Default for LayerVisibility {
    fn default() -> Self { Self { ambient: true, dynamic:true, scenario: true, particles: true } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ParallaxSettings {
    pub enabled: bool,
    pub strength: f32,
    pub base: bool,
}
impl Default for ParallaxSettings {
    fn default() -> Self { Self { enabled: false, strength: 0.5, base:true } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct OverlayParticles {
    pub enabled: bool, pub paused: bool, pub shape: String, pub direction: String,
    pub color: String, pub size: f32, pub density: f32, pub speed: f32, pub opacity: f32,
}
impl Default for OverlayParticles {
    fn default() -> Self { Self { enabled:false,paused:false,shape:"circle".into(),direction:"float".into(),
        color:"#b8efff".into(),size:1.0,density:1.0,speed:1.0,opacity:1.0 } }
}
impl OverlayParticles {
    pub fn validate(&self) -> Result<(), String> {
        if !["tech","circle","star","heart","square","diamond","sparkle","ripple","digits","bubble","petal","note","snow"].contains(&self.shape.as_str())
            || !["up","down","float"].contains(&self.direction.as_str()) || !valid_color(&self.color) { return Err("Partículas superpuestas no válidas".into()); }
        for (n,min,max) in [(self.size,0.25,4.0),(self.density,0.1,3.0),(self.speed,0.1,3.0),(self.opacity,0.0,1.0)] {
            if !n.is_finite() || !(min..=max).contains(&n) { return Err("Parámetro de partículas fuera de rango".into()); }
        }
        Ok(())
    }
}
pub fn valid_color(color: &str) -> bool {
    color.len()==7 && color.starts_with('#') && color.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}

#[derive(Deserialize)]
struct SceneEntry { r#type: String, category:String }
static CATALOG: std::sync::LazyLock<Vec<SceneEntry>> = std::sync::LazyLock::new(|| {
    serde_json::from_str(include_str!("../../../../src/features/wallpapers/compositor/catalog.json"))
        .expect("El catálogo de efectos debe ser JSON válido")
});
pub fn scene_category(value:&str) -> Option<&'static str> {
    CATALOG.iter().find(|item|item.r#type==value).map(|item|item.category.as_str())
}

pub fn valid_scene(value: &str) -> bool {
    if value == "none" { return true; }
    CATALOG.iter().any(|item| item.r#type == value)
}

pub fn validate_controls(controls: &BTreeMap<String, LayerControls>) -> Result<(), String> {
    if controls.len() > 64 { return Err("Demasiados controles de capas".into()); }
    for (key, value) in controls {
        let valid = key == "ambient" || key.strip_prefix("scene:").or_else(|| key.strip_prefix("dynamic:")).or_else(|| key.strip_prefix("particles:"))
            .is_some_and(valid_scene);
        if !valid { return Err("Efecto no reconocido en los controles".into()); }
        value.validate()?;
    }
    Ok(())
}
