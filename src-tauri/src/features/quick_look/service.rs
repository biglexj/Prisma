use std::collections::HashMap;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

macro_rules! ql_log {
    ($($arg:tt)*) => {{
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true).append(true)
            .open("D:\\Proyectos\\biglexj\\Prisma\\test\\hook_trace.log")
        {
            let _ = writeln!(f, "[QL-Service] {}", format!($($arg)*));
        }
    }};
}

use super::keyboard_hook::{is_preview_open, set_preview_open, start_hook, TriggerEvent};
use super::model::{QuickLookMediaType, QuickLookPayload};
use super::shell_selection::get_active_selection;

pub const DETACHED_LABEL_PREFIX: &str = "quicklook-extra";
const MAX_DETACHED_INSTANCES: u32 = 10;

#[derive(Clone)]
pub struct QuickLookState {
    app_handle: AppHandle,
    current_path: Arc<Mutex<Option<String>>>,
    last_shown: Arc<Mutex<Option<Instant>>>,
    detached_payloads: Arc<Mutex<HashMap<String, QuickLookPayload>>>,
    detached_counter: Arc<AtomicU32>,
}

impl QuickLookState {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            current_path: Arc::new(Mutex::new(None)),
            last_shown: Arc::new(Mutex::new(None)),
            detached_payloads: Arc::new(Mutex::new(HashMap::new())),
            detached_counter: Arc::new(AtomicU32::new(0)),
        }
    }

    pub fn init(&self) {
        let state_clone = self.clone();
        let callback = Arc::new(move |event: TriggerEvent| {
            let state = state_clone.clone();
            std::thread::spawn(move || match event {
                TriggerEvent::Close => {
                    ql_log!("Callback (async thread): Close");
                    state.hide();
                }
                TriggerEvent::Toggle => {
                    ql_log!("Callback (async thread): Toggle");
                    state.toggle();
                }
                TriggerEvent::Navigation => {
                    ql_log!("Callback (async thread): Navigation");
                    state.handle_navigation();
                }
            });
        });

        start_hook(callback);
    }

    pub fn toggle(&self) {
        if is_preview_open() {
            ql_log!("Toggle: la vista previa ya estaba abierta, cerrando...");
            self.hide();
            return;
        }

        ql_log!("Toggle: abriendo selección actual...");
        self.show_current_selection();
    }

    pub fn show_file_path(&self, path: &Path) -> bool {
        ql_log!("show_file_path llamado con: {:?}", path);
        if !path.is_file() {
            ql_log!("show_file_path: el path no es un archivo válido");
            return false;
        }

        let media_type = match QuickLookMediaType::from_path(path) {
            Some(mt) => mt,
            None => {
                ql_log!("show_file_path: extensión no soportada para {:?}", path);
                return false;
            }
        };

        let path_str = path.to_string_lossy().to_string();

        {
            let mut cur = self.current_path.lock().unwrap();
            *cur = Some(path_str.clone());
        }

        {
            let mut shown = self.last_shown.lock().unwrap();
            *shown = Some(Instant::now());
        }

        let payload = QuickLookPayload::new(path_str, media_type);
        let (target_w, target_h) = resolve_media_size(media_type, path);

        let _ = self.app_handle.emit("quicklook://preview", &payload);

        if let Some(window) = self.app_handle.get_webview_window("quicklook") {
            ql_log!("Abriendo ventana quicklook con tamaño: {}x{}", target_w, target_h);
            let is_max = window.is_maximized().unwrap_or(false);
            if !is_max {
                let _ = window.set_size(tauri::LogicalSize::new(target_w, target_h));
                let _ = window.center();
            }
            let _ = window.emit("quicklook://preview", &payload);
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
            let was_open = is_preview_open();
            set_preview_open(true);
            if !was_open {
                self.start_selection_watcher();
            }
            true
        } else {
            ql_log!("ERROR: No se encontró la ventana quicklook en Tauri");
            false
        }
    }

    fn start_selection_watcher(&self) {
        let state = self.clone();
        std::thread::spawn(move || {
            while is_preview_open() {
                std::thread::sleep(std::time::Duration::from_millis(150));
                if !is_preview_open() {
                    break;
                }

                // Solo verificar cambios si el foco activo del usuario está en el Explorador o Escritorio
                if !unsafe { super::keyboard_hook::is_explorer_or_desktop_focused() } {
                    continue;
                }

                let selected_path = match get_active_selection() {
                    Some(p) => p,
                    None => continue,
                };

                let path_str = selected_path.to_string_lossy().to_string();

                {
                    let cur = state.current_path.lock().unwrap();
                    if let Some(ref current) = *cur {
                        if current == &path_str {
                            continue;
                        }
                    }
                }

                let media_type = match QuickLookMediaType::from_path(&selected_path) {
                    Some(mt) => mt,
                    None => continue,
                };

                {
                    let mut cur = state.current_path.lock().unwrap();
                    *cur = Some(path_str.clone());
                }

                let payload = QuickLookPayload::new(path_str, media_type);
                let (target_w, target_h) = resolve_media_size(media_type, &selected_path);

                let _ = state.app_handle.emit("quicklook://preview", &payload);

                if let Some(window) = state.app_handle.get_webview_window("quicklook") {
                    let _ = window.set_size(tauri::LogicalSize::new(target_w, target_h));
                    let _ = window.emit("quicklook://preview", &payload);
                }
            }
        });
    }

    pub fn show_current_selection(&self) {
        let selected_path = match get_active_selection() {
            Some(p) => p,
            None => return,
        };

        self.show_file_path(&selected_path);
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
            let (target_w, target_h) = resolve_media_size(media_type, &selected_path);

            let _ = state.app_handle.emit("quicklook://preview", &payload);

            if let Some(window) = state.app_handle.get_webview_window("quicklook") {
                let _ = window.set_size(tauri::LogicalSize::new(target_w, target_h));
                let _ = window.emit("quicklook://preview", &payload);
            }
        });
    }

    #[allow(dead_code)]
    pub fn can_hide_on_unfocus(&self) -> bool {
        if !is_preview_open() {
            return false;
        }

        let shown_guard = self.last_shown.lock().unwrap();
        if let Some(instant) = *shown_guard {
            // Permitir pequeña ventana de gracia de 100ms tras mostrar la ventana
            instant.elapsed().as_millis() >= 100
        } else {
            true
        }
    }

    pub fn hide(&self) {
        set_preview_open(false);
        {
            let mut cur = self.current_path.lock().unwrap();
            *cur = None;
        }
        {
            let mut shown = self.last_shown.lock().unwrap();
            *shown = None;
        }

        let _ = self.app_handle.emit("quicklook://hide", ());

        if let Some(window) = self.app_handle.get_webview_window("quicklook") {
            let _ = window.emit("quicklook://hide", ());
            let _ = window.hide();
        }
    }

    pub fn open_in_main(&self, path: String, current_time: Option<f64>) {
        self.hide();

        if let Some(main_window) = self.app_handle.get_webview_window("main") {
            let _ = main_window.unminimize();
            let _ = main_window.show();
            let _ = main_window.set_focus();
            let payload = OpenMediaPayload { path, current_time };
            let _ = main_window.emit("prisma://open-media", payload);
        }
    }

    pub fn get_current_payload(&self) -> Option<QuickLookPayload> {
        let cur = self.current_path.lock().unwrap();
        let path_str = cur.as_ref()?.clone();
        let path = std::path::Path::new(&path_str);
        let media_type = QuickLookMediaType::from_path(path)?;
        Some(QuickLookPayload::new(path_str, media_type))
    }

    pub fn open_detached(&self, path: &str) -> Result<String, String> {
        let clean = path.trim_start_matches(r"\\?\").trim_start_matches(r"\\?\UNC\").to_string();
        let win_path = clean.replace('/', "\\");
        let file_path = if Path::new(&win_path).is_file() {
            Path::new(&win_path)
        } else if Path::new(path).is_file() {
            Path::new(path)
        } else {
            return Err("El archivo ya no existe".to_string());
        };

        let media_type = QuickLookMediaType::from_path(file_path)
            .ok_or_else(|| "Tipo de archivo no soportado".to_string())?;

        let payload = QuickLookPayload::new(win_path.clone(), media_type);
        let (target_w, target_h) = resolve_media_size(media_type, file_path);

        let open_count = self.detached_payloads.lock().unwrap().len() as u32;
        if open_count >= MAX_DETACHED_INSTANCES {
            return Err(format!(
                "Solo puedes abrir {MAX_DETACHED_INSTANCES} instancias a la vez"
            ));
        }

        let label = loop {
            let n = self.detached_counter.fetch_add(1, Ordering::SeqCst) + 1;
            let candidate = format!("{DETACHED_LABEL_PREFIX}-{n}");
            let already_tracked = self
                .detached_payloads
                .lock()
                .unwrap()
                .contains_key(&candidate);
            if !already_tracked && self.app_handle.get_webview_window(&candidate).is_none() {
                break candidate;
            }
        };

        let mut builder = WebviewWindowBuilder::new(
            &self.app_handle,
            &label,
            WebviewUrl::App("index.html#quicklook".into()),
        )
        .title(format!("Prisma · {}", payload.file_name))
        .inner_size(target_w, target_h)
        .min_inner_size(320.0, 240.0)
        .decorations(false)
        .transparent(true)
        .resizable(true)
        .always_on_top(false)
        .skip_taskbar(false)
        .visible(false);

        if let Some(base) = self.app_handle.get_webview_window("quicklook") {
            if let Ok(pos) = base.outer_position() {
                let scale = base.scale_factor().unwrap_or(1.0);
                let logical = pos.to_logical::<f64>(scale);
                let offset = 56.0 * (open_count + 1) as f64;
                builder = builder.position(logical.x + offset, logical.y + offset * 0.75);
            }
        }

        let window = builder.build().map_err(|e| e.to_string())?;

        self.detached_payloads
            .lock()
            .unwrap()
            .insert(label.clone(), payload.clone());

        let _ = window.emit("quicklook://preview", &payload);
        let _ = window.show();
        let _ = window.set_focus();

        ql_log!("Instancia desacoplada creada: {} para {:?}", label, path);

        Ok(label)
    }

    pub fn get_detached_payload(&self, label: &str) -> Option<QuickLookPayload> {
        self.detached_payloads
            .lock()
            .unwrap()
            .get(label)
            .cloned()
    }

    pub fn remove_detached(&self, label: &str) {
        self.detached_payloads.lock().unwrap().remove(label);
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenMediaPayload {
    pub path: String,
    pub current_time: Option<f64>,
}

fn resolve_media_size(media_type: QuickLookMediaType, path: &Path) -> (f64, f64) {
    match media_type {
        QuickLookMediaType::Audio => (640.0, 390.0),
        QuickLookMediaType::Image => {
            if let Ok((nw, nh)) = image::image_dimensions(path) {
                let max_w = 1280.0;
                let max_h = 820.0;
                let header_h = 48.0;
                let max_content_h = max_h - header_h;

                let scale = (max_w / nw as f64).min(max_content_h / nh as f64).min(1.0);
                let fitted_w = ((nw as f64 * scale).round() as f64).max(320.0);
                let fitted_h = ((nh as f64 * scale).round() as f64).max(220.0);

                (fitted_w, fitted_h + header_h)
            } else {
                (800.0, 560.0)
            }
        }
        QuickLookMediaType::Video => {
            if let Some((nw, nh)) = super::model::get_video_dimensions(path) {
                let max_w = 1280.0;
                let max_h = 820.0;
                let header_h = 48.0;
                let max_content_h = max_h - header_h;

                let scale = (max_w / nw as f64).min(max_content_h / nh as f64).min(1.0);
                let fitted_w = ((nw as f64 * scale).round() as f64).max(360.0);
                let fitted_h = ((nh as f64 * scale).round() as f64).max(220.0);

                (fitted_w, fitted_h + header_h)
            } else {
                (850.0, 520.0)
            }
        }
        QuickLookMediaType::Pdf => (840.0, 720.0),
        QuickLookMediaType::Text | QuickLookMediaType::Markdown => (760.0, 560.0),
        QuickLookMediaType::Html => (920.0, 650.0),
        QuickLookMediaType::Lyrics => (680.0, 540.0),
        QuickLookMediaType::Folder => (600.0, 420.0),
        QuickLookMediaType::Project => (820.0, 580.0),
        QuickLookMediaType::Playlist => (680.0, 520.0),
        QuickLookMediaType::Generic => (560.0, 380.0),
    }
}
