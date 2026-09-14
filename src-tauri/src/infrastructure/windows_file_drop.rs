#[cfg(windows)]
mod imp {
    use serde::Serialize;
    use std::{
        cell::{RefCell, UnsafeCell},
        ffi::OsString,
        os::windows::ffi::OsStringExt,
        path::PathBuf,
        ptr,
        rc::Rc,
    };
    use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
    use windows::{
        core::implement,
        Win32::{
            Foundation::{BOOL, HWND, LPARAM, POINT, POINTL},
            Graphics::Gdi::ScreenToClient,
            System::{
                Com::{IDataObject, DVASPECT_CONTENT, FORMATETC, TYMED_HGLOBAL},
                Ole::{
                    IDropTarget, IDropTarget_Impl, RegisterDragDrop, ReleaseStgMedium,
                    RevokeDragDrop, CF_HDROP, DROPEFFECT, DROPEFFECT_COPY, DROPEFFECT_NONE,
                },
                SystemServices::MODIFIERKEYS_FLAGS,
            },
            UI::{
                Shell::{DragQueryFileW, HDROP},
                WindowsAndMessaging::EnumChildWindows,
            },
        },
    };

    thread_local! {
        static MAIN_DROP_CONTROLLER: RefCell<Option<NativeFileDropController>> = const { RefCell::new(None) };
    }

    #[derive(Clone, Copy, Serialize)]
    struct DragPosition {
        x: f64,
        y: f64,
    }

    #[derive(Clone, Serialize)]
    struct DragPayload {
        paths: Vec<String>,
        position: DragPosition,
    }

    pub fn register_or_refresh(window: &WebviewWindow) -> Result<usize, String> {
        let tauri_parent = window
            .hwnd()
            .map_err(|error| format!("No se pudo obtener la ventana principal: {error}"))?;
        let parent = HWND(tauri_parent.0);
        let app = window.app_handle().clone();

        MAIN_DROP_CONTROLLER.with(|slot| {
            let mut slot = slot.borrow_mut();
            match slot.as_mut() {
                Some(controller) if controller.parent == parent => controller.refresh(),
                _ => {
                    *slot = Some(NativeFileDropController::new(parent, app));
                }
            }

            let count = slot
                .as_ref()
                .map(|controller| controller.drop_targets.len())
                .unwrap_or_default();
            if count == 0 {
                Err("WebView2 todavía no expuso una superficie receptora de archivos".to_string())
            } else {
                Ok(count)
            }
        })
    }

    struct NativeFileDropController {
        parent: HWND,
        app: AppHandle,
        drop_targets: Vec<(HWND, IDropTarget)>,
    }

    impl NativeFileDropController {
        fn new(parent: HWND, app: AppHandle) -> Self {
            let mut controller = Self {
                parent,
                app,
                drop_targets: Vec::new(),
            };
            controller.register_targets();
            controller
        }

        fn refresh(&mut self) {
            for (hwnd, _) in self.drop_targets.drain(..) {
                let _ = unsafe { RevokeDragDrop(hwnd) };
            }
            self.register_targets();
        }

        fn register_targets(&mut self) {
            let controller_ptr = self as *mut NativeFileDropController;
            let lparam = LPARAM(controller_ptr as isize);

            unsafe extern "system" fn enumerate_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
                let controller = unsafe {
                    &mut *(lparam.0 as *mut NativeFileDropController)
                };
                controller.inject_target(hwnd);
                true.into()
            }

            let _ = unsafe {
                EnumChildWindows(self.parent, Some(enumerate_callback), lparam)
            };
        }

        fn inject_target(&mut self, hwnd: HWND) {
            if self.drop_targets.iter().any(|(registered, _)| *registered == hwnd) {
                return;
            }

            let target: IDropTarget = NativeFileDropTarget::new(hwnd, self.app.clone()).into();
            let _ = unsafe { RevokeDragDrop(hwnd) };
            if unsafe { RegisterDragDrop(hwnd, &target) }.is_ok() {
                self.drop_targets.push((hwnd, target));
            }
        }
    }

    impl Drop for NativeFileDropController {
        fn drop(&mut self) {
            for (hwnd, _) in self.drop_targets.drain(..) {
                let _ = unsafe { RevokeDragDrop(hwnd) };
            }
        }
    }

    #[implement(IDropTarget)]
    struct NativeFileDropTarget {
        hwnd: HWND,
        app: AppHandle,
        cursor_effect: UnsafeCell<DROPEFFECT>,
        enter_is_valid: UnsafeCell<bool>,
        entered_paths: RefCell<Rc<Vec<String>>>,
    }

    impl NativeFileDropTarget {
        fn new(hwnd: HWND, app: AppHandle) -> Self {
            Self {
                hwnd,
                app,
                cursor_effect: DROPEFFECT_NONE.into(),
                enter_is_valid: false.into(),
                entered_paths: RefCell::new(Rc::new(Vec::new())),
            }
        }

        fn extract_paths(data_object: Option<&IDataObject>) -> Option<Vec<String>> {
            let format = FORMATETC {
                cfFormat: CF_HDROP.0,
                ptd: ptr::null_mut(),
                dwAspect: DVASPECT_CONTENT.0,
                lindex: -1,
                tymed: TYMED_HGLOBAL.0 as u32,
            };
            let mut medium = unsafe { data_object?.GetData(&format).ok()? };
            let hdrop = unsafe { HDROP(medium.u.hGlobal.0 as _) };
            let item_count = unsafe { DragQueryFileW(hdrop, 0xFFFF_FFFF, None) };
            let mut paths = Vec::with_capacity(item_count as usize);

            for index in 0..item_count {
                let character_count = unsafe { DragQueryFileW(hdrop, index, None) } as usize;
                let mut buffer = vec![0_u16; character_count + 1];
                unsafe { DragQueryFileW(hdrop, index, Some(&mut buffer)) };
                let path: PathBuf = OsString::from_wide(&buffer[..character_count]).into();
                paths.push(path.to_string_lossy().into_owned());
            }

            unsafe { ReleaseStgMedium(&mut medium) };
            Some(paths)
        }

        fn client_position(&self, point: &POINTL) -> DragPosition {
            let mut client_point = POINT {
                x: point.x,
                y: point.y,
            };
            let _ = unsafe { ScreenToClient(self.hwnd, &mut client_point) };
            DragPosition {
                x: client_point.x as f64,
                y: client_point.y as f64,
            }
        }

        fn emit(&self, event: &str, paths: Vec<String>, position: DragPosition) {
            let _ = self.app.emit(
                event,
                DragPayload {
                    paths,
                    position,
                },
            );
        }
    }

    #[allow(non_snake_case)]
    impl IDropTarget_Impl for NativeFileDropTarget_Impl {
        fn DragEnter(
            &self,
            data_object: Option<&IDataObject>,
            _key_state: MODIFIERKEYS_FLAGS,
            point: &POINTL,
            effect: *mut DROPEFFECT,
        ) -> windows::core::Result<()> {
            let paths = NativeFileDropTarget::extract_paths(data_object).unwrap_or_default();
            let is_valid = !paths.is_empty();
            let cursor_effect = if is_valid {
                DROPEFFECT_COPY
            } else {
                DROPEFFECT_NONE
            };

            unsafe {
                *self.enter_is_valid.get() = is_valid;
                *self.cursor_effect.get() = cursor_effect;
                *effect = cursor_effect;
            }

            if is_valid {
                *self.entered_paths.borrow_mut() = Rc::new(paths.clone());
                self.emit("prisma://native-drag-enter", paths, self.client_position(point));
            }
            Ok(())
        }

        fn DragOver(
            &self,
            _key_state: MODIFIERKEYS_FLAGS,
            point: &POINTL,
            effect: *mut DROPEFFECT,
        ) -> windows::core::Result<()> {
            let is_valid = unsafe { *self.enter_is_valid.get() };
            unsafe {
                *effect = *self.cursor_effect.get();
            }
            if is_valid {
                self.emit(
                    "prisma://native-drag-over",
                    self.entered_paths.borrow().as_ref().clone(),
                    self.client_position(point),
                );
            }
            Ok(())
        }

        fn DragLeave(&self) -> windows::core::Result<()> {
            if unsafe { *self.enter_is_valid.get() } {
                self.emit(
                    "prisma://native-drag-leave",
                    Vec::new(),
                    DragPosition { x: 0.0, y: 0.0 },
                );
            }
            unsafe {
                *self.enter_is_valid.get() = false;
                *self.cursor_effect.get() = DROPEFFECT_NONE;
            }
            *self.entered_paths.borrow_mut() = Rc::new(Vec::new());
            Ok(())
        }

        fn Drop(
            &self,
            data_object: Option<&IDataObject>,
            _key_state: MODIFIERKEYS_FLAGS,
            point: &POINTL,
            effect: *mut DROPEFFECT,
        ) -> windows::core::Result<()> {
            let paths = NativeFileDropTarget::extract_paths(data_object).unwrap_or_default();
            let is_valid = !paths.is_empty();
            unsafe {
                *effect = if is_valid {
                    DROPEFFECT_COPY
                } else {
                    DROPEFFECT_NONE
                };
                *self.enter_is_valid.get() = false;
                *self.cursor_effect.get() = DROPEFFECT_NONE;
            }
            *self.entered_paths.borrow_mut() = Rc::new(Vec::new());

            if is_valid {
                self.emit("prisma://native-drag-drop", paths, self.client_position(point));
            }
            Ok(())
        }
    }
}

#[cfg(windows)]
pub use imp::register_or_refresh;

#[cfg(not(windows))]
pub fn register_or_refresh(_window: &tauri::WebviewWindow) -> Result<usize, String> {
    Ok(0)
}
