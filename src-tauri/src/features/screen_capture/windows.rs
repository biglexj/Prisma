#[cfg(windows)]
use windows::Win32::Foundation::{BOOL, HWND, LPARAM, POINT, RECT};
#[cfg(windows)]
use windows::Win32::Graphics::Dwm::{
    DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    ChildWindowFromPointEx, EnumWindows, GetClassNameW, GetWindowLongW,
    GetWindowRect, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    IsIconic, IsWindowVisible, CWP_SKIPINVISIBLE, CWP_SKIPTRANSPARENT, GWL_EXSTYLE,
    WS_EX_TRANSPARENT,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedTarget {
    pub id: String,
    pub title: String,
    pub class_name: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub is_child: bool,
    /// Identificador nativo de la ventana (HWND) para consultas de subregión.
    pub hwnd: u64,
}

/// Clases de ventanas del sistema operativo que nunca deben ofrecerse como objetivo
/// de captura: barra de tareas, escritorio, capa de "Experiencia de entrada de
/// Windows", menús flotantes del sistema y tooltips.
///
/// La barra de tareas (`Shell_TrayWnd`) vive por encima de las ventanas normales en
/// el orden Z, por lo que aparecía como primer objetivo y quedaba preseleccionada
/// al abrir la captura en modo Ventana.
const SYSTEM_WINDOW_CLASSES: &[&str] = &[
    "Shell_TrayWnd",
    "Shell_SecondaryTrayWnd",
    "Progman",
    "WorkerW",
    "NotifyIconOverflowWindow",
    "TopLevelWindowForOverflowXamlIsland",
    "ForegroundStaging",
    "TaskListThumbnailWnd",
    "MultitaskingViewFrame",
    "tooltips_class32",
    "IMEWND",
    "MSCTFIME UI",
    "Default IME",
];

/// Indica si la clase de ventana pertenece al sistema operativo y debe excluirse.
fn is_system_window(class_name: &str) -> bool {
    SYSTEM_WINDOW_CLASSES
        .iter()
        .any(|known| known.eq_ignore_ascii_case(class_name))
}

#[cfg(windows)]
pub fn enumerate_visible_windows() -> Vec<DetectedTarget> {
    enumerate_windows(true, &[], false)
}

/// Enumera las ventanas visibles.
///
/// `exclude_own_process` descarta las ventanas de Prisma (el overlay nunca debe
/// listarse). `excluded_hwnds` permite excluir ventanas concretas por HWND, que es
/// lo que se usa en el hit-test para descartar únicamente el overlay y el editor,
/// manteniendo capturables el resto de ventanas de la propia aplicación.
#[cfg(windows)]
fn enumerate_windows(exclude_own_process: bool, excluded_hwnds: &[u64], include_system: bool) -> Vec<DetectedTarget> {
    // EnumWindows es síncrono: cada llamada conserva sus datos en la pila. No se
    // comparten listas entre consultas concurrentes del lápiz y el inicio de sesión.
    struct Enumeration<'a> {
        targets: Vec<DetectedTarget>,
        excluded: &'a [u64],
        exclude_own: bool,
        include_system: bool,
    }
    let mut enumeration = Enumeration {
        targets: Vec::new(),
        excluded: excluded_hwnds,
        exclude_own: exclude_own_process,
        include_system,
    };

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            let context = &mut *(lparam.0 as *mut Enumeration<'_>);
            if !IsWindowVisible(hwnd).as_bool() || IsIconic(hwnd).as_bool() {
                return BOOL(1);
            }

            let hwnd_value = hwnd.0 as usize as u64;
            if context.excluded.contains(&hwnd_value) {
                return BOOL(1);
            }

            let mut pid: u32 = 0;
            let _ = GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if context.exclude_own && pid == std::process::id() {
                // Ignorar ventanas pertenecientes al proceso de Prisma (overlay, main, flyout, editor)
                return BOOL(1);
            }

            // Verificar si la ventana está oculta por DWM (UWP suspendidas, escritorios virtuales)
            let mut cloaked: u32 = 0;
            let dwm_cloaked_res = DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED,
                &mut cloaked as *mut _ as _,
                std::mem::size_of::<u32>() as u32,
            );
            if dwm_cloaked_res.is_ok() && cloaked != 0 {
                return BOOL(1);
            }

            let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
            if (ex_style & WS_EX_TRANSPARENT.0) != 0 {
                return BOOL(1);
            }

            let mut class_buf = [0u16; 256];
            let class_copied = GetClassNameW(hwnd, &mut class_buf);
            let class_name = String::from_utf16_lossy(&class_buf[..class_copied as usize]);

            // Descartar ventanas del sistema (barra de tareas, escritorio, menús del SO).
            if !context.include_system && is_system_window(&class_name) {
                return BOOL(1);
            }

            // Obtener límites geométricos exactos mediante DWM (excluye sombras invisibles de Windows 10/11)
            let mut rect = RECT::default();
            let dwm_rect_res = DwmGetWindowAttribute(
                hwnd,
                DWMWA_EXTENDED_FRAME_BOUNDS,
                &mut rect as *mut _ as _,
                std::mem::size_of::<RECT>() as u32,
            );
            if dwm_rect_res.is_err() {
                let _ = GetWindowRect(hwnd, &mut rect);
            }

            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;

            // Descartar ventanas invisibles o de 0 dimensiones
            if width <= 8 || height <= 8 {
                return BOOL(1);
            }

            let title_len = GetWindowTextLengthW(hwnd);
            let mut title_buf = vec![0u16; (title_len + 1) as usize];
            let copied = GetWindowTextW(hwnd, &mut title_buf);
            let title = String::from_utf16_lossy(&title_buf[..copied as usize]);

                context.targets.push(DetectedTarget {
                    id: format!("{:?}", hwnd.0),
                    title,
                    class_name,
                    x: rect.left,
                    y: rect.top,
                    width,
                    height,
                    is_child: false,
                    hwnd: hwnd.0 as usize as u64,
                });

            BOOL(1)
        }
    }

    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(&mut enumeration as *mut Enumeration<'_> as isize));
    }

    enumeration.targets
}

#[cfg(not(windows))]
pub fn enumerate_visible_windows() -> Vec<DetectedTarget> {
    Vec::new()
}

/// Devuelve la ventana de aplicación situada bajo el punto indicado usando el
/// hit-test del sistema operativo, en lugar de confiar en una lista que puede
/// haber quedado obsoleta (por ejemplo, si se perdió el evento de sesión).
///
/// `excluded_hwnds` permite apartar ventanas concretas (overlay y editor de captura)
/// sin descartar el resto de ventanas de la propia aplicación.
#[cfg(windows)]
pub fn detect_window_at(screen_x: i32, screen_y: i32, excluded_hwnds: &[u64]) -> Option<DetectedTarget> {
    target_at(enumerate_windows(false, excluded_hwnds, true), screen_x, screen_y)
}

fn target_at(targets: Vec<DetectedTarget>, screen_x: i32, screen_y: i32) -> Option<DetectedTarget> {
    // El primer rectángulo visible manda en orden Z. La barra de tareas bloquea
    // las ventanas que hay detrás, aunque ella misma no sea un objetivo capturable.
    targets
        .into_iter()
        .find(|t| {
            screen_x >= t.x
                && screen_x < t.x + t.width
                && screen_y >= t.y
                && screen_y < t.y + t.height
        })
        .filter(|t| !is_system_window(&t.class_name))
}

#[cfg(not(windows))]
pub fn detect_window_at(_screen_x: i32, _screen_y: i32, _excluded_hwnds: &[u64]) -> Option<DetectedTarget> {
    None
}

/// Detecta subelementos o controles anidados bajo el punto del cursor (x, y) en coordenadas virtuales.
///
/// `parent_hwnd` es el HWND real de la ventana padre: se usa su área de cliente para
/// localizar el control hijo, en lugar de estimarlo a partir del origen de la ventana.
#[cfg(windows)]
pub fn detect_subregions_at(
    parent_hwnd: u64,
    screen_x: i32,
    screen_y: i32,
) -> Option<DetectedTarget> {
    unsafe {
        let parent = windows::Win32::Foundation::HWND(parent_hwnd as *mut std::ffi::c_void);
        if parent.0.is_null() {
            return None;
        }

        // El overlay de Prisma está por encima de todo: cualquier ventana propia
        // (incluido el proceso de WebView2) se descarta comparando el ancestro raíz.
        let root = windows::Win32::UI::WindowsAndMessaging::GetAncestor(
            parent,
            windows::Win32::UI::WindowsAndMessaging::GA_ROOT,
        );
        let mut root_pid: u32 = 0;
        if !root.0.is_null() {
            let _ = GetWindowThreadProcessId(root, Some(&mut root_pid));
        }
        if root_pid == std::process::id() {
            return None;
        }

        let mut pt_client = POINT {
            x: screen_x,
            y: screen_y,
        };
        // Convertir a coordenadas de cliente de la ventana padre.
        let _ = windows::Win32::Graphics::Gdi::ScreenToClient(parent, &mut pt_client);

        let child_hwnd = ChildWindowFromPointEx(
            parent,
            pt_client,
            CWP_SKIPINVISIBLE | CWP_SKIPTRANSPARENT,
        );

        if !child_hwnd.0.is_null() && child_hwnd != parent {
            let mut child_rect = RECT::default();
            if GetWindowRect(child_hwnd, &mut child_rect).is_ok() {
                let w = child_rect.right - child_rect.left;
                let h = child_rect.bottom - child_rect.top;
                if w > 12 && h > 12 {
                    let mut class_buf = [0u16; 128];
                    let class_copied = GetClassNameW(child_hwnd, &mut class_buf);
                    let class_name = String::from_utf16_lossy(&class_buf[..class_copied as usize]);

                    if is_system_window(&class_name) {
                        return None;
                    }

                    return Some(DetectedTarget {
                        id: format!("{:?}", child_hwnd.0),
                        title: "Región Interna".to_string(),
                        class_name,
                        x: child_rect.left,
                        y: child_rect.top,
                        width: w,
                        height: h,
                        is_child: true,
                        hwnd: child_hwnd.0 as usize as u64,
                    });
                }
            }
        }
    }
    None
}

#[cfg(not(windows))]
pub fn detect_subregions_at(_parent_hwnd: u64, _screen_x: i32, _screen_y: i32) -> Option<DetectedTarget> {
    None
}

#[cfg(test)]
mod selection_tests {
    use super::*;

    fn target(class_name: &str, x: i32, y: i32, width: i32, height: i32) -> DetectedTarget {
        DetectedTarget { id: class_name.into(), title: class_name.into(), class_name: class_name.into(),
            x, y, width, height, is_child: false, hwnd: 0 }
    }

    #[test]
    fn taskbar_blocks_windows_behind_it_and_uses_half_open_bounds() {
        let taskbar = target("Shell_TrayWnd", 0, 0, 48, 1080);
        let app = target("App", 0, 0, 1920, 1080);
        assert!(target_at(vec![taskbar.clone(), app.clone()], 10, 500).is_none());
        assert_eq!(target_at(vec![taskbar, app.clone()], 48, 500).unwrap().id, "App");
        assert!(target_at(vec![app], 1920, 500).is_none());
    }

    #[test]
    fn java_uwp_and_button_controls_are_not_system_windows() {
        for name in ["SunAwtWindow", "Windows.UI.Core.CoreWindow", "Windows.UI.Composition.DesktopWindowContentBridge", "Xaml_WindowedPopupClass", "Button"] {
            assert!(!is_system_window(name), "{name} debe seguir siendo capturable");
        }
        assert!(is_system_window("shell_secondarytraywnd"));
        assert!(is_system_window("WorkerW"));
    }

    /// La barra de tareas y el escritorio nunca deben aparecer como objetivo de captura.
    #[test]
    fn la_barra_de_tareas_y_el_escritorio_quedan_excluidos() {
        let targets = enumerate_visible_windows();
        for t in &targets {
            assert!(
                !is_system_window(&t.class_name),
                "la ventana del sistema {} no debe listarse como objetivo",
                t.class_name
            );
        }
    }

    /// El objetivo bajo el cursor debe resolverse con el hit-test del sistema y nunca
    /// ser la barra de tareas.
    #[test]
    fn el_objetivo_bajo_el_cursor_es_una_ventana_real() {
        let targets = enumerate_visible_windows();
        if targets.is_empty() {
            return; // Entorno sin ventanas visibles: nada que verificar.
        }
        let first = &targets[0];
        let found = detect_window_at(
            first.x + first.width / 2,
            first.y + first.height / 2,
            &[],
        )
        .expect("debe resolverse la ventana bajo el punto");
        assert!(
            !is_system_window(&found.class_name),
            "no debe resolverse una ventana del sistema ({})",
            found.class_name
        );
    }

    /// El hit-test debe resolverse también cuando el punto cae en el escritorio.
    #[test]
    fn el_hit_test_no_devuelve_la_barra_de_tareas() {
        for x in [1, 10, 24, 40] {
            if let Some(found) = detect_window_at(x, 500, &[]) {
                assert!(
                    !is_system_window(&found.class_name),
                    "la barra de tareas no debe resolverse en x={x} (devolvió {})",
                    found.class_name
                );
            }
        }
    }
}
