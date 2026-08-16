#[cfg(windows)]
pub mod windows_hook {
    use std::sync::atomic::{AtomicBool, AtomicU8, AtomicU32, Ordering};
    use std::sync::{Arc, Mutex};
    use std::io::Write;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};

    macro_rules! ql_log {
        ($($arg:tt)*) => {{
            if let Ok(mut f) = std::fs::OpenOptions::new()
                .create(true).append(true)
                .open("D:\\Proyectos\\biglexj\\Prisma\\test\\hook_trace.log")
            {
                let _ = writeln!(f, "[QL-Hook] {}", format!($($arg)*));
            }
        }};
    }
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_CONTROL, VK_DOWN, VK_ESCAPE, VK_LEFT, VK_MENU, VK_RIGHT, VK_SHIFT,
        VK_SPACE, VK_UP,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetAncestor, GetClassNameW, GetForegroundWindow,
        GetGUIThreadInfo, GetMessageW, GetWindowThreadProcessId, PeekMessageW, PostThreadMessageW,
        SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx, GA_ROOT, GA_ROOTOWNER,
        GUITHREADINFO, HC_ACTION, KBDLLHOOKSTRUCT, MSG, PM_NOREMOVE, WH_KEYBOARD_LL, WM_KEYDOWN,
        WM_QUIT, WM_SYSKEYDOWN,
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
        let normalized = mode_str.to_lowercase().replace('-', "_").replace('+', "_");
        let code = match normalized.as_str() {
            "alt_space" => 2,
            "shift_space" => 3,
            "disabled" => 4,
            _ => 0, // "space" por defecto
        };
        SHORTCUT_MODE.store(code, Ordering::SeqCst);
    }

    pub fn get_shortcut_mode() -> String {
        match SHORTCUT_MODE.load(Ordering::SeqCst) {
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
                let tid = windows::Win32::System::Threading::GetCurrentThreadId();
                HOOK_THREAD_ID.store(tid, Ordering::SeqCst);
                ql_log!("Hook thread started, TID={}", tid);

                // Forzar la creación de la cola de mensajes Win32 para este worker thread antes del hook
                let mut dummy_msg = MSG::default();
                let _ = PeekMessageW(&mut dummy_msg, None, 0, 0, PM_NOREMOVE);

                let hinstance = match windows::Win32::System::LibraryLoader::GetModuleHandleW(None) {
                    Ok(h) => h.into(),
                    Err(_) => windows::Win32::Foundation::HINSTANCE::default(),
                };

                let hook = match SetWindowsHookExW(
                    WH_KEYBOARD_LL,
                    Some(keyboard_proc),
                    hinstance,
                    0,
                ) {
                    Ok(h) => {
                        ql_log!("Hook instalado exitosamente: {:?} con hinstance: {:?}", h, hinstance);
                        h
                    }
                    Err(e) => {
                        ql_log!("ERROR al instalar el hook: {:?}", e);
                        return;
                    }
                };

                ql_log!("Entrando al message loop...");
                let mut msg = MSG::default();
                while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
                ql_log!("Message loop terminado.");

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

        ql_log!("Tecla pulsada: vk=0x{:02X} ({})", vk_code, vk_code);

        let preview_active = IS_PREVIEW_OPEN.load(Ordering::SeqCst);

        // Si la previsualización está activa y se pulsa Esc, cerrar
        if preview_active && vk_code == VK_ESCAPE.0 {
            if let Ok(guard) = GLOBAL_CALLBACK.lock() {
                if let Some(ref cb) = *guard {
                    cb(TriggerEvent::Close);
                    return LRESULT(1);
                }
            }
        }

        // Si la previsualización está activa y se pulsa Espacio en Explorer (sin editar texto), cerrar
        if preview_active && vk_code == VK_SPACE.0 {
            if unsafe { is_explorer_or_desktop_focused() && !is_text_edit_focused() } {
                if let Ok(guard) = GLOBAL_CALLBACK.lock() {
                    if let Some(ref cb) = *guard {
                        cb(TriggerEvent::Close);
                        return LRESULT(1);
                    }
                }
            }
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        // Si la previsualización está activa y se pulsan flechas de dirección, actualizar la vista previa
        if preview_active
            && (vk_code == VK_UP.0
                || vk_code == VK_DOWN.0
                || vk_code == VK_LEFT.0
                || vk_code == VK_RIGHT.0)
        {
            if !unsafe { is_text_edit_focused() } {
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

        // Evaluar modificadores según el modo configurado (Ctrl, Alt, Shift)
        let ctrl_down = (unsafe { GetAsyncKeyState(VK_CONTROL.0 as i32) } as u16 & 0x8000) != 0
            || (unsafe { GetAsyncKeyState(0xA2) } as u16 & 0x8000) != 0
            || (unsafe { GetAsyncKeyState(0xA3) } as u16 & 0x8000) != 0;

        // Si la tecla Ctrl está pulsada, dejar pasar de inmediato para reservar Ctrl + Espacio a LyraFlow
        if ctrl_down {
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        let alt_down = (unsafe { GetAsyncKeyState(VK_MENU.0 as i32) } as u16 & 0x8000) != 0
            || (unsafe { GetAsyncKeyState(0xA4) } as u16 & 0x8000) != 0
            || (unsafe { GetAsyncKeyState(0xA5) } as u16 & 0x8000) != 0;

        let shift_down = (unsafe { GetAsyncKeyState(VK_SHIFT.0 as i32) } as u16 & 0x8000) != 0
            || (unsafe { GetAsyncKeyState(0xA0) } as u16 & 0x8000) != 0
            || (unsafe { GetAsyncKeyState(0xA1) } as u16 & 0x8000) != 0;

        let matches_shortcut = match mode {
            2 => alt_down && !shift_down,        // Alt + Espacio
            3 => shift_down && !alt_down,        // Shift + Espacio
            _ => !alt_down && !shift_down,       // Espacio limpio
        };

        ql_log!(
            "Space pressed — mode={} alt={} shift={} matches={}",
            mode, alt_down, shift_down, matches_shortcut
        );

        if !matches_shortcut {
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        // Verificar si la ventana activa es Explorador o Escritorio
        let explorer_focused = unsafe { is_explorer_or_desktop_focused() };
        ql_log!("Explorer/Desktop focused: {}", explorer_focused);
        if !explorer_focused {
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        // Verificar si el foco está en un cuadro de texto (renombrar archivo, caja de búsqueda, etc.)
        let text_edit = unsafe { is_text_edit_focused() };
        ql_log!("Text edit focused: {}", text_edit);
        if text_edit {
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        // Es atajo válido en Explorador/Escritorio: activar Quick Look
        ql_log!("Firing Toggle callback!");
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

        if unsafe { is_class_matching(fg) } {
            return true;
        }

        let root = unsafe { GetAncestor(fg, GA_ROOT) };
        if !root.0.is_null() && root != fg && unsafe { is_class_matching(root) } {
            return true;
        }

        let root_owner = unsafe { GetAncestor(fg, GA_ROOTOWNER) };
        if !root_owner.0.is_null() && root_owner != fg && unsafe { is_class_matching(root_owner) } {
            return true;
        }

        // Comprobar si la ventana de primer plano pertenece al proceso explorer.exe
        let mut pid = 0u32;
        unsafe { GetWindowThreadProcessId(fg, Some(&mut pid)) };
        if pid != 0 {
            if let Ok(handle) = windows::Win32::System::Threading::OpenProcess(
                windows::Win32::System::Threading::PROCESS_QUERY_LIMITED_INFORMATION,
                false,
                pid,
            ) {
                let mut path_buf = [0u16; 1024];
                let mut size = path_buf.len() as u32;
                if windows::Win32::System::Threading::QueryFullProcessImageNameW(
                    handle,
                    windows::Win32::System::Threading::PROCESS_NAME_FORMAT(0),
                    windows::core::PWSTR(path_buf.as_mut_ptr()),
                    &mut size,
                )
                .is_ok()
                {
                    let full_path = String::from_utf16_lossy(&path_buf[..size as usize]).to_lowercase();
                    let _ = windows::Win32::Foundation::CloseHandle(handle);
                    if full_path.ends_with("explorer.exe") {
                        ql_log!("is_explorer_or_desktop_focused: ventana confirmada de explorer.exe (pid={})", pid);
                        return true;
                    }
                } else {
                    let _ = windows::Win32::Foundation::CloseHandle(handle);
                }
            }
        }

        false
    }

    unsafe fn is_class_matching(hwnd: HWND) -> bool {
        let mut class_name = [0u16; 256];
        let len = unsafe { GetClassNameW(hwnd, &mut class_name) };
        if len == 0 {
            return false;
        }
        let class_str = String::from_utf16_lossy(&class_name[..len as usize]);
        ql_log!("is_class_matching: '{}'", class_str);
        matches!(
            class_str.as_str(),
            "CabinetWClass"
                | "ExploreWClass"
                | "Progman"
                | "WorkerW"
                | "Shell_TrayWnd"
                | "DirectUIHWND"
                | "SysListView32"
                | "DesktopWindowXamlSource"
                | "ShellTabWindowClass"
                | "UIItemsView"
                | "SHELLDLL_DefView"
                | "ItemsView"
        )
    }

    unsafe fn is_text_edit_focused() -> bool {
        let fg = unsafe { GetForegroundWindow() };
        if fg.0.is_null() {
            return false;
        }

        let fg_thread = unsafe { GetWindowThreadProcessId(fg, None) };
        if fg_thread == 0 {
            return false;
        }

        let mut gui_info = GUITHREADINFO {
            cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
            ..Default::default()
        };

        if unsafe { GetGUIThreadInfo(fg_thread, &mut gui_info).is_err() } {
            return false;
        }

        // Verificar si el foco está en un control de texto real
        // NOTA: NO usar hwndCaret porque Explorer establece carets de accesibilidad
        // para los ítems seleccionados, causando falsos positivos.
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

        // Solo bloquear si el foco está en un control de edición de texto genuino
        class_lower == "edit"
            || class_lower.contains("richedit")
            || class_lower.contains("searchedit")
            || class_lower.contains("netuitextbox")
            || class_lower.contains("addresseditbox")
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
