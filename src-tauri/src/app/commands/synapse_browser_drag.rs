//! Archivos reales para el arrastre gestionado por WebView2, sin DoDragDrop propio.
use tauri::{Emitter, Manager};

fn trusted_zone(label: &str, url: &tauri::Url) -> bool {
    let local = match url.scheme() {
        "tauri" => url.host_str() == Some("localhost"),
        "http" | "https" => matches!(url.host_str(), Some("tauri.localhost")) ||
            matches!(url.host_str(), Some("127.0.0.1" | "localhost")) && url.port() == Some(1421),
        _ => false,
    };
    label == "system_drop_zone" && local && url.path() == "/zone.html"
}

fn local_zone(window: &tauri::WebviewWindow) -> Result<(), String> {
    let url = window.url().map_err(|e| e.to_string())?;
    if !trusted_zone(window.label(), &url) {
        return Err("La preparación de arrastre solo está disponible en Synapse local".into());
    }
    Ok(())
}

/// canonicalize añade el prefijo de dispositivo de Windows. Los receptores
/// Shell/.NET y algunos chats rechazan ese prefijo en CF_HDROP aunque el archivo
/// exista. Conservarlo para comparar identidad, pero usar DOS/UNC al exportar.
#[cfg(windows)]
fn shell_drag_path(path: &std::path::Path) -> Result<String, String> {
    use std::path::{Component, Prefix};
    let raw = path.to_str().ok_or("La ruta no se puede representar en WebView2")?;
    match path.components().next() {
        Some(Component::Prefix(prefix)) => match prefix.kind() {
            Prefix::VerbatimDisk(_) => Ok(raw[4..].to_string()),
            Prefix::VerbatimUNC(_, _) => Ok(format!("\\\\{}", &raw[8..])),
            _ => Ok(raw.to_string()),
        },
        _ => Ok(raw.to_string()),
    }
}

#[tauri::command]
pub async fn synapse_prepare_browser_drag(window: tauri::WebviewWindow, app: tauri::AppHandle, id: String, request_id: String) -> Result<(), String> {
    local_zone(&window)?;
    if request_id.len() != 36 || !request_id.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return Err("Identificador de petición no válido".into());
    }
    // La web no proporciona rutas arbitrarias: solo el identificador de una tarjeta.
    let item = app.state::<super::vault::VaultState>().list().into_iter().find(|i| i.id == id)
        .ok_or("El archivo ya no está en Synapse")?;
    let path = std::path::PathBuf::from(item.path.ok_or("La tarjeta no contiene un archivo")?)
        .canonicalize().map_err(|e| e.to_string())?;
    if !path.is_file() { return Err("El archivo ya no está disponible".into()); }
    #[cfg(windows)]
    {
        // getFile() de FileSystemHandle produce un blob sin HasBackingFile en
        // Chromium; ToWebDragData lo reduce al nombre. Un input nativo conserva
        // el archivo de disco y permite exportar FilenameItem/CF_HDROP.
        let input_id = serde_json::to_string(&format!("synapse-file-{request_id}")).map_err(|e| e.to_string())?;
        let expression = format!("(() => {{ const input = document.getElementById({input_id}); return input instanceof HTMLInputElement && input.type === 'file' ? input : null; }})()");
        let result = devtools_call(&window, "Runtime.evaluate", serde_json::json!({"expression": expression})).await?;
        let object_id = result["result"]["objectId"].as_str().ok_or("La tarjeta ya no está disponible para arrastrar")?.to_string();
        let export_path = shell_drag_path(&path)?;
        let prepared = devtools_call(&window, "DOM.setFileInputFiles", serde_json::json!({"objectId": object_id, "files": [export_path]})).await;
        let _ = devtools_call(&window, "Runtime.releaseObject", serde_json::json!({"objectId": object_id})).await;
        prepared?;
        // Verificar el respaldo nativo antes de habilitar la tarjeta: los blobs
        // de FileSystemHandle no devolverían esta ruta mediante DOM.getFileInfo.
        let expression = format!("document.getElementById({input_id})?.files?.[0]");
        let result = devtools_call(&window, "Runtime.evaluate", serde_json::json!({"expression": expression})).await?;
        let object_id = result["result"]["objectId"].as_str().ok_or("WebView2 no entregó el archivo de disco")?.to_string();
        let info = devtools_call(&window, "DOM.getFileInfo", serde_json::json!({"objectId": object_id})).await;
        let _ = devtools_call(&window, "Runtime.releaseObject", serde_json::json!({"objectId": object_id})).await;
        let info = info?;
        let actual = info["path"].as_str().ok_or("El archivo no tiene una ruta nativa para arrastrar")?;
        if std::path::Path::new(actual).canonicalize().map_err(|e| e.to_string())? != path {
            return Err("WebView2 no conservó la referencia al archivo original".into());
        }
        Ok(())
    }
    #[cfg(not(windows))]
    { Err("El puente de archivos requiere WebView2 en Windows".into()) }
}

/// API asíncrona del WebView local; no abre un puerto de depuración ni bloquea UI.
#[cfg(windows)]
async fn devtools_call(window: &tauri::WebviewWindow, method: &'static str, params: serde_json::Value) -> Result<serde_json::Value, String> {
    local_zone(window)?;
    let (tx, rx) = tokio::sync::oneshot::channel();
    let sender = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
    window.with_webview(move |webview| unsafe {
        use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
        use windows_core_webview::HSTRING;
        let completed = sender.clone();
        let handler = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(move |status, json| {
            let result = status.map_err(|e| e.to_string()).and_then(|_| serde_json::from_str(&json).map_err(|e| e.to_string()));
            if let Some(tx) = completed.lock().unwrap().take() { let _ = tx.send(result); }
            Ok(())
        }));
        let result = webview.controller().CoreWebView2().and_then(|core| core.CallDevToolsProtocolMethod(&HSTRING::from(method), &HSTRING::from(params.to_string()), &handler));
        if let Err(error) = result {
            if let Some(tx) = sender.lock().unwrap().take() { let _ = tx.send(Err(error.to_string())); }
        }
    }).map_err(|e| e.to_string())?;
    tokio::time::timeout(std::time::Duration::from_secs(6), rx).await
        .map_err(|_| "WebView2 no respondió a la preparación del archivo".to_string())?
        .map_err(|e| e.to_string())?
}

/// Conservar el receptor de WebView2 y obtener las rutas de los File del drop DOM.
pub fn install(window: &tauri::WebviewWindow) -> Result<(), String> {
    // En setup la navegación inicial puede seguir en about:blank. Registrar
    // ahora y validar el origen real al recibir cada mensaje evita esa carrera.
    if window.label() != "system_drop_zone" { return Err("Receptor reservado a Synapse".into()); }
    #[cfg(windows)]
    {
        use webview2_com::{Microsoft::Web::WebView2::Win32::*, WebMessageReceivedEventHandler, take_pwstr};
        use windows_core_webview::{Interface, PWSTR};
        let target = window.clone();
        window.with_webview(move |webview| unsafe {
            let result = (|| -> windows_core_webview::Result<()> {
                let core = webview.controller().CoreWebView2()?;
                let mut token = 0;
                core.add_WebMessageReceived(&WebMessageReceivedEventHandler::create(Box::new(move |_, args| {
                    let Some(args) = args else { return Ok(()); };
                    let mut raw = PWSTR::null();
                    if args.TryGetWebMessageAsString(&mut raw).is_err() { return Ok(()); }
                    let Ok(message) = serde_json::from_str::<serde_json::Value>(&take_pwstr(raw)) else { return Ok(()); };
                    if message["kind"] != "prisma-synapse-drop" { return Ok(()); }
                    let mut origin = PWSTR::null();
                    args.Source(&mut origin)?;
                    let Ok(source) = tauri::Url::parse(&take_pwstr(origin)) else { return Ok(()); };
                    if !trusted_zone(target.label(), &source) || target.url().ok().as_ref() != Some(&source) { return Ok(()); }
                    let action = message["action"].as_str().unwrap_or("temporary");
                    if !matches!(action, "pin" | "temporary" | "phone") { return Ok(()); }
                    let args: ICoreWebView2WebMessageReceivedEventArgs2 = args.cast()?;
                    let objects = args.AdditionalObjects()?;
                    let mut count = 0;
                    objects.Count(&mut count)?;
                    if count == 0 || count > 100 { return Ok(()); }
                    let mut paths = Vec::new();
                    for index in 0..count {
                        let file: ICoreWebView2File = objects.GetValueAtIndex(index)?.cast()?;
                        let mut path = PWSTR::null();
                        file.Path(&mut path)?;
                        let path = take_pwstr(path);
                        if !path.is_empty() && std::path::Path::new(&path).is_file() { paths.push(path); }
                    }
                    let text = message["text"].as_str().filter(|text| !text.trim().is_empty());
                    if !paths.is_empty() || text.is_some() {
                        let _ = target.emit_to(target.label(), "prisma:synapse-browser-drop", serde_json::json!({"paths": paths, "text": text, "action": action}));
                    }
                    Ok(())
                })), &mut token)?;
                Ok(())
            })();
            if let Err(error) = result { eprintln!("[Synapse] No se pudo instalar el puente de archivos: {error}"); }
        }).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[cfg(windows)]
    fn exported_paths_use_shell_spelling_without_changing_the_file() {
        for (input, expected) in [
            (r"\\?\C:\Users\Prueba\Imagen.png", r"C:\Users\Prueba\Imagen.png"),
            (r"\\?\D:\Imágenes\niña 🌙.png", r"D:\Imágenes\niña 🌙.png"),
            (r"\\?\UNC\servidor\carpeta\archivo.txt", r"\\servidor\carpeta\archivo.txt"),
            (r"C:\normal\archivo.mp4", r"C:\normal\archivo.mp4"),
            (r"\\servidor\carpeta\archivo.txt", r"\\servidor\carpeta\archivo.txt"),
            (r"\\?\Volume{1234}\archivo.txt", r"\\?\Volume{1234}\archivo.txt"),
        ] {
            assert_eq!(shell_drag_path(std::path::Path::new(input)).unwrap(), expected);
        }
        let root = std::env::current_exe().unwrap().canonicalize().unwrap();
        assert_eq!(std::path::Path::new(&shell_drag_path(&root).unwrap()).canonicalize().unwrap(), root);
    }
    #[test]
    fn file_bridge_is_limited_to_the_local_synapse_document() {
        for value in ["http://127.0.0.1:1421/zone.html", "http://localhost:1421/zone.html", "http://tauri.localhost/zone.html", "tauri://localhost/zone.html"] {
            let url = tauri::Url::parse(value).unwrap();
            assert!(trusted_zone("system_drop_zone", &url));
            assert!(!trusted_zone("main", &url));
        }
        for value in ["https://example.com/zone.html", "http://localhost:3000/zone.html", "http://localhost:1421/index.html", "https://tauri.localhost.evil/zone.html", "http://127.0.0.1:1421/zone.html/other"] {
            assert!(!trusted_zone("system_drop_zone", &tauri::Url::parse(value).unwrap()));
        }
    }
}
