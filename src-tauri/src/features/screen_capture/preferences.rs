use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

const DOCUMENT_VERSION: u8 = 1;

/// Atajo recomendado: no entra en conflicto con Recortes de Windows ni ShareX.
pub const DEFAULT_SHORTCUT: &str = "Shift+PrintScreen";
/// Atajo de reserva cuando el elegido está ocupado por otra aplicación.
pub const FALLBACK_SHORTCUT: &str = "Shift+PrintScreen";

/// Preferencia persistente del capturador. La fuente de verdad vive en Rust para
/// que el atajo global quede activo desde el arranque, sin depender del frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureShortcutPreferences {
    pub version: u8,
    pub enabled: bool,
    pub shortcut: String,
}

impl Default for CaptureShortcutPreferences {
    fn default() -> Self {
        Self {
            version: DOCUMENT_VERSION,
            enabled: true,
            shortcut: DEFAULT_SHORTCUT.to_string(),
        }
    }
}

impl CaptureShortcutPreferences {
    pub fn normalized(mut self) -> Self {
        let shortcut = self.shortcut.trim().to_string();
        self.shortcut = if shortcut.is_empty() {
            DEFAULT_SHORTCUT.to_string()
        } else {
            shortcut
        };
        self
    }
}

/// Lee las preferencias guardadas. `None` cuando todavía no existe archivo,
/// lo que identifica una instalación que aún no ha configurado el atajo.
pub fn load(path: &Path) -> Option<CaptureShortcutPreferences> {
    let content = fs::read_to_string(path).ok()?;
    let preferences: CaptureShortcutPreferences = serde_json::from_str(&content).ok()?;
    if preferences.version != DOCUMENT_VERSION {
        return None;
    }
    Some(preferences.normalized())
}

pub fn save(path: &Path, preferences: &CaptureShortcutPreferences) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("No se pudo crear el directorio de preferencias: {error}"))?;
    }
    let body = serde_json::to_string_pretty(preferences)
        .map_err(|error| format!("No se pudo preparar las preferencias del capturador: {error}"))?;
    fs::write(path, body)
        .map_err(|error| format!("No se pudo guardar las preferencias del capturador: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_file_reports_no_stored_preference() {
        let path = std::env::temp_dir().join("prisma-capture-prefs-missing.json");
        let _ = std::fs::remove_file(&path);
        assert!(load(&path).is_none());
    }

    #[test]
    fn preferences_round_trip_and_normalize_empty_shortcut() {
        let path = std::env::temp_dir().join("prisma-capture-prefs-roundtrip.json");
        let mut preferences = CaptureShortcutPreferences::default();
        preferences.shortcut = "  ".to_string();
        save(&path, &preferences).unwrap();
        let loaded = load(&path).unwrap();
        assert_eq!(loaded.shortcut, DEFAULT_SHORTCUT);
        assert!(loaded.enabled);
        let _ = std::fs::remove_file(&path);
    }
}
