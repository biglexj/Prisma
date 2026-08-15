#[cfg(windows)]
pub mod windows_autostart {
    use windows::core::w;
    use windows::Win32::Foundation::WIN32_ERROR;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
        HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE, REG_SZ,
    };

    const RUN_KEY: windows::core::PCWSTR = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Run");
    const APP_NAME: windows::core::PCWSTR = w!("Prisma");

    pub fn is_autostart_enabled() -> bool {
        unsafe {
            let mut hkey = Default::default();
            if RegOpenKeyExW(HKEY_CURRENT_USER, RUN_KEY, 0, KEY_READ, &mut hkey).is_err() {
                return false;
            }

            let mut size = 0u32;
            let result = RegQueryValueExW(
                hkey,
                APP_NAME,
                None,
                None,
                None,
                Some(&mut size),
            );

            let _ = RegCloseKey(hkey);
            result.is_ok() && size > 0
        }
    }

    pub fn set_autostart(enabled: bool) -> Result<(), String> {
        unsafe {
            let mut hkey = Default::default();
            RegOpenKeyExW(HKEY_CURRENT_USER, RUN_KEY, 0, KEY_SET_VALUE, &mut hkey)
                .ok()
                .map_err(|e| format!("No se pudo acceder al registro de inicio: {:?}", e))?;

            if enabled {
                let current_exe = std::env::current_exe()
                    .map_err(|e| format!("No se pudo obtener la ruta del ejecutable: {:?}", e))?;

                let command = format!("\"{}\" --autostart", current_exe.to_string_lossy());
                let utf16: Vec<u16> = command.encode_utf16().chain(std::iter::once(0)).collect();
                let bytes = std::slice::from_raw_parts(
                    utf16.as_ptr() as *const u8,
                    utf16.len() * std::mem::size_of::<u16>(),
                );

                let status = RegSetValueExW(
                    hkey,
                    APP_NAME,
                    0,
                    REG_SZ,
                    Some(bytes),
                );

                let _ = RegCloseKey(hkey);
                status.ok().map_err(|e| format!("Error al escribir registro de autostart: {:?}", e))
            } else {
                let delete_res = RegDeleteValueW(hkey, APP_NAME);
                let _ = RegCloseKey(hkey);
                if delete_res == WIN32_ERROR(2) {
                    // ERROR_FILE_NOT_FOUND es OK al deshabilitar
                    Ok(())
                } else {
                    delete_res.ok().map_err(|e| format!("Error al eliminar registro de autostart: {:?}", e))
                }
            }
        }
    }
}

#[cfg(not(windows))]
pub mod windows_autostart {
    pub fn is_autostart_enabled() -> bool {
        false
    }
    pub fn set_autostart(_enabled: bool) -> Result<(), String> {
        Ok(())
    }
}

pub use windows_autostart::*;
