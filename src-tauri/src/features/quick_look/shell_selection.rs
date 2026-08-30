#[cfg(windows)]
pub mod windows_impl {
    use std::path::PathBuf;
    use windows::core::{w, Interface, GUID, PWSTR, VARIANT};
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, IDispatch,
        IServiceProvider, CLSCTX_LOCAL_SERVER, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{
        IFolderView, IShellBrowser, IShellItem, IShellItemArray, IShellWindows,
        ShellWindows, SIGDN_DESKTOPABSOLUTEPARSING, SIGDN_FILESYSPATH, SVGIO_SELECTION,
    };
    use std::io::Write;
    use windows::Win32::UI::WindowsAndMessaging::{
        FindWindowExW, FindWindowW, GetAncestor, GetClassNameW, GetForegroundWindow,
        GetGUIThreadInfo, GetWindowRect, GetWindowThreadProcessId, IsChild, IsWindowVisible,
        GA_ROOT, GUITHREADINFO,
    };

    macro_rules! ql_log {
        ($($arg:tt)*) => {{
            if let Ok(mut f) = std::fs::OpenOptions::new()
                .create(true).append(true)
                .open("D:\\Proyectos\\biglexj\\Prisma\\test\\hook_trace.log")
            {
                let _ = writeln!(f, "[QL-Selection] {}", format!($($arg)*));
            }
        }};
    }

    use std::sync::atomic::{AtomicIsize, Ordering};

    const SID_STOPLEVELLBROWSER: GUID =
        GUID::from_u128(0x4C96BE40_915C_11CF_99D3_00AA004AE837);
    const SID_SSHELL_BROWSER: GUID =
        GUID::from_u128(0x000214E2_0000_0000_C000_000000000046);

    static LAST_EXPLORER_HWND: AtomicIsize = AtomicIsize::new(0);

    pub fn update_last_explorer_hwnd(hwnd: HWND) {
        if !hwnd.0.is_null() {
            LAST_EXPLORER_HWND.store(hwnd.0 as isize, Ordering::SeqCst);
        }
    }

    pub fn forward_key_to_last_explorer(vk_code: u16) {
        unsafe {
            let val = LAST_EXPLORER_HWND.load(Ordering::SeqCst);
            if val != 0 {
                let hwnd = HWND(val as *mut core::ffi::c_void);
                use windows::Win32::Foundation::{LPARAM, WPARAM};
                use windows::Win32::UI::WindowsAndMessaging::{PostMessageW, WM_KEYDOWN, WM_KEYUP};
                let _ = PostMessageW(hwnd, WM_KEYDOWN, WPARAM(vk_code as usize), LPARAM(0));
                let _ = PostMessageW(hwnd, WM_KEYUP, WPARAM(vk_code as usize), LPARAM(0xC0000001));
            }
        }
    }

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct SelectionInfo {
        pub primary_path: PathBuf,
        pub index: usize,
        pub total: usize,
        pub all_paths: Vec<PathBuf>,
    }

    pub fn get_active_selection_info() -> Option<SelectionInfo> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let result = get_selected_file_internal();
            ql_log!("get_active_selection_info resultado: {:?}", result);
            CoUninitialize();
            result
        }
    }

    #[allow(dead_code)]
    pub fn get_active_selection() -> Option<PathBuf> {
        get_active_selection_info().map(|s| s.primary_path)
    }

    unsafe fn get_selected_file_internal() -> Option<SelectionInfo> {
        let fg = unsafe { GetForegroundWindow() };
        if !fg.0.is_null() {
            let mut class_name = [0u16; 256];
            let len = unsafe { GetClassNameW(fg, &mut class_name) };
            let class_str = if len > 0 {
                String::from_utf16_lossy(&class_name[..len as usize])
            } else {
                String::new()
            };

            ql_log!("Foreground HWND: {:?}, Class: '{}'", fg, class_str);

            if class_str == "CabinetWClass" || class_str == "ExploreWClass" {
                update_last_explorer_hwnd(fg);
                if let Some(info) = unsafe { get_selection_from_explorer(fg) } {
                    return Some(info);
                }
            } else if class_str == "Progman" || class_str == "WorkerW" {
                update_last_explorer_hwnd(fg);
                if let Some(info) = unsafe { get_selection_from_desktop() } {
                    return Some(info);
                }
            }

            // Si la ventana en foco es un subcontrol de Explorer o Desktop, verificar la raíz
            let root = unsafe { GetAncestor(fg, GA_ROOT) };
            if !root.0.is_null() && root != fg {
                let mut root_class = [0u16; 256];
                let rlen = unsafe { GetClassNameW(root, &mut root_class) };
                if rlen > 0 {
                    let rclass_str = String::from_utf16_lossy(&root_class[..rlen as usize]);
                    ql_log!("Root HWND: {:?}, Class: '{}'", root, rclass_str);
                    if rclass_str == "CabinetWClass" || rclass_str == "ExploreWClass" {
                        update_last_explorer_hwnd(root);
                        if let Some(info) = unsafe { get_selection_from_explorer(root) } {
                            return Some(info);
                        }
                    } else if rclass_str == "Progman" || rclass_str == "WorkerW" {
                        update_last_explorer_hwnd(root);
                        if let Some(info) = unsafe { get_selection_from_desktop() } {
                            return Some(info);
                        }
                    }
                }
            }
        }

        // Si la ventana activa no es Explorer (ej. QuickLook o transición de foco), intentar con LAST_EXPLORER_HWND
        let val = LAST_EXPLORER_HWND.load(Ordering::SeqCst);
        if val != 0 {
            let cached = HWND(val as *mut core::ffi::c_void);
            ql_log!("Intentando selección con LAST_EXPLORER_HWND: {:?}", cached);
            if let Some(info) = unsafe { get_selection_from_explorer(cached) } {
                return Some(info);
            }
        }

        // Como fallback final, consultar todas las ventanas de Explorer disponibles
        if let Some(info) = unsafe { get_selection_from_explorer(HWND::default()) } {
            return Some(info);
        }

        // Y luego desktop
        if let Some(info) = unsafe { get_selection_from_desktop() } {
            return Some(info);
        }

        ql_log!("No se encontró selección activa");
        None
    }

    struct ExplorerTabCandidate {
        score: i32,
        window_hwnd: HWND,
        browser: IShellBrowser,
    }

    unsafe fn get_selection_from_explorer(target_hwnd: HWND) -> Option<SelectionInfo> {
        let shell_windows: IShellWindows =
            match unsafe { CoCreateInstance(&ShellWindows, None, CLSCTX_LOCAL_SERVER) } {
                Ok(sw) => sw,
                Err(e) => {
                    ql_log!("CoCreateInstance(ShellWindows) falló: {:?}", e);
                    return None;
                }
            };

        let count = match unsafe { shell_windows.Count() } {
            Ok(c) => c,
            Err(e) => {
                ql_log!("shell_windows.Count() falló: {:?}", e);
                return None;
            }
        };

        ql_log!("shell_windows.Count() = {}, target_hwnd = {:?}", count, target_hwnd);

        let target_root = if !target_hwnd.0.is_null() {
            unsafe { GetAncestor(target_hwnd, GA_ROOT) }
        } else {
            HWND::default()
        };

        // Encontrar la pestaña superior (Z-order) dentro de la ventana de Explorer
        let top_tab = if !target_root.0.is_null() {
            unsafe { FindWindowExW(target_root, None, w!("ShellTabWindowClass"), None).unwrap_or_default() }
        } else {
            HWND::default()
        };

        // Obtener el hilo y el control enfocado de la ventana objetivo
        let mut thread_pid = 0u32;
        let target_for_thread = if !target_hwnd.0.is_null() {
            target_hwnd
        } else if !target_root.0.is_null() {
            target_root
        } else {
            HWND::default()
        };

        let thread_id = if !target_for_thread.0.is_null() {
            unsafe { GetWindowThreadProcessId(target_for_thread, Some(&mut thread_pid)) }
        } else {
            0
        };

        let mut gui_info = GUITHREADINFO::default();
        gui_info.cbSize = std::mem::size_of::<GUITHREADINFO>() as u32;
        let has_gui = thread_id != 0 && unsafe { GetGUIThreadInfo(thread_id, &mut gui_info) }.is_ok();
        let focused_hwnd = if has_gui { gui_info.hwndFocus } else { HWND::default() };
        ql_log!("Thread ID: {}, Focused HWND: {:?}, Top Tab: {:?}", thread_id, focused_hwnd, top_tab);

        let mut candidates: Vec<ExplorerTabCandidate> = Vec::new();

        for i in 0..count {
            let var_index = VARIANT::from(i);
            let dispatch: IDispatch = match unsafe { shell_windows.Item(&var_index) } {
                Ok(d) => d,
                Err(_) => continue,
            };

            let service_provider: IServiceProvider = match dispatch.cast() {
                Ok(sp) => sp,
                Err(_) => continue,
            };

            let browser: IShellBrowser = match unsafe {
                service_provider.QueryService(&SID_STOPLEVELLBROWSER)
            } {
                Ok(b) => b,
                Err(_) => match unsafe { service_provider.QueryService(&SID_SSHELL_BROWSER) } {
                    Ok(b) => b,
                    Err(_) => continue,
                },
            };

            let window_hwnd = match unsafe { browser.GetWindow() } {
                Ok(h) => h,
                Err(_) => continue,
            };

            let is_visible = unsafe { IsWindowVisible(window_hwnd).as_bool() };
            let window_root = unsafe { GetAncestor(window_hwnd, GA_ROOT) };

            // Si se especificó una ventana raíz objetivo, ignorar las pestañas de otras ventanas distintas
            if !target_root.0.is_null() && window_root != target_root {
                continue;
            }

            let mut score = 0;

            // 1. Coincidencia directa o jerárquica con el control enfocado (Pestaña activa garantizada)
            if !focused_hwnd.0.is_null() {
                if window_hwnd == focused_hwnd || is_child_window(window_hwnd, focused_hwnd) {
                    score += 10000;
                }
            }

            // 2. Coincidencia con la pestaña activa en la cima de Z-order de Windows 11
            if top_tab != HWND::default() && window_hwnd == top_tab {
                score += 8000;
            }

            // 3. Coincidencia con target_hwnd
            if !target_hwnd.0.is_null() {
                if window_hwnd == target_hwnd || is_child_window(window_hwnd, target_hwnd) {
                    score += 5000;
                }
            }

            // 4. Área visible de la ventana/pestaña
            let mut rc = RECT::default();
            if unsafe { GetWindowRect(window_hwnd, &mut rc) }.is_ok() {
                let w = rc.right - rc.left;
                let h = rc.bottom - rc.top;
                if is_visible && w > 50 && h > 50 {
                    score += 1000 + (w * h / 10000);
                }
            }

            // 5. Si la ventana es visible
            if is_visible {
                score += 500;
            }

            ql_log!("Candidato #{}: hwnd={:?}, root={:?}, score={}", i, window_hwnd, window_root, score);

            candidates.push(ExplorerTabCandidate {
                score,
                window_hwnd,
                browser,
            });
        }

        // Ordenar candidatos por puntuación descendente
        candidates.sort_by(|a, b| b.score.cmp(&a.score));

        // Evaluar candidatos empezando por la pestaña activa de mayor puntuación
        for candidate in candidates {
            if let Ok(shell_view) = unsafe { candidate.browser.QueryActiveShellView() } {
                if let Ok(folder_view) = shell_view.cast::<IFolderView>() {
                    if let Some(info) = unsafe { get_selection_from_folder_view(&folder_view) } {
                        ql_log!(
                            "Archivo resuelto con éxito desde candidato (hwnd={:?}, score={}): {:?}",
                            candidate.window_hwnd,
                            candidate.score,
                            info.primary_path
                        );
                        return Some(info);
                    }
                }
            }
        }

        None
    }

    unsafe fn get_selection_from_desktop() -> Option<SelectionInfo> {
        let progman = unsafe { FindWindowW(w!("Progman"), None).unwrap_or_default() };
        let mut def_view =
            unsafe { FindWindowExW(progman, None, w!("SHELLDLL_DefView"), None).unwrap_or_default() };

        if def_view.0.is_null() {
            let mut worker =
                unsafe { FindWindowExW(None, None, w!("WorkerW"), None).unwrap_or_default() };
            while !worker.0.is_null() {
                def_view = unsafe {
                    FindWindowExW(worker, None, w!("SHELLDLL_DefView"), None).unwrap_or_default()
                };
                if !def_view.0.is_null() {
                    break;
                }
                worker = unsafe {
                    FindWindowExW(None, worker, w!("WorkerW"), None).unwrap_or_default()
                };
            }
        }

        let shell_windows: IShellWindows =
            match unsafe { CoCreateInstance(&ShellWindows, None, CLSCTX_LOCAL_SERVER) } {
                Ok(sw) => sw,
                Err(_) => return None,
            };

        let count = match unsafe { shell_windows.Count() } {
            Ok(c) => c,
            Err(_) => return None,
        };

        for i in 0..count {
            let var_index = VARIANT::from(i);
            let dispatch: IDispatch = match unsafe { shell_windows.Item(&var_index) } {
                Ok(d) => d,
                Err(_) => continue,
            };

            let service_provider: IServiceProvider = match dispatch.cast() {
                Ok(sp) => sp,
                Err(_) => continue,
            };

            let browser: IShellBrowser = match unsafe {
                service_provider.QueryService(&SID_STOPLEVELLBROWSER)
            } {
                Ok(b) => b,
                Err(_) => match unsafe { service_provider.QueryService(&SID_SSHELL_BROWSER) } {
                    Ok(b) => b,
                    Err(_) => continue,
                },
            };

            if let Ok(shell_view) = unsafe { browser.QueryActiveShellView() } {
                if let Ok(folder_view) = shell_view.cast::<IFolderView>() {
                    if let Some(info) = unsafe { get_selection_from_folder_view(&folder_view) } {
                        return Some(info);
                    }
                }
            }
        }

        None
    }

    unsafe fn get_selection_from_folder_view(folder_view: &IFolderView) -> Option<SelectionInfo> {
        // 1. Intentar obtener el elemento seleccionado
        if let Ok(items) = unsafe { folder_view.Items::<IShellItemArray>(SVGIO_SELECTION) } {
            if let Ok(count) = unsafe { items.GetCount() } {
                if count > 0 {
                    let mut paths = Vec::new();
                    for i in 0..count {
                        if let Ok(item) = unsafe { items.GetItemAt(i) } {
                            if let Some(path) = unsafe { shell_item_to_path(&item) } {
                                paths.push(path);
                            }
                        }
                    }
                    if !paths.is_empty() {
                        let primary = paths[0].clone();
                        let total = paths.len();
                        return Some(SelectionInfo {
                            primary_path: primary,
                            index: 1,
                            total,
                            all_paths: paths,
                        });
                    }
                }
            }
        }

        // 2. Si no hay selección estándar, comprobar elementos marcados / checked
        use windows::Win32::UI::Shell::SVGIO_CHECKED;
        if let Ok(items) = unsafe { folder_view.Items::<IShellItemArray>(SVGIO_CHECKED) } {
            if let Ok(count) = unsafe { items.GetCount() } {
                if count > 0 {
                    let mut paths = Vec::new();
                    for i in 0..count {
                        if let Ok(item) = unsafe { items.GetItemAt(i) } {
                            if let Some(path) = unsafe { shell_item_to_path(&item) } {
                                paths.push(path);
                            }
                        }
                    }
                    if !paths.is_empty() {
                        let primary = paths[0].clone();
                        let total = paths.len();
                        return Some(SelectionInfo {
                            primary_path: primary,
                            index: 1,
                            total,
                            all_paths: paths,
                        });
                    }
                }
            }
        }

        None
    }

    unsafe fn shell_item_to_path(item: &IShellItem) -> Option<PathBuf> {
        let display_name = match unsafe { item.GetDisplayName(SIGDN_FILESYSPATH) } {
            Ok(pwstr) => pwstr,
            Err(_) => match unsafe { item.GetDisplayName(SIGDN_DESKTOPABSOLUTEPARSING) } {
                Ok(pwstr) => pwstr,
                Err(_) => return None,
            },
        };

        let path_str = unsafe { pwstr_to_string(display_name) };
        unsafe { CoTaskMemFree(Some(display_name.0 as *const _)) };

        if let Some(p) = path_str {
            let path = PathBuf::from(p);
            if path.exists() {
                return Some(path);
            }
        }

        None
    }

    fn is_child_window(parent: HWND, child: HWND) -> bool {
        unsafe { IsChild(parent, child).as_bool() || IsChild(child, parent).as_bool() }
    }

    unsafe fn pwstr_to_string(pwstr: PWSTR) -> Option<String> {
        if pwstr.0.is_null() {
            return None;
        }
        let len = unsafe { (0..).take_while(|&i| *pwstr.0.add(i) != 0).count() };
        let slice = unsafe { std::slice::from_raw_parts(pwstr.0, len) };
        Some(String::from_utf16_lossy(slice))
    }
}

#[cfg(not(windows))]
pub mod windows_impl {
    use std::path::PathBuf;

    #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct SelectionInfo {
        pub primary_path: PathBuf,
        pub index: usize,
        pub total: usize,
        pub all_paths: Vec<PathBuf>,
    }

    pub fn get_active_selection_info() -> Option<SelectionInfo> {
        None
    }

    pub fn get_active_selection() -> Option<PathBuf> {
        None
    }
    pub fn forward_key_to_last_explorer(_vk_code: u16) {}
}

pub use windows_impl::*;

