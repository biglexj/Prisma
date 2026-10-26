use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter, Manager};

use super::vault::{VaultItem, VaultState};

/// Tamaño de la franja en reposo: es invisible, solo espera el arrastre.
const ZONE_COLLAPSED: (i32, i32) = (100, 3);

/// `true` mientras un arrastre está sobre la zona.
///
/// La ventana principal también recibe el evento de soltado del sistema, así que
/// necesita saber si la zona del sistema se quedó con el archivo para no
/// procesarlo dos veces.
static ZONE_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Indica si la zona de recepción del sistema está atrapando un arrastre.
#[tauri::command]
pub fn drop_zone_is_active() -> bool {
    ZONE_ACTIVE.load(Ordering::Relaxed)
}

/// Coloca la zona en el borde superior central del escritorio virtual.
fn place(zone: &tauri::WebviewWindow, width: i32, height: i32) {
    let scale = zone.scale_factor().unwrap_or(1.0);
    let width = (width as f64 * scale).round() as i32;
    let height = (height as f64 * scale).round() as i32;
    let (virtual_x, virtual_y, virtual_width, _) =
        crate::features::screen_capture::recorder::virtual_screen_rect();
    let (left, top, screen_width) = zone.primary_monitor().ok().flatten()
        .map(|monitor| (monitor.position().x, monitor.position().y, monitor.size().width as i32))
        .unwrap_or((virtual_x, virtual_y, virtual_width as i32));
    let x = left + (screen_width - width) / 2;
    let _ = zone.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: width as u32,
        height: height as u32,
    }));
    let _ = zone.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x,
        y: top,
    }));
    // Una región nativa recorta solo las esquinas inferiores; no depende de
    // transparencias de WebView2 ni de una preferencia DWM no documentada.
    #[cfg(windows)]
    if let Ok(hwnd) = zone.hwnd() {
        use windows::Win32::Graphics::Gdi::{CombineRgn, CreateRectRgn, CreateRoundRectRgn, DeleteObject, SetWindowRgn, RGN_OR};
        unsafe {
            let radius = if height <= (3.0 * scale) as i32 { height * 2 } else { (32.0 * scale) as i32 };
            let rounded = CreateRoundRectRgn(0, 0, width + 1, height + 1, radius, radius);
            let top_edge = CreateRectRgn(0, 0, width, height / 2);
            CombineRgn(rounded, rounded, top_edge, RGN_OR);
            let _ = DeleteObject(top_edge);
            if SetWindowRgn(windows::Win32::Foundation::HWND(hwnd.0), rounded, true) == 0 {
                let _ = DeleteObject(rounded);
            }
        }
    }
}

/// ¿Está el puntero del ratón dentro de la ventana de la zona?
///
/// La webview deja de recibir eventos cuando el puntero sale de la ventana, así
/// que la pregunta se le hace al backend: él compara la posición real del
/// cursor con el rectángulo de la ventana.
#[tauri::command]
pub fn drop_zone_pointer_inside(zone: tauri::WebviewWindow, activation_area: Option<bool>) -> bool {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::POINT;
        use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
        let mut cursor = POINT::default();
        if unsafe { GetCursorPos(&mut cursor) }.is_err() {
            return false;
        }
        let Ok(position) = zone.outer_position() else {
            return false;
        };
        let Ok(size) = zone.outer_size() else {
            return false;
        };
        let height = if activation_area.unwrap_or(false) { size.height.max((12.0 * zone.scale_factor().unwrap_or(1.0)) as u32) } else { size.height };
        let left = position.x as i32;
        let top = position.y as i32;
        cursor.x >= left
            && cursor.x < left + size.width as i32
            && cursor.y >= top
            && cursor.y < top + height as i32
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// Deja una nota en la consola: sirve para seguir el camino de un evento.
#[tauri::command]
pub fn vault_log(message: String) {
    println!("[Barra Synapse] {message}");
}

/// Atajo global que abre la bóveda con lo que haya guardado.
pub const VAULT_SHORTCUT: &str = "Ctrl+Shift+U";

/// Evento que le pide a la ventana de la bóveda que se abra.
pub const VAULT_OPEN_EVENT: &str = "prisma:vault-open";

/// Registra el atajo que abre la bóveda.
///
/// La bóveda no está visible en reposo: el atajo es la forma de llegar a los
/// elementos guardados sin dejar una franja en pantalla todo el tiempo.
pub fn apply_vault_shortcut(app: &tauri::AppHandle) {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutEvent, ShortcutState};

    let global_shortcut = app.global_shortcut();
    let app_handle = app.clone();
    let handler = move |_app: &tauri::AppHandle,
                        _shortcut: &tauri_plugin_global_shortcut::Shortcut,
                        event: ShortcutEvent| {
        if event.state() == ShortcutState::Released {
            return;
        }
        let app = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            println!("[Barra Synapse] Atajo global '{VAULT_SHORTCUT}' pulsado");
            if let Some(zone) = app.get_webview_window("system_drop_zone") {
                let _ = zone.show();
                let _ = zone.set_focus();
            }
            let _ = app.emit(VAULT_OPEN_EVENT, ());
        });
    };

    match global_shortcut.on_shortcut(VAULT_SHORTCUT, handler) {
        Ok(_) => println!("[Barra Synapse] Atajo global '{VAULT_SHORTCUT}' registrado"),
        Err(error) => eprintln!("[Barra Synapse] No se pudo registrar el atajo: {error}"),
    }
}

/// Deja la zona de recepción del sistema lista al arrancar.
///
/// La ventana vive por encima de todas las demás: sirve desde el Explorador de
/// archivos o cualquier aplicación, no solo desde dentro de Prisma.
pub fn place_at_startup(app: &AppHandle) {
    let Some(zone) = app.get_webview_window("system_drop_zone") else {
        return;
    };
    let _ = zone.set_always_on_top(true);
    place(&zone, ZONE_COLLAPSED.0, ZONE_COLLAPSED.1);
    let _ = zone.show();
}

/// Marca si hay un arrastre sobre la zona.
///
/// La ventana principal consulta esta bandera antes de procesar un soltado:
/// si la zona del sistema ya se quedó con el archivo, no lo añade dos veces.
#[tauri::command]
pub fn system_drop_zone_set_active(active: bool) {
    ZONE_ACTIVE.store(active, Ordering::Relaxed);
}

/// Fija el tamaño exacto de la ventana flotante.
///
/// La bóveda cambia de tamaño según cuántos elementos tenga: una muesca de
/// 80 × 3 px cuando está vacía y la estantería cuando hay algo que mostrar.
#[tauri::command]
pub fn system_drop_zone_set_size(
    app: AppHandle,
    width: i32,
    height: i32,
    background: Option<[u8; 4]>,
    focus: Option<bool>,
) -> Result<(), String> {
    let Some(zone) = app.get_webview_window("system_drop_zone") else {
        return Ok(());
    };
    // Pintar tanto la ventana como WebView2 antes de exponer el área nueva.
    // El fondo CSS por sí solo no cubre los fotogramas del redimensionado nativo.
    if let Some([red, green, blue, _]) = background {
        zone.set_background_color(Some(tauri::window::Color(red, green, blue, 255)))
            .map_err(|error| format!("No se pudo aplicar el fondo de Synapse: {error}"))?;
    }
    place(&zone, width.clamp(100, 660), height.clamp(3, 420));
    // Al abrir por hover, Ctrl+V debe llegar a Synapse y no a la app anterior.
    // Durante un arrastre se conserva el foco del origen hasta soltar.
    if focus.unwrap_or(false) {
        zone.set_focus().map_err(|error| format!("No se pudo enfocar Synapse: {error}"))?;
        zone.as_ref().set_focus().map_err(|error| format!("No se pudo enfocar el contenido de Synapse: {error}"))?;
    }
    Ok(())
}

/// Muestra u oculta la zona de recepción del sistema.
#[tauri::command]
pub fn system_drop_zone_set_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    let Some(zone) = app.get_webview_window("system_drop_zone") else {
        return Ok(());
    };
    if visible {
        place(&zone, ZONE_COLLAPSED.0, ZONE_COLLAPSED.1);
        let _ = zone.show();
    } else {
        let _ = zone.hide();
    }
    Ok(())
}

/// Carpeta de destino por defecto: las descargas del usuario, en una subcarpeta.
#[tauri::command]
pub fn drop_zone_default_folder(app: AppHandle) -> Result<String, String> {
    if let Ok(downloads) = app.path().download_dir() {
        return Ok(downloads.join("Prisma").to_string_lossy().into_owned());
    }
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        return Ok(PathBuf::from(userprofile)
            .join("Downloads")
            .join("Prisma")
            .to_string_lossy()
            .into_owned());
    }
    Ok("Prisma".to_string())
}

/// Copia un archivo a la carpeta de destino, como haría una descarga.
///
/// Si el archivo ya existe se le añade un número entre paréntesis para no
/// pisar nada.
#[tauri::command]
pub fn drop_zone_copy_file(source_path: String, folder: String) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    let destination = PathBuf::from(&folder);
    let copied = copy_to_folder(&source, &destination)?;
    Ok(copied.to_string_lossy().into_owned())
}

/// Elementos guardados en la bóveda flotante.
#[tauri::command]
pub fn vault_list(state: tauri::State<'_, VaultState>) -> Vec<VaultItem> {
    state.list()
}

/// Añade un elemento a la bóveda (máximo tres, uno de ellos fijable).
#[tauri::command]
pub fn vault_add(
    state: tauri::State<'_, VaultState>,
    path: Option<String>,
    url: Option<String>,
) -> Vec<VaultItem> {
    state.add(path, url)
}

/// Quita un elemento de la bóveda.
#[tauri::command]
pub fn vault_remove(state: tauri::State<'_, VaultState>, id: String) -> Vec<VaultItem> {
    state.remove(&id)
}

/// Fija o desfija un elemento. Solo puede quedar uno fijado.
#[tauri::command]
pub fn vault_toggle_pin(state: tauri::State<'_, VaultState>, id: String) -> Result<Vec<VaultItem>, String> {
    state.toggle_pin(&id)
}

/// Lógica de copia, separada del comando para poder probarla sin Tauri.
pub fn copy_to_folder(source: &Path, folder: &Path) -> Result<PathBuf, String> {
    use std::io;
    if !source.is_file() { return Err("El archivo de origen no existe o es una carpeta".into()); }
    std::fs::create_dir_all(folder).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    let name = source.file_name().ok_or("El archivo no tiene nombre")?;
    let stem = source.file_stem().unwrap_or(name).to_string_lossy();
    let extension = source.extension().map(|value| value.to_string_lossy());
    for index in 0..10000 {
        let name = if index == 0 { name.to_string_lossy().into_owned() }
            else if let Some(extension) = &extension { format!("{stem} ({index}).{extension}") }
            else { format!("{stem} ({index})") };
        let target = folder.join(name);
        let mut output = match std::fs::OpenOptions::new().write(true).create_new(true).open(&target) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.to_string()),
        };
        let mut input = std::fs::File::open(source).map_err(|e| e.to_string())?;
        if let Err(error) = io::copy(&mut input, &mut output) {
            drop(output);
            let _ = std::fs::remove_file(&target);
            return Err(error.to_string());
        }
        return Ok(target);
    }
    Err("No se encontró un nombre libre para la copia".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copia_el_archivo_y_no_pisa_el_existente() {
        let temp = std::env::temp_dir().join("prisma-drop-zone-test");
        let _ = std::fs::remove_dir_all(&temp);
        let source_dir = temp.join("origen");
        let target_dir = temp.join("destino");
        std::fs::create_dir_all(&source_dir).unwrap();
        std::fs::create_dir_all(&target_dir).unwrap();

        let source = source_dir.join("imagen.png");
        std::fs::write(&source, b"contenido").unwrap();

        let first = copy_to_folder(&source, &target_dir).unwrap();
        assert_eq!(first.file_name().unwrap(), "imagen.png");

        // Un segundo archivo con el mismo nombre no pisa el anterior.
        let second = copy_to_folder(&source, &target_dir).unwrap();
        assert_eq!(second.file_name().unwrap(), "imagen (1).png");
        assert_eq!(std::fs::read(&first).unwrap(), b"contenido");

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn la_carpeta_de_destino_se_crea_sin_falta() {
        let temp = std::env::temp_dir().join("prisma-drop-zone-nueva");
        let _ = std::fs::remove_dir_all(&temp);
        let source = temp.join("origen.txt");
        std::fs::create_dir_all(temp.join("origen")).unwrap();
        std::fs::write(&source, b"datos").unwrap();

        let target = temp.join("a").join("b");
        let copied = copy_to_folder(&source, &target).unwrap();
        assert!(copied.exists());
        assert!(target.exists());

        let _ = std::fs::remove_dir_all(&temp);
    }
}
