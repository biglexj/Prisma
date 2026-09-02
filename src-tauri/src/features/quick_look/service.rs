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
use super::shell_selection::{get_active_selection_info, SelectionInfo};

pub const DETACHED_LABEL_PREFIX: &str = "quicklook-extra";
const MAX_DETACHED_INSTANCES: u32 = 10;

#[derive(Clone)]
pub struct QuickLookState {
    app_handle: AppHandle,
    current_path: Arc<Mutex<Option<String>>>,
    last_shown: Arc<Mutex<Option<Instant>>>,
    detached_payloads: Arc<Mutex<HashMap<String, QuickLookPayload>>>,
    detached_counter: Arc<AtomicU32>,
    current_selection: Arc<Mutex<Option<SelectionInfo>>>,
}

impl QuickLookState {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            current_path: Arc::new(Mutex::new(None)),
            last_shown: Arc::new(Mutex::new(None)),
            detached_payloads: Arc::new(Mutex::new(HashMap::new())),
            detached_counter: Arc::new(AtomicU32::new(0)),
            current_selection: Arc::new(Mutex::new(None)),
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

    pub fn show_file_path_with_selection(
        &self,
        path: &Path,
        selection_index: Option<usize>,
        selection_total: Option<usize>,
    ) -> bool {
        ql_log!("show_file_path llamado con: {:?}", path);
        if !path.exists() {
            ql_log!("show_file_path: el path no existe");
            return false;
        }

        let media_type = match QuickLookMediaType::from_path(path) {
            Some(mt) => mt,
            None => QuickLookMediaType::Generic,
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

        let payload = QuickLookPayload::with_selection(path_str, media_type, selection_index, selection_total);
        let (target_w, target_h) = resolve_media_size(media_type, path);

        if matches!(media_type, QuickLookMediaType::Audio | QuickLookMediaType::Video) {
            if let Some(playback_state) = self.app_handle.try_state::<crate::app::state::PlaybackProbeState>() {
                let _ = playback_state.pause();
            }
        }

        let _ = self.app_handle.emit("quicklook://preview", &payload);

        if let Some(window) = self.app_handle.get_webview_window("quicklook") {
            ql_log!("Abriendo ventana quicklook con tamaño: {}x{}", target_w, target_h);
            let is_max = crate::app::commands::quick_look::quick_look_is_maximized(window.clone());
            if !is_max {
                let _ = window.set_size(tauri::LogicalSize::new(target_w, target_h));
                let _ = window.center();
            }
            let _ = window.emit("quicklook://preview", &payload);

            #[cfg(windows)]
            {
                if let Ok(hwnd) = window.hwnd() {
                    use windows::Win32::Foundation::HWND;
                    use windows::Win32::UI::WindowsAndMessaging::{
                        ShowWindow, SW_SHOWNOACTIVATE, SetWindowPos, HWND_TOP,
                        SWP_NOMOVE, SWP_NOSIZE, SWP_NOACTIVATE, SWP_SHOWWINDOW,
                    };
                    unsafe {
                        let win_hwnd = HWND(hwnd.0);
                        let _ = ShowWindow(win_hwnd, SW_SHOWNOACTIVATE);
                        let _ = SetWindowPos(
                            win_hwnd,
                            HWND_TOP,
                            0,
                            0,
                            0,
                            0,
                            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
                        );
                    }
                } else {
                    let _ = window.show();
                    let _ = window.unminimize();
                }
            }
            #[cfg(not(windows))]
            {
                let _ = window.show();
                let _ = window.unminimize();
            }

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

    pub fn show_file_path(&self, path: &Path) -> bool {
        self.show_file_path_with_selection(path, None, None)
    }

    fn start_selection_watcher(&self) {
        let state = self.clone();
        std::thread::spawn(move || {
            while is_preview_open() {
                std::thread::sleep(std::time::Duration::from_millis(100));
                if !is_preview_open() {
                    break;
                }

                // Verificar cambios si el foco activo es Explorer, Desktop o QuickLook
                let explorer_or_desktop = unsafe { super::keyboard_hook::is_explorer_or_desktop_focused() };
                let fg_is_quicklook = {
                    #[cfg(windows)]
                    {
                        use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};
                        let fg = unsafe { GetForegroundWindow() };
                        let mut pid = 0u32;
                        if !fg.0.is_null() {
                            unsafe { GetWindowThreadProcessId(fg, Some(&mut pid)) };
                        }
                        let my_pid = unsafe { windows::Win32::System::Threading::GetCurrentProcessId() };
                        pid != 0 && pid == my_pid
                    }
                    #[cfg(not(windows))]
                    {
                        false
                    }
                };

                if !explorer_or_desktop && !fg_is_quicklook {
                    continue;
                }

                let sel_info = match get_active_selection_info() {
                    Some(s) => s,
                    None => continue,
                };

                let selected_path = sel_info.primary_path.clone();
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
                    None => QuickLookMediaType::Generic,
                };

                {
                    let mut cur = state.current_path.lock().unwrap();
                    *cur = Some(path_str.clone());
                }

                let (sel_idx, sel_tot) = if sel_info.total > 1 {
                    (Some(sel_info.index), Some(sel_info.total))
                } else {
                    (None, None)
                };

                {
                    let mut sel = state.current_selection.lock().unwrap();
                    *sel = Some(sel_info);
                }

                let payload = QuickLookPayload::with_selection(path_str, media_type, sel_idx, sel_tot);
                let (target_w, target_h) = resolve_media_size(media_type, &selected_path);

                if matches!(media_type, QuickLookMediaType::Audio | QuickLookMediaType::Video) {
                    if let Some(playback_state) = state.app_handle.try_state::<crate::app::state::PlaybackProbeState>() {
                        let _ = playback_state.pause();
                    }
                }

                let _ = state.app_handle.emit("quicklook://preview", &payload);

                if let Some(window) = state.app_handle.get_webview_window("quicklook") {
                    let is_max = crate::app::commands::quick_look::quick_look_is_maximized(window.clone());
                    if !is_max {
                        let _ = window.set_size(tauri::LogicalSize::new(target_w, target_h));
                        let _ = window.center();
                    }
                    let _ = window.emit("quicklook://preview", &payload);
                }
            }
        });
    }

    pub fn show_current_selection(&self) {
        if let Some(info) = get_active_selection_info() {
            let primary = info.primary_path.clone();
            let idx = info.index;
            let total = info.total;
            {
                let mut sel = self.current_selection.lock().unwrap();
                *sel = Some(info);
            }
            if total > 1 {
                self.show_file_path_with_selection(&primary, Some(idx), Some(total));
            } else {
                self.show_file_path(&primary);
            }
        }
    }

    pub fn step_selection(&self, forward: bool) -> bool {
        let (next_path, next_idx, total) = {
            let mut guard = self.current_selection.lock().unwrap();
            let sel = match guard.as_mut() {
                Some(s) if s.total > 1 => s,
                _ => return false,
            };

            let total = sel.total;
            let new_idx = if forward {
                if sel.index >= total { 1 } else { sel.index + 1 }
            } else {
                if sel.index <= 1 { total } else { sel.index - 1 }
            };

            sel.index = new_idx;
            let path = sel.all_paths[new_idx - 1].clone();
            (path, new_idx, total)
        };

        self.show_file_path_with_selection(&next_path, Some(next_idx), Some(total))
    }

    pub fn handle_navigation(&self) {
        let state = self.clone();
        std::thread::spawn(move || {
            let delays_ms = [35, 80, 150];
            for delay in delays_ms {
                std::thread::sleep(std::time::Duration::from_millis(delay));
                if !is_preview_open() {
                    return;
                }

                let sel_info = match get_active_selection_info() {
                    Some(s) => s,
                    None => continue,
                };

                let selected_path = sel_info.primary_path.clone();
                let path_str = selected_path.to_string_lossy().to_string();

                let mut is_different = false;
                {
                    let mut cur = state.current_path.lock().unwrap();
                    if let Some(ref current) = *cur {
                        if current != &path_str {
                            *cur = Some(path_str.clone());
                            is_different = true;
                        }
                    } else {
                        *cur = Some(path_str.clone());
                        is_different = true;
                    }
                }

                if !is_different {
                    continue;
                }

                let media_type = match QuickLookMediaType::from_path(&selected_path) {
                    Some(mt) => mt,
                    None => QuickLookMediaType::Generic,
                };

                let (sel_idx, sel_tot) = if sel_info.total > 1 {
                    (Some(sel_info.index), Some(sel_info.total))
                } else {
                    (None, None)
                };

                {
                    let mut sel = state.current_selection.lock().unwrap();
                    *sel = Some(sel_info);
                }

                let payload = QuickLookPayload::with_selection(path_str, media_type, sel_idx, sel_tot);
                let (target_w, target_h) = resolve_media_size(media_type, &selected_path);

                if matches!(media_type, QuickLookMediaType::Audio | QuickLookMediaType::Video) {
                    if let Some(playback_state) = state.app_handle.try_state::<crate::app::state::PlaybackProbeState>() {
                        let _ = playback_state.pause();
                    }
                }

                let _ = state.app_handle.emit("quicklook://preview", &payload);

                if let Some(window) = state.app_handle.get_webview_window("quicklook") {
                    let is_max = crate::app::commands::quick_look::quick_look_is_maximized(window.clone());
                    if !is_max {
                        let _ = window.set_size(tauri::LogicalSize::new(target_w, target_h));
                        let _ = window.center();
                    }
                    let _ = window.emit("quicklook://preview", &payload);
                }

                return;
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
        crate::app::commands::quick_look::reset_maximize_state();
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
            #[cfg(windows)]
            {
                if let Ok(hwnd) = window.hwnd() {
                    use windows::Win32::Foundation::HWND;
                    use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE};
                    unsafe {
                        let win_hwnd = HWND(hwnd.0);
                        let _ = ShowWindow(win_hwnd, SW_HIDE);
                    }
                }
            }
            let _ = window.hide();
        }
    }

    pub fn open_in_main(&self, path: String, current_time: Option<f64>) {
        if let Some(main_window) = self.app_handle.get_webview_window("main") {
            let _ = main_window.unminimize();
            let _ = main_window.show();
            let _ = main_window.set_focus();
            let payload = OpenMediaPayload { path, current_time };
            let _ = main_window.emit("prisma://open-media", payload);
        }

        self.hide();
    }

    pub fn get_current_payload(&self) -> Option<QuickLookPayload> {
        let cur = self.current_path.lock().unwrap();
        let path_str = cur.as_ref()?.clone();
        let path = std::path::Path::new(&path_str);
        let media_type = QuickLookMediaType::from_path(path)?;
        Some(QuickLookPayload::new(path_str, media_type))
    }

    pub fn open_detached(&self, path: &str) -> Result<String, String> {
        let clean_path = path.trim_start_matches(r"\\?\");
        let p = Path::new(clean_path);
        if !p.exists() {
            return Err("El archivo no existe".into());
        }

        let open_count = self
            .detached_payloads
            .lock()
            .unwrap()
            .len();

        if open_count >= MAX_DETACHED_INSTANCES as usize {
            return Err(format!(
                "Límite alcanzado: máximo {} previsualizaciones simultáneas",
                MAX_DETACHED_INSTANCES
            ));
        }

        let media_type = QuickLookMediaType::from_path(p).unwrap_or(QuickLookMediaType::Generic);
        let payload = QuickLookPayload::new(path.to_string(), media_type);
        let (target_w, target_h) = resolve_media_size(media_type, p);

        let label = loop {
            let next_id = self.detached_counter.fetch_add(1, Ordering::SeqCst) + 1;
            let candidate = format!("{}-{}", DETACHED_LABEL_PREFIX, next_id);
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
        QuickLookMediaType::Archive => (680.0, 520.0),
        QuickLookMediaType::Epub => (760.0, 560.0),
        QuickLookMediaType::Lyrics => (680.0, 540.0),
        QuickLookMediaType::Folder => (600.0, 420.0),
        QuickLookMediaType::Project => (820.0, 580.0),
        QuickLookMediaType::Playlist => (680.0, 520.0),
        QuickLookMediaType::Generic => (560.0, 380.0),
    }
}
