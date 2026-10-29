//! Superficies de entrada propias sobre la vista previa; WebView2 conserva los botones.
use serde::Deserialize;
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
}

pub fn set_active(window: &tauri::WebviewWindow, active: bool) {
    #[cfg(windows)]
    native::ACTIVE.store(active, std::sync::atomic::Ordering::Release);
    let _ = window.emit_to(window.label(), "prisma:synapse-native-active", active);
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
    use windows::{
        Win32::{
            Foundation::*,
            Graphics::Gdi::{
                BLACK_BRUSH, BeginPaint, EndPaint, FillRect, GetStockObject, HBRUSH, PAINTSTRUCT,
            },
            System::{
                LibraryLoader::GetModuleHandleW,
                Ole::{IDropTarget, RevokeDragDrop},
                SystemServices::MK_LBUTTON,
            },
            UI::{
                Input::{
                    KeyboardAndMouse::{
                        ReleaseCapture, SetCapture, TME_LEAVE, TRACKMOUSEEVENT, TrackMouseEvent,
                    },
                    Pointer::*,
                },
                WindowsAndMessaging::*,
            },
        },
        core::*,
    };
    pub static ACTIVE: AtomicBool = AtomicBool::new(false);
    pub static REVISION: AtomicU64 = AtomicU64::new(0);
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
                let _ = RevokeDragDrop(hwnd);
                SOURCES.with(|sources| sources.borrow_mut().remove(&key));
                return DefWindowProcW(hwnd, message, wp, lp);
            }
            if message == WM_LBUTTONDBLCLK {
                SOURCES.with(|sources| {
                    if let Some(source) = sources.borrow().get(&key) {
                        let _ = source.window.emit_to(
                            source.window.label(),
                            "prisma:synapse-native-preview",
                            &source.id,
                        );
                    }
                });
                return LRESULT(0);
            }
            let mut start = None;
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
                    let _ = source.window.emit_to(
                        source.window.label(),
                        "prisma:synapse-native-hover",
                        Some(&source.id),
                    );
                    let mut track = TRACKMOUSEEVENT {
                        cbSize: std::mem::size_of::<TRACKMOUSEEVENT>() as u32,
                        dwFlags: TME_LEAVE,
                        hwndTrack: hwnd,
                        dwHoverTime: 0,
                    };
                    let _ = TrackMouseEvent(&mut track);
                }
                if message == WM_MOUSELEAVE || message == WM_POINTERLEAVE {
                    source.hovered = false;
                    let _ = source.window.emit_to(
                        source.window.label(),
                        "prisma:synapse-native-hover",
                        Option::<String>::None,
                    );
                }
                match message {
                    WM_LBUTTONDOWN => {
                        source.origin = Some((x, y));
                        SetCapture(hwnd);
                        #[cfg(debug_assertions)]
                        eprintln!(
                            "[Synapse nativo] Mouse compatible recibido: extra=0x{:X}",
                            GetMessageExtraInfo().0
                        );
                        true
                    }
                    WM_MOUSEMOVE => {
                        if let Some((origin_x, origin_y)) = source.origin {
                            if wp.0 & MK_LBUTTON.0 as usize == 0 {
                                source.origin = None;
                            } else if ((x - origin_x).abs()
                                >= GetSystemMetrics(SM_CXDRAG).max(2) / 2
                                || (y - origin_y).abs() >= GetSystemMetrics(SM_CYDRAG).max(2) / 2)
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
                        source.origin = None;
                        let _ = ReleaseCapture();
                        true
                    }
                    WM_CAPTURECHANGED => {
                        source.origin = None;
                        true
                    }
                    _ => false,
                }
            });
            if let Some((window, path, png)) = start {
                let _ = ReleaseCapture();
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
                        "prisma:synapse-native-error",
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
    pub fn configure(
        window: &tauri::WebviewWindow,
        prepared: Vec<Prepared>,
        revision: u64,
    ) -> std::result::Result<(), String> {
        unsafe {
            if REVISION.load(Ordering::Acquire) != revision || ACTIVE.load(Ordering::Acquire) {
                return Ok(());
            }
            // La medición al terminar la animación no debe destruir la ventana
            // que ya es propietaria del contacto que el usuario está moviendo.
            if SOURCES.with(|sources| {
                sources
                    .borrow()
                    .values()
                    .any(|source| source.origin.is_some())
            }) {
                let target = window.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                    let dispatch = target.clone();
                    let _ = dispatch.run_on_main_thread(move || {
                        if let Err(error) = configure(&target, prepared, revision) {
                            let _ = target.emit_to(
                                target.label(),
                                "prisma:synapse-native-error",
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
            let old = SOURCES.with(|sources| sources.borrow().keys().copied().collect::<Vec<_>>());
            for id in old {
                let _ = DestroyWindow(HWND(id as *mut _));
            }
            let parent = HWND(window.hwnd().map_err(|e| e.to_string())?.0);
            let dpi = window.scale_factor().map_err(|e| e.to_string())?;
            let mut client = RECT::default();
            GetClientRect(parent, &mut client)
                .map_err(|e| format!("Medir ventana de entrada: {e}"))?;
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
                count += 1;
            }
            #[cfg(debug_assertions)]
            if count > 0 {
                eprintln!("[Synapse nativo] Superficies de salida listas: {count}");
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
    if surfaces.len() > 5
        || surfaces.iter().any(|s| {
            ![s.x, s.y, s.width, s.height].iter().all(|v| v.is_finite())
                || s.x < 0.0
                || s.y < 0.0
                || s.width > 300.0
                || s.height > 300.0
                || s.icon.len() > 1_000_000
        })
    {
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
