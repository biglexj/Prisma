#[cfg(windows)]
pub mod windows_hook {
    use std::sync::atomic::{AtomicBool, AtomicU8, AtomicU32, Ordering};
    use std::sync::{Arc, Mutex};
    use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_CONTROL, VK_DOWN, VK_ESCAPE, VK_LEFT, VK_MENU, VK_RIGHT, VK_SHIFT,
        VK_SPACE, VK_UP,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetClassNameW, GetForegroundWindow, GetGUIThreadInfo,
        GetMessageW, PostThreadMessageW, SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx,
        GUITHREADINFO, HC_ACTION, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_QUIT,
        WM_SYSKEYDOWN,
    };

    static IS_PREVIEW_OPEN: AtomicBool = AtomicBool::new(false);
    static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);

    // 0 = Space, 1 = CtrlSpace, 2 = AltSpace, 3 = ShiftSpace, 4 = Disabled
    static SHORTCUT_MODE: AtomicU8 = AtomicU8::new(0);

    pub type TriggerCallback = Arc<dyn Fn(TriggerEvent) + Send + Sync + 'static>;

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum TriggerEvent {
        Toggle,
        Close,
        Navigation,
    }

    static GLOBAL_CALLBACK: Mutex<Option<TriggerCallback>> = Mutex::new(None);

    pub fn set_shortcut_mode(mode_str: &str) {
        let code = match mode_str {
            "ctrl_space" | "ctrl+space" => 1,
            "alt_space" | "alt+space" => 2,
            "shift_space" | "shift+space" => 3,
            "disabled" => 4,
            _ => 0, // "space" por defecto
        };
        SHORTCUT_MODE.store(code, Ordering::SeqCst);
    }

    pub fn get_shortcut_mode() -> String {
        match SHORTCUT_MODE.load(Ordering::SeqCst) {
            1 => "ctrl_space".to_string(),
            2 => "alt_space".to_string(),
            3 => "shift_space".to_string(),
            4 => "disabled".to_string(),
            _ => "space".to_string(),
        }
    }

    pub fn set_preview_open(open: bool) {
        IS_PREVIEW_OPEN.store(open, Ordering::SeqCst);
    }

    pub fn is_preview_open() -> bool {
        IS_PREVIEW_OPEN.load(Ordering::SeqCst)
    }

    pub fn start_hook(callback: TriggerCallback) {
        if let Ok(mut lock) = GLOBAL_CALLBACK.lock() {
            *lock = Some(callback);
        }

        std::thread::Builder::new()
            .name("prisma-quicklook-hook".to_string())
            .spawn(|| unsafe {
                HOOK_THREAD_ID.store(
                    windows::Win32::System::Threading::GetCurrentThreadId(),
                    Ordering::SeqCst,
                );
                let hook = match SetWindowsHookExW(
                    WH_KEYBOARD_LL,
                    Some(keyboard_proc),
                    None,
                    0,
                ) {
                    Ok(h) => h,
                    Err(e) => {
                        eprintln!("[Prisma QuickLook] Error al instalar el hook: {:?}", e);
                        return;
                    }
                };

                let mut msg = MSG::default();
                while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }

                let _ = UnhookWindowsHookEx(hook);
            })
            .expect("No se pudo iniciar el hilo del hook de teclado de Prisma");
    }

    #[allow(dead_code)]
    pub fn stop_hook() {
        let tid = HOOK_THREAD_ID.load(Ordering::SeqCst);
        if tid != 0 {
            unsafe {
                let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
            }
        }
    }

    unsafe extern "system" fn keyboard_proc(
        n_code: i32,
        w_param: WPARAM,
        l_param: LPARAM,
    ) -> LRESULT {
        if n_code < HC_ACTION as i32 {
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        let msg_type = w_param.0 as u32;
        let is_key_down = msg_type == WM_KEYDOWN || msg_type == WM_SYSKEYDOWN;

        if !is_key_down {
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        let kbd_struct = unsafe { *(l_param.0 as *const KBDLLHOOKSTRUCT) };
        let vk_code = kbd_struct.vkCode as u16;

        let preview_active = IS_PREVIEW_OPEN.load(Ordering::SeqCst);

        // Si la previsualización está activa y se pulsa Esc o Espacio, cerrar
        if preview_active && (vk_code == VK_ESCAPE.0 || vk_code == VK_SPACE.0) {
            if let Ok(guard) = GLOBAL_CALLBACK.lock() {
                if let Some(ref cb) = *guard {
                    cb(TriggerEvent::Close);
                    return LRESULT(1);
                }
            }
        }

        // Si la previsualización está activa y se pulsan flechas de dirección en Explorer, actualizar
        if preview_active
            && (vk_code == VK_UP.0
                || vk_code == VK_DOWN.0
                || vk_code == VK_LEFT.0
                || vk_code == VK_RIGHT.0)
        {
            if unsafe { is_explorer_or_desktop_focused() && !is_text_edit_focused() } {
                if let Ok(guard) = GLOBAL_CALLBACK.lock() {
                    if let Some(ref cb) = *guard {
                        cb(TriggerEvent::Navigation);
                    }
                }
            }
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        // Si no es la tecla Espacio, dejar pasar
        if vk_code != VK_SPACE.0 {
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        let mode = SHORTCUT_MODE.load(Ordering::SeqCst);
        if mode == 4 {
            // Desactivado
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        // Evaluar modificadores según el modo configurado
        let ctrl_down = (unsafe { GetAsyncKeyState(VK_CONTROL.0 as i32) } as u16 & 0x8000) != 0;
        let alt_down = (unsafe { GetAsyncKeyState(VK_MENU.0 as i32) } as u16 & 0x8000) != 0;
        let shift_down = (unsafe { GetAsyncKeyState(VK_SHIFT.0 as i32) } as u16 & 0x8000) != 0;

        let matches_shortcut = match mode {
            1 => ctrl_down && !alt_down,                       // Ctrl + Espacio
            2 => alt_down && !ctrl_down,                       // Alt + Espacio
            3 => shift_down && !ctrl_down && !alt_down,        // Shift + Espacio
            _ => !ctrl_down && !alt_down && !shift_down,       // Espacio limpio
        };

        if !matches_shortcut {
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        // Verificar si la ventana activa es Explorador o Escritorio
        if unsafe { !is_explorer_or_desktop_focused() } {
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        // Verificar si el foco está en un cuadro de texto (renombrar archivo, caja de búsqueda, etc.)
        if unsafe { is_text_edit_focused() } {
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        // Es atajo válido en Explorador/Escritorio: activar Quick Look
        if let Ok(guard) = GLOBAL_CALLBACK.lock() {
            if let Some(ref cb) = *guard {
                cb(TriggerEvent::Toggle);
                return LRESULT(1); // Suprimir la pulsación en Explorer
            }
        }

        unsafe { CallNextHookEx(None, n_code, w_param, l_param) }
    }

    unsafe fn is_explorer_or_desktop_focused() -> bool {
        let fg = unsafe { GetForegroundWindow() };
        if fg.0.is_null() {
            return false;
        }

        let mut class_name = [0u16; 256];
        let len = unsafe { GetClassNameW(fg, &mut class_name) };
        if len == 0 {
            return false;
        }

        let class_str = String::from_utf16_lossy(&class_name[..len as usize]);
        matches!(
            class_str.as_str(),
            "CabinetWClass" | "ExploreWClass" | "Progman" | "WorkerW"
        )
    }

    unsafe fn is_text_edit_focused() -> bool {
        let mut gui_info = GUITHREADINFO {
            cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
            ..Default::default()
        };

        if unsafe { GetGUIThreadInfo(0, &mut gui_info).is_err() } {
            return false;
        }

        let focus_hwnd = gui_info.hwndFocus;
        if focus_hwnd.0.is_null() {
            return false;
        }

        let mut class_name = [0u16; 256];
        let len = unsafe { GetClassNameW(focus_hwnd, &mut class_name) };
        if len == 0 {
            return false;
        }

        let class_lower = String::from_utf16_lossy(&class_name[..len as usize]).to_lowercase();

        class_lower.starts_with("edit")
            || class_lower.contains("richedit")
            || class_lower.contains("searchedit")
            || class_lower.contains("textbox")
            || class_lower.contains("breadcrumb")
    }
}

#[cfg(not(windows))]
pub mod windows_hook {
    use std::sync::Arc;
    pub type TriggerCallback = Arc<dyn Fn(TriggerEvent) + Send + Sync + 'static>;
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum TriggerEvent {
        Toggle,
        Close,
        Navigation,
    }
    pub fn set_shortcut_mode(_mode_str: &str) {}
    pub fn get_shortcut_mode() -> String { "space".to_string() }
    pub fn set_preview_open(_open: bool) {}
    pub fn is_preview_open() -> bool {
        false
    }
    pub fn start_hook(_callback: TriggerCallback) {}
    #[allow(dead_code)]
    pub fn stop_hook() {}
}

pub use windows_hook::*;
