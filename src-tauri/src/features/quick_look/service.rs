use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

use super::keyboard_hook::{is_preview_open, set_preview_open, start_hook, TriggerEvent};
use super::model::{QuickLookMediaType, QuickLookPayload};
use super::shell_selection::get_active_selection;

#[derive(Clone)]
pub struct QuickLookState {
    app_handle: AppHandle,
    current_path: Arc<Mutex<Option<String>>>,
}

impl QuickLookState {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            current_path: Arc::new(Mutex::new(None)),
        }
    }

    pub fn init(&self) {
        let state_clone = self.clone();
        let callback = Arc::new(move |event: TriggerEvent| {
            let state = state_clone.clone();
            match event {
                TriggerEvent::Close => {
                    state.hide();
                }
                TriggerEvent::Toggle => {
                    state.toggle();
                }
                TriggerEvent::Navigation => {
                    state.handle_navigation();
                }
            }
        });

        start_hook(callback);
    }

    pub fn toggle(&self) {
        if is_preview_open() {
            self.hide();
            return;
        }

        self.show_current_selection();
    }

    pub fn show_current_selection(&self) {
        let selected_path = match get_active_selection() {
            Some(p) => p,
            None => return,
        };

        let media_type = match QuickLookMediaType::from_path(&selected_path) {
            Some(mt) => mt,
            None => return, // No es imagen, vídeo o música
        };

        let path_str = selected_path.to_string_lossy().to_string();

        {
            let mut cur = self.current_path.lock().unwrap();
            *cur = Some(path_str.clone());
        }

        let payload = QuickLookPayload::new(path_str, media_type);

        if let Some(window) = self.app_handle.get_webview_window("quicklook") {
            let _ = window.emit("quicklook://preview", &payload);
            let _ = window.show();
            let _ = window.set_focus();
            set_preview_open(true);
        }
    }

    pub fn handle_navigation(&self) {
        let state = self.clone();
        std::thread::spawn(move || {
            // Breve espera para que el Explorador actualice su selección COM interna
            std::thread::sleep(std::time::Duration::from_millis(40));

            let selected_path = match get_active_selection() {
                Some(p) => p,
                None => return,
            };

            let path_str = selected_path.to_string_lossy().to_string();

            {
                let cur = state.current_path.lock().unwrap();
                if let Some(ref current) = *cur {
                    if current == &path_str {
                        return;
                    }
                }
            }

            let media_type = match QuickLookMediaType::from_path(&selected_path) {
                Some(mt) => mt,
                None => return,
            };

            {
                let mut cur = state.current_path.lock().unwrap();
                *cur = Some(path_str.clone());
            }

            let payload = QuickLookPayload::new(path_str, media_type);

            if let Some(window) = state.app_handle.get_webview_window("quicklook") {
                let _ = window.emit("quicklook://preview", &payload);
            }
        });
    }

    pub fn hide(&self) {
        set_preview_open(false);
        {
            let mut cur = self.current_path.lock().unwrap();
            *cur = None;
        }

        if let Some(window) = self.app_handle.get_webview_window("quicklook") {
            let _ = window.emit("quicklook://hide", ());
            let _ = window.hide();
        }
    }

    pub fn open_in_main(&self, path: String) {
        self.hide();

        if let Some(main_window) = self.app_handle.get_webview_window("main") {
            let _ = main_window.unminimize();
            let _ = main_window.show();
            let _ = main_window.set_focus();
            let _ = main_window.emit("prisma://open-media", path);
        }
    }

    pub fn get_current_payload(&self) -> Option<QuickLookPayload> {
        let cur = self.current_path.lock().unwrap();
        let path_str = cur.as_ref()?.clone();
        let path = std::path::Path::new(&path_str);
        let media_type = QuickLookMediaType::from_path(path)?;
        Some(QuickLookPayload::new(path_str, media_type))
    }
}
