use std::fs;
use std::path::{Path, PathBuf};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetWallpaperResult {
    pub success: bool,
    pub path: String,
}

fn get_wallpapers_dir() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let pics = Path::new(&user_profile).join("Pictures").join("Prisma Wallpapers");
            if fs::create_dir_all(&pics).is_ok() {
                return pics;
            }
        }
    }
    let temp = std::env::temp_dir().join("Prisma_Wallpapers");
    let _ = fs::create_dir_all(&temp);
    temp
}

/// Guarda una imagen recibida en base64 y la establece como fondo de escritorio en Windows.
#[tauri::command]
pub async fn wallpaper_save_and_apply(
    image_base64: String,
    file_name: String,
) -> Result<SetWallpaperResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let raw_b64 = if let Some(idx) = image_base64.find(";base64,") {
            &image_base64[idx + 8..]
        } else if let Some(stripped) = image_base64.strip_prefix("data:image/") {
            if let Some(idx) = stripped.find(',') {
                &stripped[idx + 1..]
            } else {
                &image_base64
            }
        } else {
            &image_base64
        };

        let bytes = STANDARD
            .decode(raw_b64.trim())
            .map_err(|e| format!("Error al decodificar imagen: {e}"))?;

        if bytes.is_empty() {
            return Err("La imagen descargada está vacía.".to_string());
        }

        let dir = get_wallpapers_dir();
        let safe_name = if file_name.trim().is_empty() {
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            format!("Aurora_Wallpaper_{timestamp}.png")
        } else {
            file_name.trim().to_string()
        };

        let target_path = dir.join(safe_name);
        fs::write(&target_path, bytes)
            .map_err(|e| format!("No se pudo guardar la imagen del fondo: {e}"))?;

        let canonical = target_path
            .canonicalize()
            .unwrap_or(target_path.clone());

        #[cfg(windows)]
        {
            use windows::core::HSTRING;
            use windows::Win32::UI::WindowsAndMessaging::{
                SystemParametersInfoW, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SPI_SETDESKWALLPAPER,
            };

            let wide_str = HSTRING::from(canonical.as_os_str());
            unsafe {
                let res = SystemParametersInfoW(
                    SPI_SETDESKWALLPAPER,
                    0,
                    Some(wide_str.as_ptr() as *mut _),
                    SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
                );
                if let Err(e) = res {
                    return Err(format!("Error de la API de Windows al aplicar fondo: {e}"));
                }
            }
        }

        Ok(SetWallpaperResult {
            success: true,
            path: canonical.to_string_lossy().to_string(),
        })
    })
    .await
    .map_err(|e| format!("Error interno al aplicar fondo: {e}"))?
}

/// Establece una imagen local como fondo de escritorio en Windows.
#[tauri::command]
pub async fn wallpaper_set_desktop(image_path: String) -> Result<SetWallpaperResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&image_path);
        let canonical = path
            .canonicalize()
            .map_err(|e| format!("No se pudo acceder al archivo local: {e}"))?;

        if !canonical.is_file() {
            return Err("La ruta especificada no es un archivo válido.".to_string());
        }

        #[cfg(windows)]
        {
            use windows::core::HSTRING;
            use windows::Win32::UI::WindowsAndMessaging::{
                SystemParametersInfoW, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SPI_SETDESKWALLPAPER,
            };

            let wide_str = HSTRING::from(canonical.as_os_str());
            unsafe {
                let res = SystemParametersInfoW(
                    SPI_SETDESKWALLPAPER,
                    0,
                    Some(wide_str.as_ptr() as *mut _),
                    SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
                );
                if let Err(e) = res {
                    return Err(format!("Error de la API de Windows al aplicar fondo: {e}"));
                }
            }
        }

        Ok(SetWallpaperResult {
            success: true,
            path: canonical.to_string_lossy().to_string(),
        })
    })
    .await
    .map_err(|e| format!("Error interno al aplicar fondo: {e}"))?
}
