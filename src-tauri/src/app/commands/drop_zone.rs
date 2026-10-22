use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager};

use super::vault::{VaultItem, VaultState};

/// Tamaño de la muesca replegada: 80 × 3 px, tal como se pidió.
const ZONE_COLLAPSED: (i32, i32) = (80, 3);
/// Tamaño del panel desplegado cuando entra un archivo arrastrado.
const ZONE_EXPANDED: (i32, i32) = (320, 76);

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
    let (virtual_x, virtual_y, virtual_width, _) =
        crate::features::screen_capture::recorder::virtual_screen_rect();
    let x = virtual_x + (virtual_width as i32 - width) / 2;
    let _ = zone.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: width as u32,
        height: height as u32,
    }));
    let _ = zone.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x,
        y: virtual_y,
    }));
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

/// Despliega o repliega la muesca.
#[tauri::command]
pub fn system_drop_zone_expand(app: AppHandle, expanded: bool) -> Result<(), String> {
    let Some(zone) = app.get_webview_window("system_drop_zone") else {
        return Ok(());
    };
    let (width, height) = if expanded {
        ZONE_EXPANDED
    } else {
        ZONE_COLLAPSED
    };
    ZONE_ACTIVE.store(expanded, Ordering::Relaxed);
    place(&zone, width, height);
    Ok(())
}

/// Fija el tamaño exacto de la ventana flotante.
///
/// La bóveda cambia de tamaño según cuántos elementos tenga: una muesca de
/// 80 × 3 px cuando está vacía y la estantería cuando hay algo que mostrar.
#[tauri::command]
pub fn system_drop_zone_set_size(app: AppHandle, width: i32, height: i32) -> Result<(), String> {
    let Some(zone) = app.get_webview_window("system_drop_zone") else {
        return Ok(());
    };
    place(&zone, width.clamp(80, 520), height.clamp(3, 320));
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
pub fn vault_toggle_pin(state: tauri::State<'_, VaultState>, id: String) -> Vec<VaultItem> {
    state.toggle_pin(&id)
}

/// Lógica de copia, separada del comando para poder probarla sin Tauri.
pub fn copy_to_folder(source: &Path, folder: &Path) -> Result<PathBuf, String> {    if !source.exists() {
        return Err("El archivo de origen ya no existe".to_string());
    }
    if source.is_dir() {
        return Err("Ahora mismo solo se admiten archivos, no carpetas".to_string());
    }
    std::fs::create_dir_all(folder)
        .map_err(|error| format!("No se pudo crear la carpeta de destino: {error}"))?;

    let name = source
        .file_name()
        .ok_or_else(|| "El archivo no tiene nombre".to_string())?;
    let mut target = folder.join(name);

    if target.exists() {
        let stem = source
            .file_stem()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_else(|| "archivo".to_string());
        let extension = source.extension().map(|value| value.to_string_lossy().into_owned());
        for index in 1..1000 {
            let candidate_name = match &extension {
                Some(extension) => format!("{stem} ({index}).{extension}"),
                None => format!("{stem} ({index})"),
            };
            let candidate = folder.join(candidate_name);
            if !candidate.exists() {
                target = candidate;
                break;
            }
        }
    }

    std::fs::copy(source, &target)
        .map_err(|error| format!("No se pudo copiar el archivo: {error}"))?;
    Ok(target)
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
