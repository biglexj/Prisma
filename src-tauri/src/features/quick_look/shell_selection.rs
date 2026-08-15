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
        ShellWindows, SIGDN_FILESYSPATH, SVGIO_SELECTION, SWC_DESKTOP, SWFO_NEEDDISPATCH,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        FindWindowExW, FindWindowW, GetClassNameW, GetForegroundWindow, IsChild,
    };

    const SID_STOPLEVELLBROWSER: GUID =
        GUID::from_u128(0x4C96BE40_915C_11CF_99D3_00AA004AE837);
    const SID_SSHELL_BROWSER: GUID =
        GUID::from_u128(0x000214E2_0000_0000_C000_000000000046);

    pub fn get_active_selection() -> Option<PathBuf> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let result = get_selected_file_internal();
            CoUninitialize();
            result
        }
    }

    unsafe fn get_selected_file_internal() -> Option<PathBuf> {
        let foreground_hwnd = unsafe { GetForegroundWindow() };
        if foreground_hwnd.0.is_null() {
            return None;
        }

        let mut class_name = [0u16; 256];
        let len = unsafe { GetClassNameW(foreground_hwnd, &mut class_name) };
        if len == 0 {
            return None;
        }
        let class_str = String::from_utf16_lossy(&class_name[..len as usize]);

        if class_str == "CabinetWClass" || class_str == "ExploreWClass" {
            unsafe { get_selection_from_explorer(foreground_hwnd) }
        } else if class_str == "Progman" || class_str == "WorkerW" {
            unsafe { get_selection_from_desktop() }
        } else {
            None
        }
    }

    unsafe fn get_selection_from_explorer(target_hwnd: HWND) -> Option<PathBuf> {
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

            let window_hwnd = match unsafe { browser.GetWindow() } {
                Ok(h) => h,
                Err(_) => continue,
            };

            if window_hwnd == target_hwnd || is_child_window(target_hwnd, window_hwnd) {
                let shell_view: IShellView = match unsafe { browser.QueryActiveShellView() } {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let folder_view: IFolderView = match shell_view.cast() {
                    Ok(fv) => fv,
                    Err(_) => continue,
                };

                if let Some(path) = unsafe { get_selection_from_folder_view(&folder_view) } {
                    return Some(path);
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
                worker =
                    unsafe { FindWindowExW(None, worker, w!("WorkerW"), None).unwrap_or_default() };
            }
        }

        let shell_windows: IShellWindows =
            match unsafe { CoCreateInstance(&ShellWindows, None, CLSCTX_LOCAL_SERVER) } {
                Ok(sw) => sw,
                Err(_) => return None,
            };

        let pvar_loc = VARIANT::from(windows::Win32::UI::Shell::CSIDL_DESKTOP as i32);
        let pvar_loc_empty = VARIANT::default();
        let mut pl_cookie = 0i32;

        let dispatch: IDispatch = match unsafe {
            shell_windows.FindWindowSW(
                &pvar_loc,
                &pvar_loc_empty,
                SWC_DESKTOP,
                &mut pl_cookie,
                SWFO_NEEDDISPATCH,
            )
        } {
            Ok(d) => d,
            Err(_) => return None,
        };

        let service_provider: IServiceProvider = match dispatch.cast() {
            Ok(sp) => sp,
            Err(_) => return None,
        };

        let browser: IShellBrowser = match unsafe {
            service_provider.QueryService(&SID_STOPLEVELLBROWSER)
        } {
            Ok(b) => b,
            Err(_) => return None,
        };

        let shell_view: IShellView = match unsafe { browser.QueryActiveShellView() } {
            Ok(v) => v,
            Err(_) => return None,
        };

        let folder_view: IFolderView = match shell_view.cast() {
            Ok(fv) => fv,
            Err(_) => return None,
        };

        unsafe { get_selection_from_folder_view(&folder_view) }
    }

    unsafe fn get_selection_from_folder_view(folder_view: &IFolderView) -> Option<PathBuf> {
        let items: IShellItemArray = match unsafe { folder_view.Items(SVGIO_SELECTION) } {
            Ok(arr) => arr,
            Err(_) => return None,
        };

        let count = match unsafe { items.GetCount() } {
            Ok(c) => c,
            Err(_) => return None,
        };

        if count == 0 {
            return None;
        }

        let item: IShellItem = match unsafe { items.GetItemAt(0) } {
            Ok(it) => it,
            Err(_) => return None,
        };

        let display_name = match unsafe { item.GetDisplayName(SIGDN_FILESYSPATH) } {
            Ok(pwstr) => pwstr,
            Err(_) => return None,
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
