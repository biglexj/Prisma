//! Superficies de entrada propias sobre la vista previa; WebView2 conserva los botones.
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

fn preview_png(icon: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    let encoded = icon
        .strip_prefix("data:image/png;base64,")
        .ok_or("La miniatura debe ser PNG")?;
    if encoded.len() > 1_000_000 {
        return Err("Miniatura demasiado grande".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|e| e.to_string())?;
    let (width, height) =
        image::ImageReader::with_format(std::io::Cursor::new(&bytes), image::ImageFormat::Png)
            .into_dimensions()
            .map_err(|e| e.to_string())?;
    if width == 0 || height == 0 || width > 512 || height > 512 {
        return Err("Dimensiones de miniatura no válidas".into());
    }
    image::load_from_memory_with_format(&bytes, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(bytes)
}

#[derive(Clone, Deserialize)]
pub struct Surface {
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    icon: String,
    #[serde(default)]
    holes: Vec<SurfaceHole>,
}

#[derive(Clone, Deserialize)]
struct SurfaceHole {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Deserialize)]
pub struct FileSurface {
    #[serde(flatten)]
    surface: Surface,
    path: String,
}

fn trusted_main(label: &str, url: &tauri::Url) -> bool {
    let local = match url.scheme() {
        "tauri" => url.host_str() == Some("localhost"),
        "http" | "https" => {
            url.host_str() == Some("tauri.localhost")
                || matches!(url.host_str(), Some("localhost" | "127.0.0.1"))
                    && url.port() == Some(1421)
        }
        _ => false,
    };
    label == "main" && local && matches!(url.path(), "/" | "/index.html")
}

fn valid_surfaces(surfaces: &[Surface], limit: usize, max_dimension: f64) -> bool {
    surfaces.len() <= limit
        && surfaces.iter().map(|s| s.icon.len()).sum::<usize>() <= 12_000_000
        && surfaces.iter().all(|s| {
            [s.x, s.y, s.width, s.height].iter().all(|v| v.is_finite())
                && s.x >= 0.0
                && s.y >= 0.0
                && s.width > 0.0
                && s.height > 0.0
                && s.width <= max_dimension
                && s.height <= max_dimension
                && s.icon.len() <= 1_000_000
                && s.holes.len() <= 32
                && s.holes.iter().all(|h| {
                    [h.x, h.y, h.width, h.height].iter().all(|v| v.is_finite())
                        && h.width >= 0.0
                        && h.height >= 0.0
                })
        })
}

#[derive(Serialize, Clone)]
struct SourceInput {
    id: String,
    kind: &'static str,
    x: i32,
    y: i32,
    ctrl: bool,
    shift: bool,
    alt: bool,
    delta: i32,
}

#[cfg(windows)]
unsafe fn emit_input(
    window: &tauri::WebviewWindow,
    hwnd: windows::Win32::Foundation::HWND,
    id: &str,
    kind: &'static str,
    lp: windows::Win32::Foundation::LPARAM,
    delta: i32,
) {
    unsafe {
        use windows::Win32::{
            Foundation::POINT,
            Graphics::Gdi::{ClientToScreen, ScreenToClient},
            UI::Input::KeyboardAndMouse::{GetKeyState, VK_CONTROL, VK_MENU, VK_SHIFT},
        };
        let mut point = POINT {
            x: lp.0 as i16 as i32,
            y: (lp.0 >> 16) as i16 as i32,
        };
        if kind != "contextmenu" && kind != "wheel" && kind != "hwheel" {
            let _ = ClientToScreen(hwnd, &mut point);
        }
        if let Ok(root) = window.hwnd() {
            let _ = ScreenToClient(windows::Win32::Foundation::HWND(root.0), &mut point);
        }
        let scale = window.scale_factor().unwrap_or(1.0);
        let payload = SourceInput {
            id: id.into(),
            kind,
            x: (point.x as f64 / scale).round() as i32,
            y: (point.y as f64 / scale).round() as i32,
            ctrl: GetKeyState(VK_CONTROL.0 as i32) < 0,
            shift: GetKeyState(VK_SHIFT.0 as i32) < 0,
            alt: GetKeyState(VK_MENU.0 as i32) < 0,
            delta,
        };
        let _ = window.emit_to(window.label(), "prisma:native-file-source-input", payload);
    }
}

pub fn set_active(window: &tauri::WebviewWindow, active: bool) {
    #[cfg(windows)]
    native::ACTIVE.store(active, std::sync::atomic::Ordering::Release);
    let event = if window.label() == "main" {
        "prisma:native-file-source-active"
    } else {
        "prisma:synapse-native-active"
    };
    let _ = window.emit_to(window.label(), event, active);
}

#[cfg(windows)]
mod native {
    use super::*;
    use std::{
        cell::RefCell,
        collections::HashMap,
        sync::{
            OnceLock,
            atomic::{AtomicBool, AtomicU64, Ordering},
        },
    };
    #[cfg(debug_assertions)]
    use windows::Win32::UI::Input::Pointer::*;
    use windows::{
        Win32::{
            Foundation::*,
            Graphics::Gdi::{
                BLACK_BRUSH, BeginPaint, CombineRgn, CreateRectRgn, DeleteObject, EndPaint,
                FillRect, GetStockObject, HBRUSH, PAINTSTRUCT, RGN_DIFF, SetWindowRgn,
            },
            System::{
                LibraryLoader::GetModuleHandleW,
                Ole::{IDropTarget, RevokeDragDrop},
                SystemServices::MK_LBUTTON,
            },
            UI::{
                Input::KeyboardAndMouse::{
                    ReleaseCapture, SetCapture, TME_LEAVE, TRACKMOUSEEVENT, TrackMouseEvent,
                },
                WindowsAndMessaging::*,
            },
        },
        core::*,
    };
    pub static ACTIVE: AtomicBool = AtomicBool::new(false);
    pub static REVISION: AtomicU64 = AtomicU64::new(0);
    pub static MAIN_REVISION: AtomicU64 = AtomicU64::new(0);
    const WM_MOUSELEAVE: u32 = 0x02a3;
    thread_local! { static SOURCES: RefCell<HashMap<isize, Source>> = RefCell::new(HashMap::new()); }
    struct Source {
        window: tauri::WebviewWindow,
        id: String,
        path: std::path::PathBuf,
        png: Vec<u8>,
        origin: Option<(i32, i32)>,
        hovered: bool,
        _drop_target: IDropTarget,
    }
    pub struct Prepared {
        pub surface: Surface,
        pub path: std::path::PathBuf,
        pub png: Vec<u8>,
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn ole_preview_keeps_png_alpha_and_rejects_invalid_images() {
            use base64::Engine;
            let image = image::RgbaImage::from_raw(1, 1, vec![200, 100, 50, 128]).unwrap();
            let mut bytes = std::io::Cursor::new(Vec::new());
            image.write_to(&mut bytes, image::ImageFormat::Png).unwrap();
            let original = bytes.into_inner();
            let icon = format!(
                "data:image/png;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(&original)
            );
            let png = preview_png(&icon).unwrap();
            assert_eq!(png, original);
            assert_eq!(
                image::load_from_memory(&png)
                    .unwrap()
                    .to_rgba8()
                    .get_pixel(0, 0)
                    .0,
                [200, 100, 50, 128]
            );
            assert!(preview_png("data:image/png;base64,AAAA").is_err());
            assert!(preview_png("data:image/jpeg;base64,AAAA").is_err());
        }
        #[test]
        fn native_source_creates_a_layered_child_with_the_app_manifest() {
            unsafe {
                let instance = HINSTANCE(GetModuleHandleW(None).unwrap().0);
                let parent = CreateWindowExW(
                    WINDOW_EX_STYLE::default(),
                    w!("STATIC"),
                    w!("Synapse source test"),
                    WS_OVERLAPPEDWINDOW,
                    0,
                    0,
                    100,
                    100,
                    None,
                    None,
                    instance,
                    None,
                )
                .unwrap();
                let class = w!("PrismaSynapseDragSourceTest");
                assert_ne!(
                    RegisterClassW(&WNDCLASSW {
                        lpfnWndProc: Some(procedure),
                        hInstance: instance,
                        lpszClassName: class,
                        ..Default::default()
                    }),
                    0
                );
                let result = CreateWindowExW(
                    WS_EX_LAYERED,
                    class,
                    w!(""),
                    WS_CHILD,
                    0,
                    0,
                    40,
                    40,
                    parent,
                    None,
                    instance,
                    None,
                );
                if let Ok(child) = result.as_ref() {
                    assert!(SetLayeredWindowAttributes(*child, COLORREF(0), 1, LWA_ALPHA).is_ok());
                    DestroyWindow(*child).unwrap();
                }
                DestroyWindow(parent).unwrap();
                UnregisterClassW(class, instance).unwrap();
                assert!(
                    result.is_ok(),
                    "El manifiesto debe permitir la superficie de lápiz: {result:?}"
                );
            }
        }
    }
    unsafe extern "system" fn procedure(
        hwnd: HWND,
        message: u32,
        wp: WPARAM,
        lp: LPARAM,
    ) -> LRESULT {
        unsafe {
            // Misma ruta que el laboratorio aceptado: observar el lápiz y dejar
            // a Windows generar mouse compatible. Nunca iniciar OLE aquí.
            if matches!(
                message,
                WM_POINTERDOWN | WM_POINTERUPDATE | WM_POINTERUP | WM_POINTERCAPTURECHANGED
            ) {
                #[cfg(debug_assertions)]
                if message == WM_POINTERDOWN {
                    let id = (wp.0 & 0xffff) as u32;
                    let mut info = POINTER_INFO::default();
                    if GetPointerInfo(id, &mut info).is_ok() {
                        eprintln!(
                            "[Synapse nativo] Puntero observado, sin consumir: id={id}, tipo={:?}",
                            info.pointerType
                        );
                    }
                }
                return DefWindowProcW(hwnd, message, wp, lp);
            }
            let key = hwnd.0 as isize;
            if message == WM_NCCREATE {
                return LRESULT(1);
            }
            if message == WM_CREATE {
                return LRESULT(0);
            }
            if message == WM_PAINT {
                let mut ps = PAINTSTRUCT::default();
                let dc = BeginPaint(hwnd, &mut ps);
                FillRect(dc, &ps.rcPaint, HBRUSH(GetStockObject(BLACK_BRUSH).0));
                let _ = EndPaint(hwnd, &ps);
                return LRESULT(0);
            }
            if message == WM_ERASEBKGND {
                return LRESULT(1);
            }
            if message == WM_NCDESTROY {
                // Soltar el préstamo antes de liberar objetos COM: Windows puede
                // volver a entrar en este procedimiento durante la limpieza.
                let removed = SOURCES.with(|sources| sources.borrow_mut().remove(&key));
                let _ = RevokeDragDrop(hwnd);
                drop(removed);
                return DefWindowProcW(hwnd, message, wp, lp);
            }
            if message == WM_LBUTTONDBLCLK {
                let target = SOURCES.with(|sources| {
                    sources
                        .borrow()
                        .get(&key)
                        .map(|source| (source.window.clone(), source.id.clone()))
                });
                if let Some((window, id)) = target {
                    if window.label() == "main" {
                        emit_input(&window, hwnd, &id, "dblclick", lp, 0);
                    } else {
                        let _ =
                            window.emit_to(window.label(), "prisma:synapse-native-preview", &id);
                    }
                }
                return LRESULT(0);
            }
            let mut start = None;
            let mut capture = None;
            let mut hover = None;
            let mut input = None;
            let drag_x = GetSystemMetrics(SM_CXDRAG).max(2) / 2;
            let drag_y = GetSystemMetrics(SM_CYDRAG).max(2) / 2;
            // Este bloque solo consulta/modifica estado. SetCapture y
            // ReleaseCapture envían WM_CAPTURECHANGED de forma síncrona;
            // emitir eventos también puede despachar mensajes de Windows.
            let handled = SOURCES.with(|sources| {
                let mut sources = sources.borrow_mut();
                let Some(source) = sources.get_mut(&key) else {
                    return false;
                };
                // Coordenadas del mensaje, no una consulta posterior del cursor.
                let x = lp.0 as i16 as i32;
                let y = (lp.0 >> 16) as i16 as i32;
                if message == WM_MOUSEMOVE && !source.hovered {
                    source.hovered = true;
                    hover = Some((source.window.clone(), Some(source.id.clone())));
                }
                if message == WM_MOUSELEAVE || message == WM_POINTERLEAVE {
                    source.hovered = false;
                    hover = Some((source.window.clone(), None));
                }
                match message {
                    WM_LBUTTONDOWN => {
                        source.origin = Some((x, y));
                        capture = Some(true);
                        true
                    }
                    WM_MOUSEMOVE => {
                        if let Some((origin_x, origin_y)) = source.origin {
                            if wp.0 & MK_LBUTTON.0 as usize == 0 {
                                source.origin = None;
                            } else if ((x - origin_x).abs() >= drag_x
                                || (y - origin_y).abs() >= drag_y)
                                && !ACTIVE.load(Ordering::Acquire)
                            {
                                source.origin = None;
                                start = Some((
                                    source.window.clone(),
                                    source.path.clone(),
                                    source.png.clone(),
                                ));
                            }
                        }
                        true
                    }
                    WM_LBUTTONUP => {
                        if source.origin.is_some()
                            && source.window.label() == "main"
                            && !ACTIVE.load(Ordering::Acquire)
                        {
                            input = Some((source.window.clone(), source.id.clone(), "click", 0));
                        }
                        source.origin = None;
                        capture = Some(false);
                        true
                    }
                    WM_CAPTURECHANGED => {
                        source.origin = None;
                        true
                    }
                    WM_CONTEXTMENU if source.window.label() == "main" => {
                        input = Some((source.window.clone(), source.id.clone(), "contextmenu", 0));
                        true
                    }
                    WM_MOUSEWHEEL | WM_MOUSEHWHEEL if source.window.label() == "main" => {
                        input = Some((
                            source.window.clone(),
                            source.id.clone(),
                            if message == WM_MOUSEWHEEL {
                                "wheel"
                            } else {
                                "hwheel"
                            },
                            (wp.0 >> 16) as i16 as i32,
                        ));
                        true
                    }
                    _ => false,
                }
            });
            if let Some(take) = capture {
                if take {
                    SetCapture(hwnd);
                    #[cfg(debug_assertions)]
                    eprintln!(
                        "[Synapse nativo] Mouse compatible recibido: extra=0x{:X}",
                        GetMessageExtraInfo().0
                    );
                } else {
                    let _ = ReleaseCapture();
                }
            }
            if let Some((window, id)) = hover {
                let event = if window.label() == "main" {
                    "prisma:native-file-source-hover"
                } else {
                    "prisma:synapse-native-hover"
                };
                if id.is_some() {
                    let mut track = TRACKMOUSEEVENT {
                        cbSize: std::mem::size_of::<TRACKMOUSEEVENT>() as u32,
                        dwFlags: TME_LEAVE,
                        hwndTrack: hwnd,
                        dwHoverTime: 0,
                    };
                    let _ = TrackMouseEvent(&mut track);
                }
                let _ = window.emit_to(window.label(), event, id);
            }
            if let Some((window, id, kind, delta)) = input {
                emit_input(&window, hwnd, &id, kind, lp, delta);
            }
            if let Some((window, path, png)) = start {
                let _ = ReleaseCapture();
                if window.label() == "main" {
                    let _ = window.emit_to(
                        window.label(),
                        "prisma:native-file-source-paths",
                        vec![path.to_string_lossy().into_owned()],
                    );
                }
                super::set_active(&window, true);
                #[cfg(debug_assertions)]
                eprintln!("[Synapse nativo] Arrastre OLE desde WM_MOUSEMOVE compatible");
                let target = window.clone();
                let result = drag::start_drag(
                    &window,
                    drag::DragItem::Files(vec![path]),
                    drag::Image::Raw(png),
                    move |_, _| super::set_active(&target, false),
                    drag::Options::default(),
                );
                super::set_active(&window, false);
                if let Err(error) = result {
                    let _ = window.emit_to(
                        window.label(),
                        if window.label() == "main" {
                            "prisma:native-file-source-error"
                        } else {
                            "prisma:synapse-native-error"
                        },
                        error.to_string(),
                    );
                }
            }
            if handled {
                LRESULT(0)
            } else {
                DefWindowProcW(hwnd, message, wp, lp)
            }
        }
    }
    pub fn ready_ids(window: &tauri::WebviewWindow) -> Vec<String> {
        SOURCES.with(|sources| {
            sources
                .borrow()
                .values()
                .filter(|source| source.window.label() == window.label())
                .map(|source| source.id.clone())
                .collect()
        })
    }
    pub fn configure(
        window: &tauri::WebviewWindow,
        prepared: Vec<Prepared>,
        revision: u64,
    ) -> std::result::Result<(), String> {
        unsafe {
            let latest = if window.label() == "main" {
                &MAIN_REVISION
            } else {
                &REVISION
            };
            if latest.load(Ordering::Acquire) != revision || ACTIVE.load(Ordering::Acquire) {
                return Ok(());
            }
            // La medición al terminar la animación no debe destruir la ventana
            // que ya es propietaria del contacto que el usuario está moviendo.
            if SOURCES.with(|sources| {
                sources.borrow().values().any(|source| {
                    source.window.label() == window.label() && source.origin.is_some()
                })
            }) {
                let target = window.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                    let dispatch = target.clone();
                    let _ = dispatch.run_on_main_thread(move || {
                        if let Err(error) = configure(&target, prepared, revision) {
                            let _ = target.emit_to(
                                target.label(),
                                if target.label() == "main" {
                                    "prisma:native-file-source-error"
                                } else {
                                    "prisma:synapse-native-error"
                                },
                                error,
                            );
                        }
                    });
                });
                return Ok(());
            }
            static CLASS: OnceLock<u16> = OnceLock::new();
            let instance = GetModuleHandleW(None).map_err(|e| format!("Módulo de entrada: {e}"))?;
            let class = *CLASS.get_or_init(|| {
                RegisterClassW(&WNDCLASSW {
                    style: CS_DBLCLKS,
                    lpfnWndProc: Some(procedure),
                    hInstance: HINSTANCE(instance.0),
                    lpszClassName: w!("PrismaSynapseDragSource"),
                    ..Default::default()
                })
            });
            if class == 0 {
                return Err("No se pudo crear la superficie nativa de Synapse".into());
            }
            let old = SOURCES.with(|sources| {
                sources
                    .borrow()
                    .iter()
                    .filter(|(_, source)| source.window.label() == window.label())
                    .map(|(id, _)| *id)
                    .collect::<Vec<_>>()
            });
            for id in old {
                let _ = DestroyWindow(HWND(id as *mut _));
            }
            let parent = HWND(window.hwnd().map_err(|e| e.to_string())?.0);
            let dpi = window.scale_factor().map_err(|e| e.to_string())?;
            let mut client = RECT::default();
            GetClientRect(parent, &mut client)
                .map_err(|e| format!("Medir ventana de entrada: {e}"))?;
            #[cfg(debug_assertions)]
            let mut count = 0;
            for item in prepared {
                let s = &item.surface;
                let x = (s.x * dpi).round() as i32;
                let y = (s.y * dpi).round() as i32;
                let width = (s.width * dpi).round() as i32;
                let height = (s.height * dpi).round() as i32;
                if x < 0
                    || y < 0
                    || width <= 0
                    || height <= 0
                    || x + width > client.right
                    || y + height > client.bottom
                {
                    continue;
                }
                let hwnd = CreateWindowExW(
                    WS_EX_LAYERED,
                    w!("PrismaSynapseDragSource"),
                    w!("Arrastrar archivo de Synapse"),
                    WS_CHILD | WS_VISIBLE,
                    x,
                    y,
                    width,
                    height,
                    parent,
                    None,
                    HINSTANCE(instance.0),
                    None,
                )
                .map_err(|e| format!("Crear superficie de entrada: {e}"))?;
                if !s.holes.is_empty() {
                    let region = CreateRectRgn(0, 0, width, height);
                    if region.0.is_null() {
                        let _ = DestroyWindow(hwnd);
                        return Err("No se pudo delimitar el arrastre".into());
                    }
                    for h in &s.holes {
                        let hole = CreateRectRgn(
                            (h.x * dpi).floor() as i32,
                            (h.y * dpi).floor() as i32,
                            ((h.x + h.width) * dpi).ceil() as i32,
                            ((h.y + h.height) * dpi).ceil() as i32,
                        );
                        CombineRgn(region, region, hole, RGN_DIFF);
                        let _ = DeleteObject(hole);
                    }
                    if SetWindowRgn(hwnd, region, true) == 0 {
                        let _ = DeleteObject(region);
                        let _ = DestroyWindow(hwnd);
                        return Err("No se pudieron conservar los controles de la tarjeta".into());
                    }
                }
                let setup = (|| {
                    SetLayeredWindowAttributes(hwnd, COLORREF(0), 1, LWA_ALPHA)
                        .map_err(|e| format!("Transparencia de entrada: {e}"))?;
                    crate::infrastructure::windows_file_drop::register_surface(window, hwnd)
                })();
                let drop_target = match setup {
                    Ok(target) => target,
                    Err(error) => {
                        let _ = DestroyWindow(hwnd);
                        return Err(error);
                    }
                };
                SOURCES.with(|sources| {
                    sources.borrow_mut().insert(
                        hwnd.0 as isize,
                        Source {
                            window: window.clone(),
                            id: s.id.clone(),
                            path: item.path,
                            png: item.png,
                            origin: None,
                            hovered: false,
                            _drop_target: drop_target,
                        },
                    )
                });
                let _ = SetWindowPos(
                    hwnd,
                    HWND_TOP,
                    x,
                    y,
                    width,
                    height,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
                #[cfg(debug_assertions)]
                {
                    count += 1;
                }
            }
            #[cfg(debug_assertions)]
            if count > 0 {
                eprintln!(
                    "[Arrastre nativo {}] Superficies de salida listas: {count}",
                    window.label()
                );
            }
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn synapse_set_drag_surfaces(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    surfaces: Vec<Surface>,
) -> Result<(), String> {
    super::synapse_browser_drag::local_zone(&window)?;
    if !valid_surfaces(&surfaces, 5, 300.0) {
        return Err("Superficie de arrastre no válida".into());
    }
    #[cfg(windows)]
    {
        let revision = native::REVISION.fetch_add(1, std::sync::atomic::Ordering::AcqRel) + 1;
        let items = app.state::<super::vault::VaultState>().list();
        let prepared = tauri::async_runtime::spawn_blocking(
            move || -> std::result::Result<Vec<native::Prepared>, String> {
                let mut output = Vec::new();
                for surface in surfaces {
                    let item = items
                        .iter()
                        .find(|item| item.id == surface.id)
                        .ok_or("La tarjeta ya no está en Synapse")?;
                    let path = std::path::Path::new(
                        item.path
                            .as_deref()
                            .ok_or("La tarjeta no contiene archivo")?,
                    )
                    .canonicalize()
                    .map_err(|e| e.to_string())?;
                    let export = super::synapse_browser_drag::shell_drag_path(&path)?;
                    let png = preview_png(&surface.icon)?;
                    output.push(native::Prepared {
                        surface,
                        path: export.into(),
                        png,
                    });
                }
                Ok(output)
            },
        )
        .await
        .map_err(|e| e.to_string())??;
        let (tx, rx) = tokio::sync::oneshot::channel();
        let target = window.clone();
        window
            .run_on_main_thread(move || {
                let result = super::synapse_browser_drag::local_zone(&target)
                    .and_then(|_| native::configure(&target, prepared, revision));
                let _ = tx.send(result);
            })
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    {
        let _ = (app, surfaces);
        Ok(())
    }
}

/// Fuentes de archivos visibles en Inicio, bibliotecas y reproductores.
#[tauri::command]
pub async fn native_file_drop_info(
    window: tauri::WebviewWindow,
    path: String,
) -> Result<bool, String> {
    if !trusted_main(window.label(), &window.url().map_err(|e| e.to_string())?) {
        return Err("Consulta reservada a Prisma local".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::metadata(path)
            .map(|metadata| metadata.is_dir())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn native_file_set_surfaces(
    window: tauri::WebviewWindow,
    surfaces: Vec<FileSurface>,
) -> Result<Vec<String>, String> {
    if !trusted_main(window.label(), &window.url().map_err(|e| e.to_string())?) {
        return Err("Fuente reservada a Prisma local".into());
    }
    let geometry = surfaces
        .iter()
        .map(|s| s.surface.clone())
        .collect::<Vec<_>>();
    if !valid_surfaces(&geometry, 96, 8192.0)
        || surfaces
            .iter()
            .any(|s| s.path.len() > 32768 || s.path.is_empty())
    {
        return Err("Fuentes de arrastre no válidas".into());
    }
    drop(geometry);
    #[cfg(windows)]
    {
        let revision = native::MAIN_REVISION.fetch_add(1, std::sync::atomic::Ordering::AcqRel) + 1;
        let prepared = tauri::async_runtime::spawn_blocking(
            move || -> Result<Vec<native::Prepared>, String> {
                let mut prepared = Vec::new();
                for input in surfaces {
                    let Ok(path) = std::path::Path::new(&input.path).canonicalize() else {
                        continue;
                    };
                    if !path.is_file() {
                        continue;
                    }
                    let path = super::synapse_browser_drag::shell_drag_path(&path)?.into();
                    let png = preview_png(&input.surface.icon)?;
                    prepared.push(native::Prepared {
                        surface: input.surface,
                        path,
                        png,
                    });
                }
                Ok(prepared)
            },
        )
        .await
        .map_err(|e| e.to_string())??;
        let (tx, rx) = tokio::sync::oneshot::channel();
        let target = window.clone();
        window
            .run_on_main_thread(move || {
                let result = target.url().map_err(|e| e.to_string()).and_then(|url| {
                    if !trusted_main(target.label(), &url) {
                        return Err("Documento de arrastre sustituido".into());
                    }
                    native::configure(&target, prepared, revision)
                        .map(|_| native::ready_ids(&target))
                });
                let _ = tx.send(result);
            })
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    {
        let _ = (window, surfaces);
        Ok(Vec::new())
    }
}

#[cfg(test)]
mod source_tests {
    use super::*;
    #[test]
    fn main_sources_reject_remote_documents_and_wrong_windows() {
        assert!(trusted_main(
            "main",
            &tauri::Url::parse("http://localhost:1421/").unwrap()
        ));
        assert!(trusted_main(
            "main",
            &tauri::Url::parse("tauri://localhost/index.html").unwrap()
        ));
        for value in [
            "https://example.com/",
            "http://localhost:3000/",
            "http://localhost:1421/zone.html",
        ] {
            assert!(!trusted_main("main", &tauri::Url::parse(value).unwrap()));
        }
        assert!(!trusted_main(
            "system_drop_zone",
            &tauri::Url::parse("http://localhost:1421/").unwrap()
        ));
    }
    #[test]
    fn source_limits_reject_bad_geometry_and_large_batches() {
        let input = Surface {
            id: "card".into(),
            x: 1.0,
            y: 1.0,
            width: 100.0,
            height: 100.0,
            icon: String::new(),
            holes: vec![],
        };
        assert!(valid_surfaces(&[input.clone()], 96, 8192.0));
        assert!(!valid_surfaces(&vec![input.clone(); 97], 96, 8192.0));
        let mut invalid = input;
        invalid.width = f64::NAN;
        assert!(!valid_surfaces(&[invalid], 96, 8192.0));
    }
}
