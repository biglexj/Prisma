#[cfg(windows)]
pub mod windows_impl {
    use std::path::PathBuf;
    use windows::core::{w, Interface, GUID, PWSTR, VARIANT};
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, IDispatch,
        IServiceProvider, CLSCTX_LOCAL_SERVER, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{
        IFolderView, IShellBrowser, IShellItem, IShellItemArray, IShellView, IShellWindows,
        ShellWindows, SIGDN_DESKTOPABSOLUTEPARSING, SIGDN_FILESYSPATH, SVGIO_SELECTION,
    };
    use std::io::Write;
    use windows::Win32::UI::WindowsAndMessaging::{
        FindWindowExW, FindWindowW, GetAncestor, GetClassNameW, GetForegroundWindow,
        IsChild, IsWindowVisible, GA_ROOT,
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

    const SID_STOPLEVELLBROWSER: GUID =
        GUID::from_u128(0x4C96BE40_915C_11CF_99D3_00AA004AE837);
    const SID_SSHELL_BROWSER: GUID =
        GUID::from_u128(0x000214E2_0000_0000_C000_000000000046);

    pub fn get_active_selection() -> Option<PathBuf> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let result = get_selected_file_internal();
            ql_log!("get_active_selection resultado: {:?}", result);
            CoUninitialize();
            result
        }
    }

    unsafe fn get_selected_file_internal() -> Option<PathBuf> {
        let fg = unsafe { GetForegroundWindow() };
        if fg.0.is_null() {
            ql_log!("get_selected_file_internal: GetForegroundWindow es NULL");
            return None;
        }

        let mut class_name = [0u16; 256];
        let len = unsafe { GetClassNameW(fg, &mut class_name) };
        let class_str = if len > 0 {
            String::from_utf16_lossy(&class_name[..len as usize])
        } else {
            String::new()
        };

        ql_log!("Foreground HWND: {:?}, Class: '{}'", fg, class_str);

        if class_str == "CabinetWClass" || class_str == "ExploreWClass" {
            if let Some(p) = unsafe { get_selection_from_explorer(fg) } {
                return Some(p);
            }
        } else if class_str == "Progman" || class_str == "WorkerW" {
            if let Some(p) = unsafe { get_selection_from_desktop() } {
                return Some(p);
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
                    if let Some(p) = unsafe { get_selection_from_explorer(root) } {
                        return Some(p);
                    }
                } else if rclass_str == "Progman" || rclass_str == "WorkerW" {
                    if let Some(p) = unsafe { get_selection_from_desktop() } {
                        return Some(p);
                    }
                }
            }
        }

        // Si QuickLook está activo y tiene el foco (Tauri Window), buscar la selección activa en segundo plano
        if let Some(p) = unsafe { get_selection_from_explorer(HWND::default()) } {
            return Some(p);
        }
        if let Some(p) = unsafe { get_selection_from_desktop() } {
            return Some(p);
        }

        ql_log!("No se encontró selección activa en Explorer ni Desktop");
        None
    }

    unsafe fn get_selection_from_explorer(target_hwnd: HWND) -> Option<PathBuf> {
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

        let target_root = unsafe { GetAncestor(target_hwnd, GA_ROOT) };
        let target_tab = unsafe { FindWindowExW(target_hwnd, None, w!("ShellTabWindowClass"), None).unwrap_or_default() };
        let root_tab = if !target_root.0.is_null() && target_root != target_hwnd {
            unsafe { FindWindowExW(target_root, None, w!("ShellTabWindowClass"), None).unwrap_or_default() }
        } else {
            HWND::default()
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

            let window_hwnd = match unsafe { browser.GetWindow() } {
                Ok(h) => h,
                Err(_) => continue,
            };

            // En Windows 11 con pestañas, descartar pestañas en segundo plano (no visibles)
            let is_visible = unsafe { IsWindowVisible(window_hwnd).as_bool() };
            if !is_visible {
                ql_log!("Explorer window #{}: hwnd={:?} es pestaña inactiva en segundo plano, omitiendo", i, window_hwnd);
                continue;
            }

            let window_root = unsafe { GetAncestor(window_hwnd, GA_ROOT) };

            let matches_target = window_hwnd == target_hwnd
                || (target_tab != HWND::default() && window_hwnd == target_tab)
                || (root_tab != HWND::default() && window_hwnd == root_tab)
                || (target_root != HWND::default() && target_root == window_root)
                || is_child_window(target_hwnd, window_hwnd)
                || is_child_window(window_hwnd, target_hwnd);

            ql_log!(
                "Explorer window #{}: hwnd={:?}, root={:?}, matches={}",
                i, window_hwnd, window_root, matches_target
            );

            if matches_target {
                let shell_view: IShellView = match unsafe { browser.QueryActiveShellView() } {
                    Ok(v) => v,
                    Err(e) => {
                        ql_log!("QueryActiveShellView falló: {:?}", e);
                        continue;
                    }
                };

                let folder_view: IFolderView = match shell_view.cast() {
                    Ok(fv) => fv,
                    Err(e) => {
                        ql_log!("shell_view.cast::<IFolderView>() falló: {:?}", e);
                        continue;
                    }
                };

                if let Some(path) = unsafe { get_selection_from_folder_view(&folder_view) } {
                    ql_log!("Archivo resuelto con éxito: {:?}", path);
                    return Some(path);
                } else {
                    ql_log!("get_selection_from_folder_view devolvió None para window #{:?}", i);
                }
            }
        }

        // Si la coincidencia estricta de HWND falló, intentar con la ventana visible activa
        ql_log!("Intentando fallback sobre ventanas de Explorer visibles...");
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
            if !unsafe { IsWindowVisible(window_hwnd).as_bool() } {
                continue;
            }
            if let Ok(shell_view) = unsafe { browser.QueryActiveShellView() } {
                if let Ok(folder_view) = shell_view.cast::<IFolderView>() {
                    if let Some(path) = unsafe { get_selection_from_folder_view(&folder_view) } {
                        ql_log!("Fallback resolvió archivo: {:?}", path);
                        return Some(path);
                    }
                }
            }
        }

        None
    }

    unsafe fn get_selection_from_desktop() -> Option<PathBuf> {
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
                    if let Some(path) = unsafe { get_selection_from_folder_view(&folder_view) } {
                        return Some(path);
                    }
                }
            }
        }

        None
    }

    unsafe fn get_selection_from_folder_view(folder_view: &IFolderView) -> Option<PathBuf> {
        if let Ok(items) = unsafe { folder_view.Items::<IShellItemArray>(SVGIO_SELECTION) } {
            if let Ok(count) = unsafe { items.GetCount() } {
                if count > 0 {
                    if let Ok(item) = unsafe { items.GetItemAt(0) } {
                        if let Some(path) = unsafe { shell_item_to_path(&item) } {
                            return Some(path);
                        }
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
            if path.is_file() {
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
    pub fn get_active_selection() -> Option<PathBuf> {
        None
    }
}

pub use windows_impl::get_active_selection;
