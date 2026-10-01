//! Dedicated, nonblocking volume-key interception, independent of Quick Look.
#[cfg(windows)]
mod platform {
    use std::sync::OnceLock;
    use windows::Win32::{
        Foundation::{LPARAM, LRESULT, WPARAM},
        System::LibraryLoader::GetModuleHandleW,
        UI::WindowsAndMessaging::{
            CallNextHookEx, DispatchMessageW, GetMessageW, HC_ACTION, KBDLLHOOKSTRUCT, MSG,
            PM_NOREMOVE, PeekMessageW, SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx,
            WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
        },
    };

    static HANDLER: OnceLock<fn(u16, bool) -> bool> = OnceLock::new();

    unsafe extern "system" fn keyboard_proc(code: i32, message: WPARAM, data: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            // Only volume controls are inspected. Never read text keys or query
            // windows, COM, the filesystem or the UI from this callback.
            let event = unsafe { &*(data.0 as *const KBDLLHOOKSTRUCT) };
            if matches!(event.vkCode, 0xAD..=0xAF) {
                let message = message.0 as u32;
                let pressed = matches!(message, WM_KEYDOWN | WM_SYSKEYDOWN);
                let released = matches!(message, WM_KEYUP | WM_SYSKEYUP);
                if (pressed || released)
                    && HANDLER
                        .get()
                        .is_some_and(|handler| handler(event.vkCode as u16, pressed))
                {
                    return LRESULT(1);
                }
            }
        }
        unsafe { CallNextHookEx(None, code, message, data) }
    }

    pub fn start(handler: fn(u16, bool) -> bool) {
        if HANDLER.set(handler).is_err() {
            return;
        }
        let result = std::thread::Builder::new()
            .name("prisma-volume-keys".into())
            .spawn(|| {
                let install = || -> windows::core::Result<()> {
                    unsafe {
                        let mut message = MSG::default();
                        let _ = PeekMessageW(&mut message, None, 0, 0, PM_NOREMOVE);
                        let instance = GetModuleHandleW(None)?;
                        let hook =
                            SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), instance, 0)?;
                        #[cfg(debug_assertions)]
                        eprintln!("[Flyout] Captura dedicada de volumen instalada");
                        while GetMessageW(&mut message, None, 0, 0).0 > 0 {
                            let _ = TranslateMessage(&message);
                            DispatchMessageW(&message);
                        }
                        let _ = UnhookWindowsHookEx(hook);
                    }
                    Ok(())
                };
                if let Err(error) = install() {
                    eprintln!("[Flyout] No se pudo interceptar el volumen: {error}");
                }
            });
        if let Err(error) = result {
            eprintln!("[Flyout] No se pudo iniciar la captura de volumen: {error}");
        }
    }
}

#[cfg(windows)]
pub use platform::start;
