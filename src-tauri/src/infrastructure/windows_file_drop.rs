#[cfg(windows)]
mod imp {
    use serde::Serialize;
    use std::{
        cell::{RefCell, UnsafeCell},
        collections::HashMap,
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
                Memory::{GlobalLock, GlobalUnlock, GlobalSize},
                DataExchange::RegisterClipboardFormatW,
                Com::{CoCreateInstance, CLSCTX_INPROC_SERVER, IDataObject, DVASPECT_CONTENT, FORMATETC, TYMED_HGLOBAL},
                Ole::{
                    IDropTarget, IDropTarget_Impl, RegisterDragDrop, ReleaseStgMedium,
                    RevokeDragDrop, CF_HDROP, DROPEFFECT, DROPEFFECT_COPY, DROPEFFECT_NONE,
                },
                SystemServices::{MODIFIERKEYS_FLAGS, MK_SHIFT},
            },
            UI::{
                Shell::{DragQueryFileW, HDROP, CLSID_DragDropHelper, IDropTargetHelper},
                WindowsAndMessaging::EnumChildWindows,
            },
        },
    };

    thread_local! {
        static DROP_CONTROLLERS: RefCell<HashMap<String, NativeFileDropController>> = RefCell::new(HashMap::new());
    }

    #[derive(Clone, Copy, Serialize)]
    struct DragPosition {
        x: f64,
        y: f64,
    }

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct DragPayload {
        paths: Vec<String>,
        position: DragPosition,
        text: Option<String>,
        shift_key: bool,
    }

    pub fn register_or_refresh(window: &WebviewWindow) -> Result<usize, String> {
        let tauri_parent = window
            .hwnd()
            .map_err(|error| format!("No se pudo obtener la ventana principal: {error}"))?;
        let parent = HWND(tauri_parent.0);
        let app = window.app_handle().clone();

        DROP_CONTROLLERS.with(|controllers| {
            let mut controllers = controllers.borrow_mut();
            let slot = controllers.entry(window.label().to_string()).or_insert_with(|| NativeFileDropController::new(parent, app.clone(), window.label().to_string()));
            if slot.parent == parent { slot.refresh(); }
            else { *slot = NativeFileDropController::new(parent, app, window.label().to_string()); }
            let count = slot.drop_targets.len();
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
        label: String,
        drop_targets: Vec<(HWND, IDropTarget)>,
    }

    impl NativeFileDropController {
        fn new(parent: HWND, app: AppHandle, label: String) -> Self {
            let mut controller = Self {
                parent,
                app,
                label,
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

            let target: IDropTarget = NativeFileDropTarget::new(hwnd, self.parent, self.app.clone(), self.label.clone()).into();
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
        parent: HWND,
        app: AppHandle,
        label: String,
        drag_image_helper: Option<IDropTargetHelper>,
        cursor_effect: UnsafeCell<DROPEFFECT>,
        enter_is_valid: UnsafeCell<bool>,
        entered_paths: RefCell<Rc<Vec<String>>>,
    }

    impl NativeFileDropTarget {
        fn new(hwnd: HWND, parent: HWND, app: AppHandle, label: String) -> Self {
            Self {
                hwnd,
                parent,
                app,
                label,
                drag_image_helper: unsafe {
                    CoCreateInstance(&CLSID_DragDropHelper, None, CLSCTX_INPROC_SERVER).ok()
                },
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
            let _ = unsafe { ScreenToClient(self.parent, &mut client_point) };
            DragPosition {
                x: client_point.x as f64,
                y: client_point.y as f64,
            }
        }

        fn text_data(&self, data_object: Option<&IDataObject>) -> Option<String> {
            if self.label != "system_drop_zone" { return None; }
            // Chrome/Edge proporcionan la URL de imagen en HTML Format o texto Unicode.
            unsafe {
                let html_format = RegisterClipboardFormatW(windows::core::w!("HTML Format")) as u16;
                for (format_id, unicode) in [(html_format, false), (13, true)] {
                    let format = FORMATETC { cfFormat: format_id, ptd: ptr::null_mut(), dwAspect: DVASPECT_CONTENT.0, lindex: -1, tymed: TYMED_HGLOBAL.0 as u32 };
                    let Some(object) = data_object else { return None; };
                    let Ok(mut medium) = object.GetData(&format) else { continue; };
                    let memory = medium.u.hGlobal;
                    let size = GlobalSize(memory);
                    let pointer = GlobalLock(memory);
                    let text = if !pointer.is_null() && size <= 8 * 1024 * 1024 {
                        let result = if unicode {
                            let data = std::slice::from_raw_parts(pointer as *const u16, size / 2);
                            String::from_utf16_lossy(&data[..data.iter().position(|c| *c == 0).unwrap_or(data.len())])
                        } else {
                            String::from_utf8_lossy(std::slice::from_raw_parts(pointer as *const u8, size)).to_string()
                        };
                        Some(result)
                    } else { None };
                    if !pointer.is_null() { let _ = GlobalUnlock(memory); }
                    ReleaseStgMedium(&mut medium);
                    if let Some(text) = text {
                        if unicode && !text.trim().is_empty() { return Some(text); }
                        if !unicode {
                            let lower = text.to_lowercase();
                            if let Some(img) = lower.find("<img") {
                                let fragment = &text[img..];
                                if let Some(src) = fragment.to_lowercase().find("src=") {
                                    let value = fragment[src + 4..].trim_start();
                                    if let Some(quote) = value.chars().next().filter(|c| *c == '\'' || *c == '"') {
                                        if let Some(end) = value[1..].find(quote) {
                                            return Some(value[1..end + 1].replace("&amp;", "&"));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            None
        }

        fn emit(&self, event: &str, paths: Vec<String>, position: DragPosition, text: Option<String>, key_state: MODIFIERKEYS_FLAGS) {
            let payload = DragPayload { paths, position, text, shift_key: key_state.0 & MK_SHIFT.0 != 0 };
            if self.label == "system_drop_zone" {
                let event = event.replace("prisma://native-", "prisma:vault-");
                let _ = self.app.emit_to(self.label.as_str(), &event, payload);
            } else {
                let _ = self.app.emit(event, payload);
            }
        }

    }

    #[allow(non_snake_case)]
    impl IDropTarget_Impl for NativeFileDropTarget_Impl {
        fn DragEnter(
            &self,
            data_object: Option<&IDataObject>,
            key_state: MODIFIERKEYS_FLAGS,
            point: &POINTL,
            effect: *mut DROPEFFECT,
        ) -> windows::core::Result<()> {
            let paths = NativeFileDropTarget::extract_paths(data_object).unwrap_or_default();
            let text = if paths.is_empty() { self.text_data(data_object) } else { None };
            let is_valid = !paths.is_empty() || text.is_some();
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

            if let Some(helper) = &self.drag_image_helper {
                let position = POINT { x: point.x, y: point.y };
                let _ = unsafe { helper.DragEnter(self.hwnd, data_object, &position, cursor_effect) };
            }

            if is_valid {
                *self.entered_paths.borrow_mut() = Rc::new(paths.clone());
                self.emit("prisma://native-drag-enter", paths, self.client_position(point), text, key_state);
            }
            Ok(())
        }

        fn DragOver(
            &self,
            key_state: MODIFIERKEYS_FLAGS,
            point: &POINTL,
            effect: *mut DROPEFFECT,
        ) -> windows::core::Result<()> {
            let is_valid = unsafe { *self.enter_is_valid.get() };
            unsafe {
                *effect = *self.cursor_effect.get();
            }
            if let Some(helper) = &self.drag_image_helper {
                let position = POINT { x: point.x, y: point.y };
                let _ = unsafe { helper.DragOver(&position, *effect) };
            }
            if is_valid {
                self.emit(
                    "prisma://native-drag-over",
                    self.entered_paths.borrow().as_ref().clone(),
                    self.client_position(point),
                    None,
                    key_state,
                );
            }
            Ok(())
        }

        fn DragLeave(&self) -> windows::core::Result<()> {
            if let Some(helper) = &self.drag_image_helper {
                let _ = unsafe { helper.DragLeave() };
            }
            if unsafe { *self.enter_is_valid.get() } {
                self.emit(
                    "prisma://native-drag-leave",
                    Vec::new(),
                    DragPosition { x: 0.0, y: 0.0 },
                    None,
                    MODIFIERKEYS_FLAGS(0),
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
            key_state: MODIFIERKEYS_FLAGS,
            point: &POINTL,
            effect: *mut DROPEFFECT,
        ) -> windows::core::Result<()> {
            let paths = NativeFileDropTarget::extract_paths(data_object).unwrap_or_default();
            let text = if paths.is_empty() { self.text_data(data_object) } else { None };
            let is_valid = !paths.is_empty() || text.is_some();
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

            if let Some(helper) = &self.drag_image_helper {
                let position = POINT { x: point.x, y: point.y };
                let _ = unsafe { helper.Drop(data_object, &position, *effect) };
            }
            if is_valid {
                self.emit("prisma://native-drag-drop", paths, self.client_position(point), text, key_state);
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
