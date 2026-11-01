//! Bóveda nativa de credenciales de Prisma.
//!
//! Windows ofrece dos niveles: el Gestor de credenciales (`CredWrite`/`CredRead`),
//! que es la bóveda del sistema y la opción por defecto, y DPAPI
//! (`CryptProtectData`), que protege un archivo en el directorio de datos de la app.
//! El primero se usa cuando la política del equipo lo permite; el segundo
//! es el respaldo cifrado cuando el Gestor no está disponible.
//!
//! El refresh token de la sesión de usuario vive aquí. Nunca se escribe en
//! texto plano, nunca sale hacia el renderer WebView y nunca se copia a otra
//! máquina: la bóveda está atada a la cuenta de usuario de Windows.

use std::path::{Path, PathBuf};

/// Tamaño máximo que acepta el Gestor de credenciales (CRED_MAX_CREDENTIAL_BLOB_SIZE).
const MAX_BLOB_BYTES: usize = 2560;

/// Lee un blob de la bóveda. `Ok(None)` significa "no existía".
pub fn read(target: &str, fallback_dir: Option<&Path>) -> Result<Option<Vec<u8>>, String> {
    #[cfg(windows)]
    {
        match credential_manager::read(target) {
            Ok(Some(blob)) => return Ok(Some(blob)),
            Ok(None) => {
                if let Some(directory) = fallback_dir {
                    let path = fallback_path(directory, target);
                    if let Some(blob) = fallback_read(&path)? {
                        return Ok(Some(blob));
                    }
                }
                return Ok(None);
            }
            Err(error) => {
                if fallback_dir.is_none() {
                    return Err(error);
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        let _ = target;
        let _ = fallback_dir;
        return Err(
            "La bóveda nativa de credenciales todavía no está disponible en esta plataforma."
                .to_string(),
        );
    }

    #[cfg(windows)]
    {
        let directory = fallback_dir.ok_or_else(|| {
            "El Gestor de credenciales no está disponible y no hay directorio de respaldo."
                .to_string()
        })?;
        let path = fallback_path(directory, target);
        fallback_read(&path)
    }
}

/// Escribe un blob en la bóveda de forma atómica.
pub fn write(target: &str, blob: &[u8], fallback_dir: Option<&Path>) -> Result<(), String> {
    if blob.is_empty() {
        return Err("La bóveda no acepta un blob vacío.".to_string());
    }

    #[cfg(windows)]
    {
        if blob.len() <= MAX_BLOB_BYTES {
            match credential_manager::write(target, blob) {
                Ok(()) => {
                    if let Some(directory) = fallback_dir {
                        remove_fallback(directory, target);
                    }
                    return Ok(());
                }
                Err(error) => {
                    if fallback_dir.is_none() {
                        return Err(error);
                    }
                }
            }
        }

        let directory = fallback_dir.ok_or_else(|| {
            format!(
                "El contenido supera el límite de la bóveda nativa ({} bytes) y no hay directorio de respaldo.",
                MAX_BLOB_BYTES
            )
        })?;
        fallback_write(&fallback_path(directory, target), blob)
    }

    #[cfg(not(windows))]
    {
        let _ = (target, blob, fallback_dir);
        Err("La bóveda nativa de credenciales todavía no está disponible en esta plataforma."
            .to_string())
    }
}

/// Borra el blob de la bóveda. No es un error si no existía.
pub fn delete(target: &str, fallback_dir: Option<&Path>) -> Result<(), String> {
    #[cfg(windows)]
    {
        credential_manager::delete(target)?;
        if let Some(directory) = fallback_dir {
            let path = fallback_path(directory, target);
            if path.exists() {
                let _ = std::fs::remove_file(&path);
            }
            let pending = path.with_extension("pending");
            if pending.exists() {
                let _ = std::fs::remove_file(&pending);
            }
        }
        Ok(())
    }

    #[cfg(not(windows))]
    {
        let _ = (target, fallback_dir);
        Ok(())
    }
}

#[cfg(windows)]
fn fallback_path(directory: &Path, target: &str) -> PathBuf {
    let safe: String = target
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect();
    directory.join(format!("{safe}.vault"))
}

#[cfg(windows)]
fn fallback_write(path: &Path, blob: &[u8]) -> Result<(), String> {
    if let Some(directory) = path.parent() {
        std::fs::create_dir_all(directory)
            .map_err(|error| format!("No se pudo preparar {}: {error}", directory.display()))?;
    }
    let protected = dpapi::protect(blob)?;
    let pending = path.with_extension("pending");
    std::fs::write(&pending, protected)
        .map_err(|error| format!("No se pudo guardar {}: {error}", path.display()))?;
    std::fs::rename(&pending, path)
        .map_err(|_| "No se pudo sustituir la credencial guardada de forma atómica.".to_string())
}

#[cfg(windows)]
fn fallback_read(path: &Path) -> Result<Option<Vec<u8>>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let bytes = std::fs::read(path)
        .map_err(|error| format!("No se pudo leer {}: {error}", path.display()))?;
    Ok(Some(dpapi::unprotect(&bytes)?))
}

#[cfg(windows)]
fn remove_fallback(directory: &Path, target: &str) {
    let path = fallback_path(directory, target);
    if path.exists() {
        let _ = std::fs::remove_file(&path);
    }
    let pending = path.with_extension("pending");
    if pending.exists() {
        let _ = std::fs::remove_file(&pending);
    }
}

#[cfg(windows)]
mod credential_manager {
    use windows::core::PWSTR;
    use windows::Win32::Security::Credentials::{
        CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC, CREDENTIALW, CredDeleteW, CredReadW,
        CredWriteW,
    };

    pub(super) fn read(target: &str) -> Result<Option<Vec<u8>>, String> {
        let mut target_wide: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();
        let mut credential: *mut CREDENTIALW = std::ptr::null_mut();
        let read = unsafe {
            CredReadW(
                PWSTR(target_wide.as_mut_ptr()),
                CRED_TYPE_GENERIC,
                0,
                &mut credential,
            )
        };
        if read.is_err() {
            // 1168 (ERROR_NOT_FOUND) significa que no había entrada guardada.
            return Ok(None);
        }
        unsafe {
            let blob = std::slice::from_raw_parts(
                (*credential).CredentialBlob,
                (*credential).CredentialBlobSize as usize,
            )
            .to_vec();
            windows::Win32::Security::Credentials::CredFree(
                credential.cast::<core::ffi::c_void>(),
            );
            Ok(Some(blob))
        }
    }

    pub(super) fn write(target: &str, blob: &[u8]) -> Result<(), String> {
        let mut target_wide: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();
        let mut owned = blob.to_vec();
        let credential = CREDENTIALW {
            Type: CRED_TYPE_GENERIC,
            TargetName: PWSTR(target_wide.as_mut_ptr()),
            CredentialBlobSize: owned.len() as u32,
            CredentialBlob: owned.as_mut_ptr(),
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            ..Default::default()
        };
        unsafe {
            CredWriteW(&credential, 0)
                .map_err(|error| format!("Windows no pudo guardar la credencial: {error}"))?;
        }
        Ok(())
    }

    pub(super) fn delete(target: &str) -> Result<(), String> {
        let mut target_wide: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();
        let outcome = unsafe { CredDeleteW(PWSTR(target_wide.as_mut_ptr()), CRED_TYPE_GENERIC, 0) };
        if let Err(error) = outcome {
            let not_found = windows::core::HRESULT::from_win32(1168);
            if error.code() != not_found {
                return Err(format!("Windows no pudo borrar la credencial: {error}"));
            }
        }
        Ok(())
    }
}

#[cfg(windows)]
mod dpapi {
    use windows::Win32::Foundation::LocalFree;
    use windows::Win32::Security::Cryptography::{
        CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN, CryptProtectData, CryptUnprotectData,
    };
    use windows::core::PCWSTR;

    pub(super) fn protect(plain: &[u8]) -> Result<Vec<u8>, String> {
        unsafe {
            let input = CRYPT_INTEGER_BLOB {
                cbData: plain.len() as u32,
                pbData: plain.as_ptr() as *mut u8,
            };
            let mut output = CRYPT_INTEGER_BLOB {
                cbData: 0,
                pbData: std::ptr::null_mut(),
            };
            CryptProtectData(
                &input,
                PCWSTR::null(),
                None,
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
            .map_err(|error| format!("Windows no pudo cifrar la credencial con DPAPI: {error}"))?;
            let bytes = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
            let _ = LocalFree(windows::Win32::Foundation::HLOCAL(output.pbData as *mut _));
            Ok(bytes)
        }
    }

    pub(super) fn unprotect(cipher: &[u8]) -> Result<Vec<u8>, String> {
        unsafe {
            let input = CRYPT_INTEGER_BLOB {
                cbData: cipher.len() as u32,
                pbData: cipher.as_ptr() as *mut u8,
            };
            let mut output = CRYPT_INTEGER_BLOB {
                cbData: 0,
                pbData: std::ptr::null_mut(),
            };
            CryptUnprotectData(
                &input,
                None,
                None,
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
            .map_err(|error| format!("Windows no pudo descifrar la credencial con DPAPI: {error}"))?;
            let bytes = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
            let _ = LocalFree(windows::Win32::Foundation::HLOCAL(output.pbData as *mut _));
            Ok(bytes)
        }
    }
}
