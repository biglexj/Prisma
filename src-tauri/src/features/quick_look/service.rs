use std::collections::HashMap;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
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
use super::shell_selection::{get_active_selection_info, get_foreground_selection_info, foreground_selection_source, SelectionInfo};

pub const DETACHED_LABEL_PREFIX: &str = "quicklook-extra";
const MAX_DETACHED_INSTANCES: u32 = 10;

#[derive(Clone)]
pub struct QuickLookState {
    app_handle: AppHandle,
    current_path: Arc<Mutex<Option<String>>>,
    preview_revision: Arc<AtomicU32>,
    last_shown: Arc<Mutex<Option<Instant>>>,
    detached_payloads: Arc<Mutex<HashMap<String, QuickLookPayload>>>,
    detached_counter: Arc<AtomicU32>,
    current_selection: Arc<Mutex<Option<SelectionInfo>>>,
    current_payload: Arc<Mutex<Option<QuickLookPayload>>>,
    is_comparing: Arc<AtomicBool>,
    is_pinned: Arc<AtomicBool>,
}

impl QuickLookState {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            current_path: Arc::new(Mutex::new(None)),
            preview_revision: Arc::new(AtomicU32::new(0)),
            last_shown: Arc::new(Mutex::new(None)),
            detached_payloads: Arc::new(Mutex::new(HashMap::new())),
            detached_counter: Arc::new(AtomicU32::new(0)),
            current_selection: Arc::new(Mutex::new(None)),
            current_payload: Arc::new(Mutex::new(None)),
            is_comparing: Arc::new(AtomicBool::new(false)),
            is_pinned: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn set_comparing(&self, comparing: bool) {
        self.is_comparing.store(comparing, Ordering::SeqCst);
        ql_log!("Modo comparador: {}", comparing);
    }

    #[allow(dead_code)]
    pub fn is_comparing(&self) -> bool {
        self.is_comparing.load(Ordering::SeqCst)
    }

    pub fn set_pinned(&self, pinned: bool) {
        self.is_pinned.store(pinned, Ordering::SeqCst);
        super::keyboard_hook::set_pinned_state(pinned);
        ql_log!("Modo fijado/bloqueado: {}", pinned);
        if let Some(window) = self.app_handle.get_webview_window("quicklook") {
            let _ = window.set_always_on_top(true);
        }
    }

    pub fn is_pinned(&self) -> bool {
        self.is_pinned.load(Ordering::SeqCst)
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
        if self.is_comparing.load(Ordering::SeqCst) {
            ql_log!("Toggle ignorado: comparativa activa");
            return;
        }

        if is_preview_open() {
            if self.is_pinned.load(Ordering::SeqCst) {
                ql_log!("Toggle en ventana fijada: actualizando a selección de Explorer...");
                self.show_current_selection();
                return;
            } else {
                ql_log!("Toggle: la vista previa ya estaba abierta, cerrando...");
                self.hide();
                return;
            }
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

        self.preview_revision.fetch_add(1, Ordering::SeqCst);
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
        let known_dims = payload.width.zip(payload.height);
        let (target_w, target_h) = resolve_media_size(&self.app_handle, media_type, path, known_dims);
        *self.current_payload.lock().unwrap() = Some(payload.clone());

        if matches!(media_type, QuickLookMediaType::Audio | QuickLookMediaType::Video) {
            if let Some(playback_state) = self.app_handle.try_state::<crate::app::state::PlaybackProbeState>() {
                let _ = playback_state.pause();
            }
        }

        let already_open = is_preview_open();
        let is_pinned = self.is_pinned.load(Ordering::SeqCst);

        if let Some(window) = self.app_handle.get_webview_window("quicklook") {
            ql_log!("Abriendo ventana quicklook con tamaño: {}x{}", target_w, target_h);
            let is_max = crate::app::commands::quick_look::quick_look_is_maximized(window.clone());
            if !is_max {
                let _ = window.set_size(tauri::LogicalSize::new(target_w, target_h));
                if !is_pinned {
                    let _ = window.center();
                }
            }
            let _ = window.set_always_on_top(true);
            let _ = window.emit("quicklook://preview", &payload);

            #[cfg(windows)]
            {
                if let Ok(hwnd) = window.hwnd() {
                    use windows::Win32::Foundation::HWND;
                    use windows::Win32::UI::WindowsAndMessaging::{
                        ShowWindow, SW_SHOWNOACTIVATE, SetWindowPos, HWND_TOPMOST,
                        SWP_NOMOVE, SWP_NOSIZE, SWP_NOACTIVATE, SWP_SHOWWINDOW,
                    };
                    unsafe {
                        let win_hwnd = HWND(hwnd.0);
                        if !already_open {
                            let _ = ShowWindow(win_hwnd, SW_SHOWNOACTIVATE);
                        }
                        let _ = SetWindowPos(
                            win_hwnd,
                            HWND_TOPMOST,
                            0,
                            0,
                            0,
                            0,
                            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
                        );
                    }
                } else if !already_open {
                    let _ = window.show();
                    let _ = window.unminimize();
                }
            }
            #[cfg(not(windows))]
            if !already_open {
                let _ = window.show();
                let _ = window.unminimize();
            }

            set_preview_open(true);
            self.start_selection_watcher();
            true
        } else {
            ql_log!("ERROR: No se encontró la ventana quicklook en Tauri");
            false
        }
    }

    pub fn show_file_path(&self, path: &Path) -> bool {
        if let Some(folder_info) = resolve_folder_selection(path) {
            let primary = folder_info.primary_path.clone();
            let idx = folder_info.index;
            let total = folder_info.total;
            *self.current_selection.lock().unwrap() = Some(folder_info);
            if total > 1 {
                self.show_file_path_with_selection(&primary, Some(idx), Some(total))
            } else {
                self.show_file_path_with_selection(&primary, None, None)
            }
        } else {
            *self.current_selection.lock().unwrap() = None;
            self.show_file_path_with_selection(path, None, None)
        }
    }

    fn start_selection_watcher(&self) {
        let state = self.clone();
        let revision = self.preview_revision.load(Ordering::SeqCst);
        std::thread::spawn(move || {
            let mut empty_count: u32 = 0;
            let mut outside_count: u32 = 0;
            while is_preview_open() && state.preview_revision.load(Ordering::SeqCst) == revision {
                std::thread::sleep(std::time::Duration::from_millis(80));

                if !state.can_hide_on_unfocus() {
                    continue;
                }

                // En modo comparador o cuando la ventana está fijada/bloqueada, NO cerrar ni reaccionar a clics fuera o en Explorer
                if state.is_comparing.load(Ordering::SeqCst) || state.is_pinned.load(Ordering::SeqCst) {
                    empty_count = 0;
                    outside_count = 0;
                    continue;
                }

                // Si QuickLook tiene el foco activo, mantener la vista previa abierta
                if state.is_foreground_quicklook() {
                    empty_count = 0;
                    outside_count = 0;
                    continue;
                }

                let source = foreground_selection_source();
                if source.is_none() {
                    // Si se está realizando una captura de pantalla (Snipping Tool, ScreenClippingHost, etc.), NO cerrar
                    if super::keyboard_hook::is_screen_capture_in_progress() {
                        empty_count = 0;
                        outside_count = 0;
                        continue;
                    }

                    // El usuario hizo clic fuera (en otra aplicación o barra de tareas)
                    empty_count = 0;
                    outside_count += 1;
                    if outside_count >= 2 {
                        ql_log!("Cerrando QuickLook: foco fuera de Explorer/Desktop y QuickLook (outside_count={})", outside_count);
                        state.hide();
                        break;
                    }
                    continue;
                }

                // El foco está en Explorer o en el Escritorio
                outside_count = 0;
                let info_opt = get_foreground_selection_info();
                if info_opt.is_none() {
                    // El usuario hizo clic en un punto vacío en Explorer o Escritorio (sin selección)
                    empty_count += 1;
                    if empty_count >= 3 {
                        ql_log!("Cerrando QuickLook: clic en punto vacío en Explorer (empty_count={})", empty_count);
                        state.hide();
                        break;
                    }
                } else if let Some(info) = info_opt {
                    // El usuario seleccionó otro archivo (clic en otra imagen/archivo o flechas)
                    empty_count = 0;
                    state.handle_selection_update(revision, source, info);
                }
            }
        });
    }

    fn handle_selection_update(&self, revision: u32, source: Option<isize>, info: SelectionInfo) {
        let path = info.primary_path.clone();
        let path_str = path.to_string_lossy().to_string();
        let expected_path = self.current_path.lock().unwrap().clone();
        if expected_path.as_deref() == Some(path_str.as_str()) { return; }
        let media_type = QuickLookMediaType::from_path(&path).unwrap_or(QuickLookMediaType::Generic);
        
        let final_info = if info.total > 1 {
            info
        } else {
            let existing_opt = self.current_selection.lock().unwrap().clone();
            if let Some(mut existing) = existing_opt {
                if existing.total > 1 {
                    if let Some(pos) = existing.all_paths.iter().position(|p| p == &path) {
                        existing.index = pos + 1;
                        existing.primary_path = path.clone();
                        existing
                    } else if let Some(folder_info) = resolve_folder_selection(&path) {
                        folder_info
                    } else {
                        info
                    }
                } else if let Some(folder_info) = resolve_folder_selection(&path) {
                    folder_info
                } else {
                    info
                }
            } else if let Some(folder_info) = resolve_folder_selection(&path) {
                folder_info
            } else {
                info
            }
        };

        let (index, total) = if final_info.total > 1 { (Some(final_info.index), Some(final_info.total)) } else { (None, None) };
        // Leer metadatos puede tardar (por ejemplo, archivos MTP). Validar de nuevo al publicar.
        let payload = QuickLookPayload::with_selection(path_str.clone(), media_type, index, total);
        let known_dims = payload.width.zip(payload.height);
        let (width, height) = resolve_media_size(&self.app_handle, media_type, &path, known_dims);
        let mut current = self.current_path.lock().unwrap();
        if !selection_update_is_current(is_preview_open(), revision, self.preview_revision.load(Ordering::SeqCst), source, foreground_selection_source())
            || *current != expected_path { return; }
        *current = Some(path_str);
        *self.current_selection.lock().unwrap() = Some(final_info);
        *self.current_payload.lock().unwrap() = Some(payload.clone());
        drop(current);
        if matches!(media_type, QuickLookMediaType::Audio | QuickLookMediaType::Video) {
            if let Some(playback) = self.app_handle.try_state::<crate::app::state::PlaybackProbeState>() { let _ = playback.pause(); }
        }
        if let Some(window) = self.app_handle.get_webview_window("quicklook") {
            if !crate::app::commands::quick_look::quick_look_is_maximized(window.clone()) {
                let _ = window.set_size(tauri::LogicalSize::new(width, height));
                if !self.is_pinned.load(Ordering::SeqCst) {
                    let _ = window.center();
                }
            }
            let _ = window.emit("quicklook://preview", &payload);
        }
    }

    pub fn refresh_selection_from_foreground(&self, revision: u32) {
        if !is_preview_open() || self.preview_revision.load(Ordering::SeqCst) != revision { return; }
        let source = foreground_selection_source();
        if let Some(info) = get_foreground_selection_info() {
            self.handle_selection_update(revision, source, info);
        }
    }

    pub fn show_current_selection(&self) {
        if let Some(info) = get_active_selection_info() {
            let primary = info.primary_path.clone();
            let final_info = if info.total > 1 {
                info
            } else if let Some(folder_info) = resolve_folder_selection(&primary) {
                folder_info
            } else {
                info
            };

            let primary = final_info.primary_path.clone();
            let idx = final_info.index;
            let total = final_info.total;
            {
                let mut sel = self.current_selection.lock().unwrap();
                *sel = Some(final_info);
            }
            if total > 1 {
                self.show_file_path_with_selection(&primary, Some(idx), Some(total));
            } else {
                self.show_file_path_with_selection(&primary, None, None);
            }
        }
    }

    pub fn step_selection(&self, forward: bool) -> bool {
        let (next_path, next_idx, total) = {
            let mut guard = self.current_selection.lock().unwrap();
            if guard.as_ref().map(|s| s.total <= 1).unwrap_or(true) {
                if let Some(cur_str) = self.current_path.lock().unwrap().clone() {
                    let cur_p = Path::new(&cur_str);
                    if let Some(folder_info) = resolve_folder_selection(cur_p) {
                        *guard = Some(folder_info);
                    }
                }
            }

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
            sel.primary_path = path.clone();
            (path, new_idx, total)
        };

        self.show_file_path_with_selection(&next_path, Some(next_idx), Some(total))
    }

    pub fn handle_navigation(&self) {
        if self.is_comparing.load(Ordering::SeqCst) {
            return;
        }
        self.refresh_selection_from_foreground(self.preview_revision.load(Ordering::SeqCst));
    }

    pub fn can_hide_on_unfocus(&self) -> bool {
        if !is_preview_open() {
            return false;
        }

        let shown_guard = self.last_shown.lock().unwrap();
        if let Some(instant) = *shown_guard {
            // Permitir ventana de gracia de 250ms tras mostrar la ventana
            instant.elapsed().as_millis() >= 250
        } else {
            true
        }
    }

    #[cfg(windows)]
    pub fn is_foreground_quicklook(&self) -> bool {
        use windows::Win32::UI::WindowsAndMessaging::{GetAncestor, GetForegroundWindow, GA_ROOT};
        unsafe {
            let fg = GetForegroundWindow();
            if fg.0.is_null() { return false; }
            let root = GetAncestor(fg, GA_ROOT);
            let effective_fg = if !root.0.is_null() { root } else { fg };

            if let Some(w) = self.app_handle.get_webview_window("quicklook") {
                if let Ok(hwnd) = w.hwnd() {
                    if effective_fg.0 == hwnd.0 || fg.0 == hwnd.0 {
                        return true;
                    }
                }
            }
            let detached = self.detached_payloads.lock().unwrap();
            for label in detached.keys() {
                if let Some(w) = self.app_handle.get_webview_window(label) {
                    if let Ok(hwnd) = w.hwnd() {
                        if effective_fg.0 == hwnd.0 || fg.0 == hwnd.0 {
                            return true;
                        }
                    }
                }
            }
            false
        }
    }

    #[cfg(not(windows))]
    pub fn is_foreground_quicklook(&self) -> bool {
        false
    }

    pub fn hide(&self) {
        self.set_pinned(false);
        self.is_comparing.store(false, Ordering::SeqCst);
        self.preview_revision.fetch_add(1, Ordering::SeqCst);
        set_preview_open(false);
        *self.current_selection.lock().unwrap() = None;
        crate::app::commands::quick_look::reset_maximize_state();
        {
            let mut cur = self.current_path.lock().unwrap();
            *cur = None;
        }
        {
            let mut shown = self.last_shown.lock().unwrap();
            *shown = None;
        }
        {
            let mut pl = self.current_payload.lock().unwrap();
            *pl = None;
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

    pub fn open_in_main(&self, path: String, current_time: Option<f64>, edit_mode: Option<bool>) {
        if let Some(main_window) = self.app_handle.get_webview_window("main") {
            let _ = main_window.unminimize();
            let _ = main_window.show();
            let _ = main_window.set_focus();
            let payload = OpenMediaPayload { path, current_time, edit_mode };
            let _ = main_window.emit("prisma://open-media", payload);
        }

        self.hide();
    }

    pub fn get_current_payload(&self) -> Option<QuickLookPayload> {
        self.current_payload.lock().unwrap().clone()
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
        if !matches!(media_type, QuickLookMediaType::Image | QuickLookMediaType::Video) {
            return Err("Solo se pueden desacoplar imágenes y vídeos".into());
        }
        let payload = QuickLookPayload::new(path.to_string(), media_type);
        let known_dims = payload.width.zip(payload.height);
        let (target_w, target_h) = resolve_media_size(&self.app_handle, media_type, p, known_dims);

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

        let url = WebviewUrl::App(
            format!("index.html?quicklook=true&detached=true&label={}#quicklook", label).into(),
        );
        let mut builder = WebviewWindowBuilder::new(
            &self.app_handle,
            &label,
            url,
        )
        .title(format!("Prisma · {}", payload.file_name))
        .inner_size(target_w, target_h)
        .min_inner_size(320.0, 240.0)
        .decorations(false)
        .transparent(true)
        .resizable(true)
        .always_on_top(true)
        .skip_taskbar(true)
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

        let win_clone = window.clone();
        let payload_clone = payload.clone();
        std::thread::spawn(move || {
            for delay in [80, 250, 500] {
                std::thread::sleep(std::time::Duration::from_millis(delay));
                let _ = win_clone.emit("quicklook://preview", &payload_clone);
            }
        });

        let _ = window.show();
        let _ = window.unminimize();

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
    pub edit_mode: Option<bool>,
}

pub fn resolve_folder_selection(path: &Path) -> Option<SelectionInfo> {
    let parent = path.parent()?;
    if !parent.exists() || !parent.is_dir() {
        return None;
    }

    let entries = std::fs::read_dir(parent).ok()?;
    let mut supported_paths = Vec::new();

    for entry in entries.flatten() {
        let entry_path = entry.path();
        if !entry_path.is_file() {
            continue;
        }

        let file_name = match entry_path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name,
            None => continue,
        };

        // Ignorar archivos temporales o del sistema
        if file_name.starts_with('.') || file_name.starts_with('~') || file_name.starts_with('$') {
            continue;
        }

        let media_type = QuickLookMediaType::from_path(&entry_path);
        match media_type {
            Some(mt) if mt != QuickLookMediaType::Folder && mt != QuickLookMediaType::Generic => {
                supported_paths.push(entry_path);
            }
            _ => continue,
        }
    }

    if supported_paths.is_empty() {
        return None;
    }

    // Ordenar naturalmente (alfanumérico natural del Explorador de Windows)
    supported_paths.sort_by(|a, b| {
        let name_a = a.file_name().map(|n| n.to_string_lossy()).unwrap_or_default();
        let name_b = b.file_name().map(|n| n.to_string_lossy()).unwrap_or_default();
        crate::features::folder_session::compare_naturally(&name_a, &name_b)
    });

    let target_name_lower = path
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let target_canonical = path.canonicalize().ok();

    let pos = supported_paths.iter().position(|p| {
        p == path
            || p.file_name().map(|n| n.to_string_lossy().to_lowercase()) == Some(target_name_lower.clone())
            || (target_canonical.is_some() && p.canonicalize().ok() == target_canonical)
    });

    let (index, all_paths) = match pos {
        Some(idx) => (idx + 1, supported_paths),
        None => {
            // Si el archivo no estaba en la lista (ej. extensión no típica), lo insertamos ordenado
            let mut list = supported_paths;
            list.push(path.to_path_buf());
            list.sort_by(|a, b| {
                let name_a = a.file_name().map(|n| n.to_string_lossy()).unwrap_or_default();
                let name_b = b.file_name().map(|n| n.to_string_lossy()).unwrap_or_default();
                crate::features::folder_session::compare_naturally(&name_a, &name_b)
            });
            let new_pos = list.iter().position(|p| p == path).unwrap_or(0);
            (new_pos + 1, list)
        }
    };

    let total = all_paths.len();
    Some(SelectionInfo {
        primary_path: path.to_path_buf(),
        index,
        total,
        all_paths,
    })
}

fn get_screen_bounds(app_handle: &tauri::AppHandle) -> (f64, f64) {
    if let Some(win) = app_handle.get_webview_window("quicklook") {
        if let Ok(Some(m)) = win.current_monitor() {
            let scale = m.scale_factor();
            return (
                (m.size().width as f64 / scale).round(),
                (m.size().height as f64 / scale).round(),
            );
        }
    }
    if let Ok(Some(m)) = app_handle.primary_monitor() {
        let scale = m.scale_factor();
        return (
            (m.size().width as f64 / scale).round(),
            (m.size().height as f64 / scale).round(),
        );
    }
    (1920.0, 1080.0)
}

fn resolve_media_size(
    app_handle: &tauri::AppHandle,
    media_type: QuickLookMediaType,
    path: &Path,
    known_dims: Option<(u32, u32)>,
) -> (f64, f64) {
    let (screen_w, screen_h) = get_screen_bounds(app_handle);
    // Base ergonómica para documentos por porcentaje de pantalla: 60% ancho, 80% alto
    let doc_w = (screen_w * 0.60).round().max(680.0);
    let doc_h = (screen_h * 0.80).round().max(580.0);

    match media_type {
        QuickLookMediaType::Audio => (640.0, 390.0),
        QuickLookMediaType::Image => {
            let dims = known_dims.or_else(|| image::image_dimensions(path).ok());
            if let Some((nw, nh)) = dims {
                let max_w = (screen_w * 0.85).min(1280.0);
                let max_h = (screen_h * 0.85).min(820.0);
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
            let dims = known_dims.or_else(|| super::model::get_video_dimensions(path));
            if let Some((nw, nh)) = dims {
                let max_w = (screen_w * 0.85).min(1280.0);
                let max_h = (screen_h * 0.85).min(820.0);
                let header_h = 48.0;
                let max_content_h = max_h - header_h;

                let scale = (max_w / nw as f64).min(max_content_h / nh as f64).min(1.0);
                let fitted_w = ((nw as f64 * scale).round() as f64).max(360.0);
                let fitted_h = ((nh as f64 * scale).round() as f64).max(220.0);

                (fitted_w, fitted_h + header_h)
            } else {
                (560.0, 360.0)
            }
        }
        QuickLookMediaType::Pdf => (doc_w, doc_h),
        QuickLookMediaType::Text | QuickLookMediaType::Markdown => (doc_w, doc_h),
        QuickLookMediaType::Html => (doc_w, doc_h),
        QuickLookMediaType::Archive => ((screen_w * 0.65).round().max(740.0), (screen_h * 0.72).round().max(560.0)),
        QuickLookMediaType::Epub => (doc_w, doc_h),
        QuickLookMediaType::Lyrics => (720.0, 600.0),
        QuickLookMediaType::Folder => (640.0, 460.0),
        QuickLookMediaType::Project => (doc_w, doc_h),
        QuickLookMediaType::Playlist => (720.0, 560.0),
        QuickLookMediaType::Generic => (600.0, 420.0),
    }
}

fn selection_update_is_current(open: bool, requested: u32, current: u32, source: Option<isize>, foreground: Option<isize>) -> bool {
    open && requested == current && source.is_some() && source == foreground
}

#[cfg(test)]
mod selection_watch_tests {
    use super::selection_update_is_current;
    #[test]
    fn only_the_same_foreground_explorer_can_update_preview() {
        assert!(selection_update_is_current(true, 1, 1, Some(10), Some(10)));
        assert!(!selection_update_is_current(true, 1, 1, Some(10), None)); // Quick Look o navegador.
        assert!(!selection_update_is_current(true, 1, 1, Some(10), Some(20)));
        assert!(!selection_update_is_current(true, 1, 1, None, None));
    }
    #[test]
    fn old_reads_cannot_replace_a_reopened_or_closed_preview() {
        assert!(!selection_update_is_current(true, 1, 2, Some(10), Some(10)));
        assert!(!selection_update_is_current(false, 1, 1, Some(10), Some(10)));
    }
}
