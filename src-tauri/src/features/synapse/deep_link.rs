#[derive(Debug, Clone, PartialEq)]
pub struct ParsedPrismaUri {
    pub path: String,
    pub current_time_sec: Option<f64>,
    pub autoplay: bool,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub is_video: Option<bool>,
}

/// Decodifica caracteres codificados por porcentaje (%20, %3A, etc.) en URLs.
pub fn url_decode(input: &str) -> String {
    let mut result = Vec::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16) {
                result.push(byte);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'+' {
            result.push(b' ');
        } else {
            result.push(bytes[i]);
        }
        i += 1;
    }
    String::from_utf8_lossy(&result).into_owned()
}

/// Parsea un esquema URI `prisma://...` o `aurora-synapse://prisma/...`
pub fn parse_prisma_uri(uri_str: &str) -> Option<ParsedPrismaUri> {
    let trimmed = uri_str.trim();
    let is_valid_scheme = trimmed.starts_with("prisma://")
        || trimmed.starts_with("aurora-synapse://prisma/")
        || trimmed.starts_with("aurora-synapse://prisma?")
        || (trimmed.starts_with("aurora-synapse://prisma") && trimmed.contains('?'));
    if !is_valid_scheme {
        return None;
    }

    let query_str = if let Some(idx) = trimmed.find('?') {
        &trimmed[idx + 1..]
    } else {
        return None;
    };

    let mut path: Option<String> = None;
    let mut position_sec: Option<f64> = None;
    let mut autoplay = true;
    let mut title: Option<String> = None;
    let mut artist: Option<String> = None;
    let mut is_video: Option<bool> = None;

    for pair in query_str.split('&') {
        if pair.is_empty() {
            continue;
        }
        let mut parts = pair.splitn(2, '=');
        let key = parts.next().unwrap_or("").to_lowercase();
        let raw_val = parts.next().unwrap_or("");
        let val = url_decode(raw_val);

        match key.as_str() {
            "path" | "file" | "url" | "src" => {
                if !val.is_empty() {
                    path = Some(val);
                }
            }
            "position" | "pos" | "time" | "currenttime" | "t" => {
                if let Ok(num) = val.parse::<f64>() {
                    // Si el número es mayor a 1000 y no tiene decimales grandes, asumimos milisegundos
                    let sec = if num > 1000.0 && !val.contains('.') {
                        num / 1000.0
                    } else {
                        num
                    };
                    position_sec = Some(sec);
                }
            }
            "position_ms" | "pos_ms" | "ms" => {
                if let Ok(ms) = val.parse::<f64>() {
                    position_sec = Some(ms / 1000.0);
                }
            }
            "autoplay" | "play" => {
                autoplay = !matches!(val.to_lowercase().as_str(), "false" | "0" | "no");
            }
            "title" | "name" => {
                if !val.is_empty() {
                    title = Some(val);
                }
            }
            "artist" | "author" => {
                if !val.is_empty() {
                    artist = Some(val);
                }
            }
            "is_video" | "video" => {
                is_video = Some(matches!(val.to_lowercase().as_str(), "true" | "1" | "yes"));
            }
            _ => {}
        }
    }

    path.map(|p| ParsedPrismaUri {
        path: p,
        current_time_sec: position_sec,
        autoplay,
        title,
        artist,
        is_video,
    })
}

/// Registra el esquema URI `prisma://` en el Registro de Windows (HKCU\Software\Classes\prisma).
/// Al registrar en HKCU no requiere privilegios de administrador.
pub fn register_windows_deep_link() {
    #[cfg(windows)]
    {
        use windows::core::{HSTRING, PCWSTR};
        use windows::Win32::System::Registry::{
            RegCloseKey, RegCreateKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_WRITE,
            REG_OPTION_NON_VOLATILE, REG_SZ,
        };

        let current_exe = match std::env::current_exe() {
            Ok(p) => p,
            Err(_) => return,
        };
        let exe_path_str = current_exe.to_string_lossy();
        let command_str = format!("\"{}\" \"%1\"", exe_path_str);

        unsafe {
            // 1. HKCU\Software\Classes\prisma
            let mut key_prisma = HKEY::default();
            let subkey = HSTRING::from("Software\\Classes\\prisma");
            if RegCreateKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR::from_raw(subkey.as_ptr()),
                0,
                None,
                REG_OPTION_NON_VOLATILE,
                KEY_WRITE,
                None,
                &mut key_prisma,
                None,
            )
            .is_ok()
            {
                let desc = HSTRING::from("URL:Prisma Protocol");
                let _ = RegSetValueExW(
                    key_prisma,
                    PCWSTR::null(),
                    0,
                    REG_SZ,
                    Some(std::slice::from_raw_parts(
                        desc.as_ptr() as *const u8,
                        (desc.len() + 1) * 2,
                    )),
                );

                let url_proto = HSTRING::from("");
                let proto_name = HSTRING::from("URL Protocol");
                let _ = RegSetValueExW(
                    key_prisma,
                    PCWSTR::from_raw(proto_name.as_ptr()),
                    0,
                    REG_SZ,
                    Some(std::slice::from_raw_parts(
                        url_proto.as_ptr() as *const u8,
                        (url_proto.len() + 1) * 2,
                    )),
                );

                // 2. HKCU\Software\Classes\prisma\shell\open\command
                let mut key_cmd = HKEY::default();
                let subkey_cmd = HSTRING::from("Software\\Classes\\prisma\\shell\\open\\command");
                if RegCreateKeyExW(
                    HKEY_CURRENT_USER,
                    PCWSTR::from_raw(subkey_cmd.as_ptr()),
                    0,
                    None,
                    REG_OPTION_NON_VOLATILE,
                    KEY_WRITE,
                    None,
                    &mut key_cmd,
                    None,
                )
                .is_ok()
                {
                    let cmd_hstring = HSTRING::from(command_str.as_str());
                    let _ = RegSetValueExW(
                        key_cmd,
                        PCWSTR::null(),
                        0,
                        REG_SZ,
                        Some(std::slice::from_raw_parts(
                            cmd_hstring.as_ptr() as *const u8,
                            (cmd_hstring.len() + 1) * 2,
                        )),
                    );
                    let _ = RegCloseKey(key_cmd);
                }

                let _ = RegCloseKey(key_prisma);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_prisma_uri() {
        let uri = "prisma://open?path=C%3A%5CMusic%5Csong.mp3&autoplay=true&position=142500";
        let parsed = parse_prisma_uri(uri).expect("Debe parsear URI de Prisma");
        assert_eq!(parsed.path, "C:\\Music\\song.mp3");
        assert_eq!(parsed.current_time_sec, Some(142.5));
        assert!(parsed.autoplay);
    }

    #[test]
    fn test_parse_aurora_synapse_uri() {
        let uri = "aurora-synapse://prisma/open?path=D:/Videos/clip.mp4&position_ms=5000&autoplay=false";
        let parsed = parse_prisma_uri(uri).expect("Debe parsear URI de Aurora Synapse");
        assert_eq!(parsed.path, "D:/Videos/clip.mp4");
        assert_eq!(parsed.current_time_sec, Some(5.0));
        assert!(!parsed.autoplay);
    }
}
