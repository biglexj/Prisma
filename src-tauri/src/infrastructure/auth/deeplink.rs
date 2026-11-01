//! Enlace profundo de Prisma.
//!
//! El navegador del sistema devuelve el código de autorización abriendo
//! `prisma://auth/callback?code=…`. Windows necesita que la app declare
//! ese esquema; aquí se registra en `HKCU\Software\Classes`, que es por
//! usuario y no exige elevación de administrador.

use std::sync::{Mutex, OnceLock};

/// Callback que el proveedor debe devolver a esta app.
pub const CALLBACK_PATH: &str = "auth/callback";

/// Esquema por entorno: producción y desarrollo no comparten callback.
pub fn scheme() -> &'static str {
    if dev_flavor() {
        "prisma-dev"
    } else {
        "prisma"
    }
}

/// Callback completo que se registra en el proveedor de identidad.
pub fn callback_url() -> String {
    format!("{}://{CALLBACK_PATH}", scheme())
}

fn dev_flavor() -> bool {
    std::env::var("PRISMA_FLAVOR")
        .or_else(|_| std::env::var("AURORA_HUB_FLAVOR"))
        .ok()
        .is_some_and(|value| value.trim().eq_ignore_ascii_case("dev"))
        || cfg!(debug_assertions)
}

/// Callback pendiente de ser consumido por el motor de sesión.
static PENDING: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn pending_slot() -> &'static Mutex<Option<String>> {
    PENDING.get_or_init(|| Mutex::new(None))
}

/// Guarda la URL recibida para que la consuma la sesión.
pub fn stash(url: String) {
    if let Ok(mut slot) = pending_slot().lock() {
        *slot = Some(url);
    }
}

/// Consume la URL pendiente, si la hay.
pub fn take() -> Option<String> {
    pending_slot().lock().ok().and_then(|mut slot| slot.take())
}

/// Extrae la URL de callback de los argumentos de arranque o single-instance.
pub fn extract_callback(args: &[String]) -> Option<String> {
    args.iter()
        .find_map(|argument| argument.trim().strip_prefix(scheme()))
        .map(|rest| format!("{}://{rest}", scheme()))
        .filter(|url| is_callback_url(url))
}

/// ¿La URL apunta al callback esperado de esta app?
pub fn is_callback_url(url: &str) -> bool {
    let Some(rest) = url.trim().strip_prefix(scheme()) else {
        return false;
    };
    let without_query = rest.split('?').next().unwrap_or_default();
    without_query
        .trim_start_matches("://")
        .trim_end_matches('/')
        .eq_ignore_ascii_case(CALLBACK_PATH)
}

/// Lee un parámetro de la query del callback.
pub fn query_param(url: &str, key: &str) -> Option<String> {
    let query = url.split('?').nth(1)?;
    for pair in query.split('&') {
        let Some((name, value)) = pair.split_once('=') else {
            continue;
        };
        if name.eq_ignore_ascii_case(key) {
            return Some(percent_decode(value));
        }
    }
    None
}

/// Decodificación percent-encoding mínima.
fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'%' if index + 2 < bytes.len() => {
                let high = (bytes[index + 1] as char).to_digit(16);
                let low = (bytes[index + 2] as char).to_digit(16);
                match (high, low) {
                    (Some(high), Some(low)) => {
                        out.push(((high << 4) | low) as u8);
                        index += 3;
                    }
                    _ => {
                        out.push(bytes[index]);
                        index += 1;
                    }
                }
            }
            b'+' => {
                out.push(b' ');
                index += 1;
            }
            byte => {
                out.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_string()
}

/// Registra el esquema en `HKCU\Software\Classes`.
///
/// El registro es por usuario: no pide permisos de administrador y no
/// afecta a otras cuentas del equipo.
#[cfg(target_os = "windows")]
pub fn ensure_protocol_registered() -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let current_scheme = scheme();
    let key = format!("HKCU\\Software\\Classes\\{current_scheme}");
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let command = format!("\"{}\" \"%1\"", executable.display());

    let _ = std::process::Command::new("reg")
        .args([
            "add",
            &key,
            "/ve",
            "/t",
            "REG_SZ",
            "/d",
            "URL:Prisma Protocol",
            "/f",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    let _ = std::process::Command::new("reg")
        .args(["add", &key, "/v", "URL Protocol", "/t", "REG_SZ", "/d", "", "/f"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    let cmd_key = format!("{key}\\shell\\open\\command");
    let status = std::process::Command::new("reg")
        .args([
            "add",
            &cmd_key,
            "/ve",
            "/t",
            "REG_SZ",
            "/d",
            &command,
            "/f",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|error| error.to_string())?;

    if !status.success() {
        return Err(format!("reg.exe devolvió código de salida {status:?}"));
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn ensure_protocol_registered() -> Result<(), String> {
    Ok(())
}
