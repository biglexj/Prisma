#[cfg(windows)]
pub mod windows_hook {
    use std::sync::atomic::{AtomicBool, AtomicU8, AtomicU32, Ordering};
    use std::sync::{Arc, Mutex};
    use std::io::Write;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use crate::features::quick_look::shell_selection;

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

    static LAST_SCREENSHOT_INSTANT: Mutex<Option<std::time::Instant>> = Mutex::new(None);

    pub fn record_screenshot_intent() {
        if let Ok(mut lock) = LAST_SCREENSHOT_INSTANT.lock() {
            *lock = Some(std::time::Instant::now());
        }
    }

    pub fn is_recent_screenshot_pressed() -> bool {
        if let Ok(lock) = LAST_SCREENSHOT_INSTANT.lock() {
            if let Some(t) = *lock {
                return t.elapsed().as_secs() < 8;
            }
        }
        false
    }

    pub fn is_screen_capture_in_progress() -> bool {
        if is_recent_screenshot_pressed() {
            return true;
        }
        unsafe {
            let fg = GetForegroundWindow();
            if !fg.0.is_null() {
                let mut pid = 0u32;
                GetWindowThreadProcessId(fg, Some(&mut pid));
                if pid != 0 {
                    if let Ok(handle) = windows::Win32::System::Threading::OpenProcess(
                        windows::Win32::System::Threading::PROCESS_QUERY_LIMITED_INFORMATION,
                        false,
                        pid,
                    ) {
                        let mut buf = [0u16; 512];
                        let mut size = buf.len() as u32;
                        if windows::Win32::System::Threading::QueryFullProcessImageNameW(
                            handle,
                            windows::Win32::System::Threading::PROCESS_NAME_FORMAT(0),
                            windows::core::PWSTR(buf.as_mut_ptr()),
                            &mut size,
                        ).is_ok() {
                            let name = String::from_utf16_lossy(&buf[..size as usize]).to_lowercase();
                            let _ = windows::Win32::Foundation::CloseHandle(handle);
                            if name.ends_with("snippingtool.exe") || name.ends_with("screenclippinghost.exe") {
                                return true;
                            }
                        } else {
                            let _ = windows::Win32::Foundation::CloseHandle(handle);
                        }
                    }
                }
            }
        }
        false
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

        // Si la previsualización está activa y se pulsan teclas de navegación (flechas, inicio, fin, página), actualizar la vista previa
        let is_nav_key = vk_code == VK_UP.0
            || vk_code == VK_DOWN.0
            || vk_code == VK_LEFT.0
            || vk_code == VK_RIGHT.0
            || vk_code == 0x24 // VK_HOME
            || vk_code == 0x23 // VK_END
            || vk_code == 0x21 // VK_PRIOR (PageUp)
            || vk_code == 0x22; // VK_NEXT (PageDown)

        if preview_active && is_nav_key && unsafe { is_explorer_or_desktop_focused() } {
            if !unsafe { is_text_edit_focused() } {
                if let Ok(guard) = GLOBAL_CALLBACK.lock() {
                    if let Some(ref cb) = *guard {
                        cb(TriggerEvent::Navigation);
                    }
                }
            }
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        // Comprobar la ventana en primer plano
        let fg = unsafe { GetForegroundWindow() };
        let mut pid = 0u32;
        if !fg.0.is_null() {
            unsafe { GetWindowThreadProcessId(fg, Some(&mut pid)) };
        }
        let my_pid = unsafe { windows::Win32::System::Threading::GetCurrentProcessId() };
        let is_quicklook_window = pid != 0 && pid == my_pid;

        // Evaluar modificadores activos
        let win_down = (unsafe { GetAsyncKeyState(0x5B) } as u16 & 0x8000) != 0
            || (unsafe { GetAsyncKeyState(0x5C) } as u16 & 0x8000) != 0;
        let ctrl_down = (unsafe { GetAsyncKeyState(VK_CONTROL.0 as i32) } as u16 & 0x8000) != 0
            || (unsafe { GetAsyncKeyState(0xA2) } as u16 & 0x8000) != 0
            || (unsafe { GetAsyncKeyState(0xA3) } as u16 & 0x8000) != 0;
        let alt_down = (unsafe { GetAsyncKeyState(VK_MENU.0 as i32) } as u16 & 0x8000) != 0
            || (unsafe { GetAsyncKeyState(0xA4) } as u16 & 0x8000) != 0
            || (unsafe { GetAsyncKeyState(0xA5) } as u16 & 0x8000) != 0;

        // Excepción crítica: Captura de pantalla (Impr Pant / PrintScreen, Win + Shift + S)
        let is_screenshot_key = vk_code == 0x2C; // VK_SNAPSHOT
        let is_snipping_shortcut = is_screenshot_key || (win_down && vk_code == 0x53);
        if is_snipping_shortcut {
            ql_log!("Captura de pantalla detectada (vk=0x{:02X}, win={}), preservando QuickLook", vk_code, win_down);
            record_screenshot_intent();
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        // Si la previsualización está activa y el usuario teclea fuera de QuickLook (alfanumérico, enter, etc.)
        // sin estar usando modificadores (Win/Ctrl/Alt) y sin ser tecla multimedia/función, cerrar la vista previa
        let is_modifier = vk_code == VK_SHIFT.0
            || vk_code == 0xA0 // VK_LSHIFT
            || vk_code == 0xA1 // VK_RSHIFT
            || vk_code == VK_CONTROL.0
            || vk_code == 0xA2 // VK_LCONTROL
            || vk_code == 0xA3 // VK_RCONTROL
            || vk_code == VK_MENU.0
            || vk_code == 0xA4 // VK_LMENU
            || vk_code == 0xA5 // VK_RMENU
            || vk_code == 0x5B // VK_LWIN
            || vk_code == 0x5C // VK_RWIN
            || vk_code == 0x14 // VK_CAPITAL
            || vk_code == 0x90 // VK_NUMLOCK
            || vk_code == 0x91; // VK_SCROLL

        let is_f_key = vk_code >= 0x70 && vk_code <= 0x87;
        let is_media_key = vk_code >= 0xAD && vk_code <= 0xB3;

        if preview_active
            && !is_quicklook_window
            && !is_modifier
            && !is_f_key
            && !is_media_key
            && !win_down
            && !ctrl_down
            && !alt_down
            && vk_code != VK_SPACE.0
        {
            ql_log!("Tecla fuera de QuickLook pulsada (vk=0x{:02X}), cerrando vista previa", vk_code);
            if let Ok(guard) = GLOBAL_CALLBACK.lock() {
                if let Some(ref cb) = *guard {
                    cb(TriggerEvent::Close);
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

        // Si la tecla Ctrl está pulsada, dejar pasar de inmediato para reservar Ctrl + Espacio a LyraFlow
        if ctrl_down {
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

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

        let explorer_focused = unsafe { is_explorer_or_desktop_focused() };
        ql_log!(
            "Space check: explorer_focused={}, is_quicklook_window={}, preview_active={}",
            explorer_focused, is_quicklook_window, preview_active
        );

        // Si la previsualización está activa, se puede cerrar desde Explorer O desde la propia ventana de QuickLook.
        // Si está cerrada, SOLO se abre desde Explorer o Escritorio.
        let can_trigger = if preview_active {
            explorer_focused || is_quicklook_window
        } else {
            explorer_focused
        };

        if !can_trigger {
            return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
        }

        // Si el foco está en Explorer y dentro de un cuadro de texto (ej. renombrar archivo, barra de búsqueda), ignorar
        if explorer_focused && !is_quicklook_window {
            let text_edit = unsafe { is_text_edit_focused() };
            ql_log!("Text edit focused: {}", text_edit);
            if text_edit {
                return unsafe { CallNextHookEx(None, n_code, w_param, l_param) };
            }
        }

        // Es atajo válido: activar/cerrar Quick Look
        ql_log!("Firing Space action: preview_active={}", preview_active);
        if let Ok(guard) = GLOBAL_CALLBACK.lock() {
            if let Some(ref cb) = *guard {
                if preview_active {
                    cb(TriggerEvent::Close);
                } else {
                    cb(TriggerEvent::Toggle);
                }
                return LRESULT(1); // Suprimir la pulsación
            }
        }

        unsafe { CallNextHookEx(None, n_code, w_param, l_param) }
    }

    pub unsafe fn is_explorer_or_desktop_focused() -> bool {
        let fg = unsafe { GetForegroundWindow() };
        if fg.0.is_null() {
            return false;
        }

        if unsafe { is_class_matching(fg) } {
            shell_selection::update_last_explorer_hwnd(fg);
            return true;
        }

        let root = unsafe { GetAncestor(fg, GA_ROOT) };
        if !root.0.is_null() && root != fg && unsafe { is_class_matching(root) } {
            shell_selection::update_last_explorer_hwnd(root);
            return true;
        }

        let root_owner = unsafe { GetAncestor(fg, GA_ROOTOWNER) };
        if !root_owner.0.is_null() && root_owner != fg && unsafe { is_class_matching(root_owner) } {
            shell_selection::update_last_explorer_hwnd(root_owner);
            return true;
        }

        // Comprobar si la ventana de primer plano pertenece al proceso explorer.exe
        let mut pid = 0u32;
        unsafe { GetWindowThreadProcessId(fg, Some(&mut pid)) };
        if pid != 0 {
            if let Ok(handle) = unsafe {
                windows::Win32::System::Threading::OpenProcess(
                    windows::Win32::System::Threading::PROCESS_QUERY_LIMITED_INFORMATION,
                    false,
                    pid,
                )
            } {
                let mut path_buf = [0u16; 1024];
                let mut size = path_buf.len() as u32;
                let query_res = unsafe {
                    windows::Win32::System::Threading::QueryFullProcessImageNameW(
                        handle,
                        windows::Win32::System::Threading::PROCESS_NAME_FORMAT(0),
                        windows::core::PWSTR(path_buf.as_mut_ptr()),
                        &mut size,
                    )
                };
                if query_res.is_ok() {
                    let full_path = String::from_utf16_lossy(&path_buf[..size as usize]).to_lowercase();
                    let _ = unsafe { windows::Win32::Foundation::CloseHandle(handle) };
                    if full_path.ends_with("explorer.exe") {
                        ql_log!("is_explorer_or_desktop_focused: ventana confirmada de explorer.exe (pid={})", pid);
                        shell_selection::update_last_explorer_hwnd(fg);
                        return true;
                    }
                } else {
                    let _ = unsafe { windows::Win32::Foundation::CloseHandle(handle) };
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
    pub fn record_screenshot_intent() {}
    pub fn is_recent_screenshot_pressed() -> bool { false }
    pub fn is_screen_capture_in_progress() -> bool { false }
}

pub use windows_hook::*;
