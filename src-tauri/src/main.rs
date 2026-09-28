// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let is_dev_mode = cfg!(debug_assertions)
        || std::env::args().any(|a| a == "--dev" || a == "--multi-instance" || a == "-d")
        || std::env::var("PRISMA_DEV").is_ok()
        || std::env::var("PRISMA_MULTI_INSTANCE").is_ok();

    #[cfg(target_os = "windows")]
    unsafe {
        use windows::core::w;
        use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
        let app_id = if is_dev_mode {
            w!("com.biglexj.prisma.dev")
        } else {
            w!("com.biglexj.prisma")
        };
        let _ = SetCurrentProcessExplicitAppUserModelID(app_id);
    }

    #[cfg(target_os = "windows")]
    {
        let extra_args = "--disable-features=HardwareMediaKeyHandling";
        if let Ok(existing) = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS") {
            if !existing.contains("HardwareMediaKeyHandling") {
                let combined = format!("{} {}", existing.trim(), extra_args);
                unsafe {
                    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", combined);
                }
            }
        } else {
            unsafe {
                std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", extra_args);
            }
        }
    }

    #[cfg(target_os = "windows")]
    if is_dev_mode {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let dev_udf = std::path::PathBuf::from(local_app_data)
                .join("com.biglexj.prisma.dev")
                .join("EBWebView");
            let _ = std::fs::create_dir_all(&dev_udf);
            unsafe {
                std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", dev_udf);
            }
        }
    }

    prisma_lib::run();
}

