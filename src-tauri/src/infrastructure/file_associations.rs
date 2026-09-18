//! Registro dinámico de asociaciones de archivo y menú "Abrir con..." en Windows.
//! Registra Prisma en HKCU para que el Explorador de Windows reconozca inmediatamente
//! a Prisma como visor de Documentos (Markdown, Texto, PDF, etc.) y Multimedia,
//! apareciendo en la lista de aplicaciones sugeridas en el diálogo "Abrir con...".

#[cfg(windows)]
pub mod windows_associations {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_WRITE,
        REG_OPTION_NON_VOLATILE, REG_SZ,
    };
    use windows::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};

    pub const DOCUMENT_EXTENSIONS: &[&str] = &[
        "md", "markdown", "txt", "json", "jsonc", "log", "xml", "yaml", "yml", "toml", "csv",
        "tsv", "ini", "conf", "pdf", "epub",
    ];

    pub const MEDIA_EXTENSIONS: &[&str] = &[
        "mp3", "flac", "wav", "aac", "m4a", "ogg", "opus", "wma", "m3u", "m3u8", "mp4", "mkv",
        "avi", "mov", "webm", "flv", "wmv", "m4v", "jpg", "jpeg", "png", "webp", "gif", "bmp",
        "svg", "ico", "zip", "lrc", "srt", "vtt", "ass", "ssa",
    ];

    fn set_reg_sz(key: HKEY, value_name: Option<&str>, data: &str) {
        let name_hstring = value_name.map(HSTRING::from);
        let pcwstr_name = match &name_hstring {
            Some(h) => PCWSTR::from_raw(h.as_ptr()),
            None => PCWSTR::null(),
        };

        let data_utf16: Vec<u16> = data.encode_utf16().chain(std::iter::once(0)).collect();
        unsafe {
            let bytes = std::slice::from_raw_parts(
                data_utf16.as_ptr() as *const u8,
                data_utf16.len() * std::mem::size_of::<u16>(),
            );

            let _ = RegSetValueExW(key, pcwstr_name, 0, REG_SZ, Some(bytes));
        }
    }

    fn create_or_open_key(parent: HKEY, subkey_path: &str) -> Option<HKEY> {
        let mut key = HKEY::default();
        let subkey = HSTRING::from(subkey_path);
        let status = unsafe {
            RegCreateKeyExW(
                parent,
                PCWSTR::from_raw(subkey.as_ptr()),
                0,
                None,
                REG_OPTION_NON_VOLATILE,
                KEY_WRITE,
                None,
                &mut key,
                None,
            )
        };
        if status.is_ok() {
            Some(key)
        } else {
            None
        }
    }

    /// Registra Prisma en el Registro de Windows (HKCU) para que el Explorador
    /// lo muestre en "Abrir con..." para documentos y medios sin requerir privilegios de administrador.
    pub fn register_file_associations() {
        let current_exe = match std::env::current_exe() {
            Ok(p) => p,
            Err(_) => return,
        };

        let exe_path_str = current_exe.to_string_lossy().to_string();
        let exe_file_name = current_exe
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("prisma.exe")
            .to_string();

        let open_command = format!("\"{}\" \"%1\"", exe_path_str);
        let icon_entry = format!("\"{}\",0", exe_path_str);

        // ── 1. ProgID: Prisma.Document ──
        if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, "Software\\Classes\\Prisma.Document") {
            set_reg_sz(key, None, "Documento compatible con Prisma");
            set_reg_sz(key, Some("FriendlyTypeName"), "Documento compatible con Prisma");
            set_reg_sz(key, Some("AppUserModelID"), "com.biglexj.prisma");
            unsafe { let _ = RegCloseKey(key); }
        }
        if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, "Software\\Classes\\Prisma.Document\\DefaultIcon") {
            set_reg_sz(key, None, &icon_entry);
            unsafe { let _ = RegCloseKey(key); }
        }
        if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, "Software\\Classes\\Prisma.Document\\shell\\open\\command") {
            set_reg_sz(key, None, &open_command);
            unsafe { let _ = RegCloseKey(key); }
        }

        // ── 2. ProgID: Prisma.Media ──
        if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, "Software\\Classes\\Prisma.Media") {
            set_reg_sz(key, None, "Archivo multimedia compatible con Prisma");
            set_reg_sz(key, Some("FriendlyTypeName"), "Archivo multimedia compatible con Prisma");
            set_reg_sz(key, Some("AppUserModelID"), "com.biglexj.prisma");
            unsafe { let _ = RegCloseKey(key); }
        }
        if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, "Software\\Classes\\Prisma.Media\\DefaultIcon") {
            set_reg_sz(key, None, &icon_entry);
            unsafe { let _ = RegCloseKey(key); }
        }
        if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, "Software\\Classes\\Prisma.Media\\shell\\open\\command") {
            set_reg_sz(key, None, &open_command);
            unsafe { let _ = RegCloseKey(key); }
        }

        // ── 3. Registrar en Applications (para el ejecutable actual y 'prisma.exe') ──
        let mut app_keys = vec![format!("Software\\Classes\\Applications\\{}", exe_file_name)];
        if !exe_file_name.eq_ignore_ascii_case("prisma.exe") {
            app_keys.push("Software\\Classes\\Applications\\prisma.exe".to_string());
        }

        for app_key_path in &app_keys {
            if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, app_key_path) {
                set_reg_sz(key, None, "Prisma");
                set_reg_sz(key, Some("FriendlyAppName"), "Prisma");
                set_reg_sz(key, Some("ApplicationCompany"), "biglexj");
                set_reg_sz(key, Some("AppUserModelID"), "com.biglexj.prisma");
                unsafe { let _ = RegCloseKey(key); }
            }
            if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, &format!("{}\\DefaultIcon", app_key_path)) {
                set_reg_sz(key, None, &icon_entry);
                unsafe { let _ = RegCloseKey(key); }
            }
            if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, &format!("{}\\shell\\open\\command", app_key_path)) {
                set_reg_sz(key, None, &open_command);
                unsafe { let _ = RegCloseKey(key); }
            }

            // SupportedTypes
            if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, &format!("{}\\SupportedTypes", app_key_path)) {
                for ext in DOCUMENT_EXTENSIONS.iter().chain(MEDIA_EXTENSIONS.iter()) {
                    set_reg_sz(key, Some(&format!(".{}", ext)), "");
                }
                unsafe { let _ = RegCloseKey(key); }
            }
        }

        // ── 4. Asociar a cada extensión en OpenWithProgids y OpenWithList ──
        for ext in DOCUMENT_EXTENSIONS {
            let open_with_progids = format!("Software\\Classes\\.{}\\OpenWithProgids", ext);
            if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, &open_with_progids) {
                set_reg_sz(key, Some("Prisma.Document"), "");
                unsafe { let _ = RegCloseKey(key); }
            }

            let open_with_list = format!("Software\\Classes\\.{}\\OpenWithList\\{}", ext, exe_file_name);
            if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, &open_with_list) {
                unsafe { let _ = RegCloseKey(key); }
            }
            if !exe_file_name.eq_ignore_ascii_case("prisma.exe") {
                let open_with_list_generic = format!("Software\\Classes\\.{}\\OpenWithList\\prisma.exe", ext);
                if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, &open_with_list_generic) {
                    unsafe { let _ = RegCloseKey(key); }
                }
            }
        }

        for ext in MEDIA_EXTENSIONS {
            let open_with_progids = format!("Software\\Classes\\.{}\\OpenWithProgids", ext);
            if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, &open_with_progids) {
                set_reg_sz(key, Some("Prisma.Media"), "");
                unsafe { let _ = RegCloseKey(key); }
            }

            let open_with_list = format!("Software\\Classes\\.{}\\OpenWithList\\{}", ext, exe_file_name);
            if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, &open_with_list) {
                unsafe { let _ = RegCloseKey(key); }
            }
        }

        // ── 5. Capabilities y RegisteredApplications ──
        if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, "Software\\Prisma\\Capabilities") {
            set_reg_sz(key, Some("ApplicationName"), "Prisma");
            set_reg_sz(
                key,
                Some("ApplicationDescription"),
                "Prisma · Tu espacio de multimedia y visor rápido de documentos",
            );
            unsafe { let _ = RegCloseKey(key); }
        }
        if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, "Software\\Prisma\\Capabilities\\FileAssociations") {
            for ext in DOCUMENT_EXTENSIONS {
                set_reg_sz(key, Some(&format!(".{}", ext)), "Prisma.Document");
            }
            for ext in MEDIA_EXTENSIONS {
                set_reg_sz(key, Some(&format!(".{}", ext)), "Prisma.Media");
            }
            unsafe { let _ = RegCloseKey(key); }
        }
        if let Some(key) = create_or_open_key(HKEY_CURRENT_USER, "Software\\RegisteredApplications") {
            set_reg_sz(key, Some("Prisma"), "Software\\Prisma\\Capabilities");
            unsafe { let _ = RegCloseKey(key); }
        }

        // ── 6. Notificar al Explorador de Windows para refrescar asociaciones ──
        unsafe {
            SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None);
        }
    }
}

#[cfg(not(windows))]
pub mod windows_associations {
    pub const DOCUMENT_EXTENSIONS: &[&str] = &[];
    pub const MEDIA_EXTENSIONS: &[&str] = &[];
    pub fn register_file_associations() {}
}

pub use windows_associations::*;
