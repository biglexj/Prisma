use std::io::Write;
use tauri::Manager;

/// Diagnóstico optativo y local. El overlay envía únicamente metadatos de sus contactos.
#[tauri::command]
pub fn screen_capture_trace(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    events: Vec<serde_json::Value>,
) -> Result<Option<String>, String> {
    if window.label() != "screen_capture_overlay"
        || !std::env::args().any(|arg| arg == "--capture-diagnostics")
    {
        return Ok(None);
    }
    let directory = app.path().app_log_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let path = directory.join("capture-input.ndjson");
    if !events.is_empty() {
        // Acotar cada lote y el archivo para una sesión prolongada de reproducción.
        let mut bytes = Vec::new();
        for mut event in events.into_iter().take(100) {
            if let Some(fields) = event.as_object_mut() {
                fields.insert("processId".into(), serde_json::json!(std::process::id()));
                fields.insert("debugBuild".into(), serde_json::json!(cfg!(debug_assertions)));
            }
            let encoded = serde_json::to_vec(&event).map_err(|e| e.to_string())?;
            if encoded.len() > 8192 { continue; }
            bytes.extend_from_slice(&encoded);
            bytes.push(b'\n');
        }
        let rotate = std::fs::metadata(&path).is_ok_and(|meta| meta.len() > 4 * 1024 * 1024);
        let mut file = std::fs::OpenOptions::new().create(true).write(true)
            .append(!rotate).truncate(rotate).open(&path).map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())?;
    }
    Ok(Some(path.to_string_lossy().into_owned()))
}
