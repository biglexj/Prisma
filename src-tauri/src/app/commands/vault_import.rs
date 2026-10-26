use std::{io::Read, path::{Path, PathBuf}, time::Duration};
use base64::{engine::general_purpose::STANDARD, Engine};
use sha2::{Digest, Sha256};
use tauri::{Emitter, Manager};
use super::vault::{VaultItem, VaultState};

pub const VAULT_CHANGED: &str = "prisma:vault-changed";
const MAX_WEB_BYTES: u64 = 64 * 1024 * 1024;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedItem { items: Vec<VaultItem>, path: String }

fn store_bytes(folder: &Path, bytes: &[u8], name: &str) -> Result<PathBuf, String> {
    let key = format!("{:x}", Sha256::digest(bytes));
    let directory = folder.join(key);
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let path = directory.join(name);
    if !path.exists() { std::fs::write(&path, bytes).map_err(|e| e.to_string())?; }
    Ok(path)
}

/// Cada entrada tiene un archivo real para copiar, arrastrar y enviar al móvil.
fn materialize(folder: &Path, path: Option<String>, text: Option<String>) -> Result<PathBuf, String> {
    if let Some(path) = path.filter(|path| !path.trim().is_empty()) {
        let source = PathBuf::from(path);
        if !source.is_file() { return Err("Selecciona un archivo; no se admiten carpetas".into()); }
        let metadata = source.metadata().map_err(|e| e.to_string())?;
        let fingerprint = format!("{}:{}:{:?}", source.to_string_lossy(), metadata.len(), metadata.modified());
        let directory = folder.join(format!("{:x}", Sha256::digest(fingerprint.as_bytes())));
        std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let target = directory.join(source.file_name().ok_or("El archivo no tiene nombre")?);
        if !target.exists() {
            let partial = directory.join(".importing");
            std::fs::copy(&source, &partial).map_err(|e| e.to_string())?;
            std::fs::rename(&partial, &target).map_err(|e| e.to_string())?;
        }
        return Ok(target);
    }
    let text = text.filter(|value| !value.trim().is_empty()).ok_or("No hay contenido que guardar")?;
    if text.len() as u64 > MAX_WEB_BYTES { return Err("El contenido supera 64 MB".into()); }
    let trimmed = text.trim();
    if trimmed.starts_with("data:image/") {
        let (header, data) = trimmed.split_once(";base64,").ok_or("Formato de imagen no compatible")?;
        let extension = image_extension(header.trim_start_matches("data:" )).ok_or("Formato de imagen no compatible")?;
        let bytes = STANDARD.decode(data).map_err(|e| e.to_string())?;
        return store_bytes(folder, &bytes, &format!("Imagen.{extension}"));
    }
    if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(25)).redirect(reqwest::redirect::Policy::limited(5))
            .build().map_err(|e| e.to_string())?;
        let response = client.get(trimmed).send().map_err(|e| format!("No se pudo descargar: {e}"))?
            .error_for_status().map_err(|e| format!("El sitio no permite descargar este recurso: {e}"))?;
        let mime = response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok())
            .unwrap_or("").split(';').next().unwrap_or("").trim().to_string();
        if let Some(extension) = image_extension(&mime).or_else(|| match mime.as_str() {
            "application/pdf" => Some("pdf"), "video/mp4" => Some("mp4"), "video/webm" => Some("webm"), _ => None,
        }) {
            if response.content_length().is_some_and(|size| size > MAX_WEB_BYTES) { return Err("El recurso web supera 64 MB".into()); }
            let mut bytes = Vec::new();
            response.take(MAX_WEB_BYTES + 1).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
            if bytes.len() as u64 > MAX_WEB_BYTES { return Err("El recurso web supera 64 MB".into()); }
            return store_bytes(folder, &bytes, &format!("Recurso.{extension}"));
        }
        return store_bytes(folder, format!("[InternetShortcut]\r\nURL={trimmed}\r\n").as_bytes(), "Enlace.url");
    }
    store_bytes(folder, text.as_bytes(), "Texto.txt")
}

fn image_extension(mime: &str) -> Option<&'static str> {
    match mime { "image/png" => Some("png"), "image/jpeg" => Some("jpg"), "image/webp" => Some("webp"),
        "image/gif" => Some("gif"), "image/avif" => Some("avif"), "image/svg+xml" => Some("svg"), _ => None }
}

fn materialize_paste(folder: &Path, path: Option<String>, text: Option<String>, clipboard: bool) -> Result<PathBuf, String> {
    if clipboard && path.is_none() {
        if let Some(value) = text.as_deref().filter(|value| !value.trim().starts_with("data:image/")) {
            if value.len() as u64 > MAX_WEB_BYTES { return Err("El contenido supera 64 MB".into()); }
            if value.trim().is_empty() { return Err("No hay contenido que guardar".into()); }
            let link = clipboard_link(value);
            return if let Some(link) = link {
                store_bytes(folder, format!("[InternetShortcut]\r\nURL={link}\r\n").as_bytes(), "Enlace.url")
            } else { store_bytes(folder, value.as_bytes(), "Texto.txt") };
        }
    }
    materialize(folder, path, text)
}

fn clipboard_link(value: &str) -> Option<String> {
    let value = value.trim();
    if value.contains(['\r', '\n']) { return None; }
    let url = reqwest::Url::parse(value).ok()?;
    matches!(url.scheme(), "http" | "https").then(|| value.to_string())
}

#[tauri::command]
pub async fn vault_import(app: tauri::AppHandle, path: Option<String>, text: Option<String>, pinned: bool, clipboard: Option<bool>, target_slot: Option<usize>) -> Result<ImportedItem, String> {
    let folder = app.path().app_data_dir().map_err(|e| e.to_string())?.join("vault-items");
    tauri::async_runtime::spawn_blocking(move || {
        let location_path = path.as_ref().filter(|path| !path.trim().is_empty()).cloned();
        let content = if clipboard.unwrap_or(false) && path.is_none() {
            text.as_deref().filter(|value| !value.trim().starts_with("data:image/")).map(|value| value.chars().take(16000).collect::<String>())
        } else { None };
        let url = if content.is_some() { text.as_deref().and_then(clipboard_link) } else { None };
        let path = materialize_paste(&folder, path, text, clipboard.unwrap_or(false))?.to_string_lossy().into_owned();
        let items = app.state::<VaultState>().add_at_slot(Some(path.clone()), url, pinned, location_path, target_slot, content)?;
        let _ = app.emit(VAULT_CHANGED, &items);
        Ok(ImportedItem { items, path })
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn vault_save_item(app: tauri::AppHandle, id: String, folder: String) -> Result<Vec<VaultItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<VaultState>();
        let item = state.list().into_iter().find(|item| item.id == id)
            .ok_or("El elemento ya no está en Synapse")?;
        if item.location_path.is_some() { return Ok(state.list()); }
        let source = item.path.ok_or("El elemento no tiene un archivo para guardar")?;
        let destination = super::drop_zone::copy_to_folder(Path::new(&source), Path::new(&folder))?;
        let saved = destination.to_string_lossy().into_owned();
        let items = state.mark_saved(&id, saved.clone())
            .map_err(|error| format!("Archivo guardado en {saved}, pero no se pudo registrar su ubicación: {error}"))?;
        let _ = app.emit(VAULT_CHANGED, &items);
        Ok(items)
    }).await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn vault_read_text(app: tauri::AppHandle, id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let item = app.state::<VaultState>().list().into_iter().find(|item| item.id == id)
            .ok_or("El elemento ya no está en Synapse")?;
        text_for_item(item)
    }).await.map_err(|error| error.to_string())?
}

fn text_for_item(item: VaultItem) -> Result<String, String> {
    if item.kind == "link" { return item.url.ok_or("El enlace no tiene dirección".into()); }
    if item.kind != "text" { return Err("La tarjeta no contiene texto".into()); }
    let path = item.path.ok_or("El texto no tiene archivo".to_string())?;
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

/// Capturas ya guardadas: no abre ni enfoca la aplicación principal.
pub fn remember_capture(app: &tauri::AppHandle, path: &str) {
    if let Some(state) = app.try_state::<VaultState>() {
        let items = state.add(Some(path.into()), None);
        let _ = app.emit(VAULT_CHANGED, &items);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn copiar_lee_texto_completo_aunque_la_vista_previa_este_limitada() {
        let root = std::env::temp_dir().join(format!("prisma-copy-text-{}", std::process::id()));
        let text = format!("{}\nFinal con ñ 🎵", "Texto largo ".repeat(2000));
        let path = materialize_paste(&root, None, Some(text.clone()), true).unwrap();
        let state = VaultState::new(root.join("vault.json"));
        let item = state.add_at_slot(Some(path.to_string_lossy().into_owned()), None, false, None, None, Some(text.chars().take(16000).collect())).unwrap().remove(0);
        assert_eq!(text_for_item(item).unwrap(), text);
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn pegar_enlace_no_descarga_y_preserva_texto_multilinea() {
        let root = std::env::temp_dir().join(format!("prisma-paste-link-{}", std::process::id()));
        let url = "https://example.invalid/no-descargar?tema=can%C3%A7%C3%A3o";
        let path = materialize_paste(&root, None, Some(url.into()), true).unwrap();
        assert_eq!(path.extension().unwrap(), "url");
        assert_eq!(std::fs::read_to_string(path).unwrap(), format!("[InternetShortcut]\r\nURL={url}\r\n"));
        let text = format!("{url}\nTexto con ñ, emoji 🎵 y espacios  ");
        let path = materialize_paste(&root, None, Some(text.clone()), true).unwrap();
        assert_eq!(path.extension().unwrap(), "txt");
        assert_eq!(std::fs::read_to_string(path).unwrap(), text);
        assert!(clipboard_link("javascript:alert(1)").is_none());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn materializa_imagen_png_del_portapapeles_sin_cambiar_transparencia() {
        let root = std::env::temp_dir().join(format!("prisma-paste-{}", std::process::id()));
        let original = image::RgbaImage::from_pixel(1, 1, image::Rgba([30, 180, 120, 64]));
        let mut png = std::io::Cursor::new(Vec::new());
        original.write_to(&mut png, image::ImageFormat::Png).unwrap();
        let url = format!("data:image/png;base64,{}", STANDARD.encode(png.get_ref()));
        let path = materialize(&root, None, Some(url)).unwrap();
        assert_eq!(path.extension().unwrap(), "png");
        assert_eq!(std::fs::read(&path).unwrap(), *png.get_ref());
        assert_eq!(image::open(&path).unwrap().to_rgba8(), original);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn materializa_texto_y_copia_archivos_sin_alterar_el_origen() {
        let root = std::env::temp_dir().join(format!("prisma-import-{}", std::process::id()));
        let file = materialize(&root, None, Some("Texto con ñ y tildes: canción".into())).unwrap();
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "Texto con ñ y tildes: canción");
        let copied = materialize(&root.join("copias"), Some(file.to_string_lossy().into()), None).unwrap();
        assert_ne!(copied, file);
        assert_eq!(std::fs::read(&copied).unwrap(), std::fs::read(&file).unwrap());
        assert!(materialize(&root, Some(root.to_string_lossy().into()), None).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
