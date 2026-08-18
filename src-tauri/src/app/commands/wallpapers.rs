use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetWallpaperResult {
    pub success: bool,
    pub path: String,
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
