#[cfg(windows)]
use windows::Win32::Foundation::HWND;
#[cfg(windows)]
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
    EnumDisplayMonitors, GetDC, GetDIBits, GetMonitorInfoW, ReleaseDC, SelectObject,
    BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HDC, HMONITOR, MONITORINFO,
    ROP_CODE, SRCCOPY,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorTarget {
    pub id: usize,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub is_primary: bool,
}

#[derive(Clone)]
pub struct ScreenSnapshot {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

impl ScreenSnapshot {
    pub fn crop(&self, crop_x: i32, crop_y: i32, crop_w: u32, crop_h: u32) -> Result<image::RgbaImage, String> {
        let rel_x = (crop_x - self.x).max(0) as u32;
        let rel_y = (crop_y - self.y).max(0) as u32;

        let safe_w = crop_w.min(self.width.saturating_sub(rel_x));
        let safe_h = crop_h.min(self.height.saturating_sub(rel_y));

        if safe_w == 0 || safe_h == 0 {
            return Err("Área de recorte vacía o fuera del lienzo virtual".to_string());
        }

        let mut cropped = image::RgbaImage::new(safe_w, safe_h);
        for row in 0..safe_h {
            let src_y = rel_y + row;
            let src_start = ((src_y * self.width + rel_x) * 4) as usize;
            let src_end = src_start + (safe_w * 4) as usize;
            let dest_start = (row * safe_w * 4) as usize;
            let dest_end = dest_start + (safe_w * 4) as usize;

            if src_end <= self.rgba.len() && dest_end <= cropped.as_mut().len() {
                cropped.as_mut()[dest_start..dest_end].copy_from_slice(&self.rgba[src_start..src_end]);
            }
        }

        Ok(cropped)
    }

    pub fn get_pixel_color(&self, screen_x: i32, screen_y: i32) -> Option<(u8, u8, u8)> {
        let rel_x = screen_x - self.x;
        let rel_y = screen_y - self.y;
        if rel_x >= 0 && rel_x < self.width as i32 && rel_y >= 0 && rel_y < self.height as i32 {
            let idx = (rel_y as usize * self.width as usize + rel_x as usize) * 4;
            if idx + 2 < self.rgba.len() {
                return Some((self.rgba[idx], self.rgba[idx + 1], self.rgba[idx + 2]));
            }
        }
        None
    }
}

/// Captura el escritorio virtual completo con todas las pantallas y ventanas compuestas.
#[cfg(windows)]
pub fn capture_virtual_screen() -> Result<ScreenSnapshot, String> {
    unsafe {
        let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        let width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        let height = GetSystemMetrics(SM_CYVIRTUALSCREEN);

        if width <= 0 || height <= 0 {
            return Err("Dimensiones de pantalla virtual inválidas".to_string());
        }

        let hdc_screen = GetDC(HWND::default());
        if hdc_screen.0.is_null() {
            return Err("No se pudo obtener el contexto de dispositivo de pantalla (DC)".to_string());
        }

        let hdc_mem = CreateCompatibleDC(hdc_screen);
        if hdc_mem.0.is_null() {
            let _ = ReleaseDC(HWND::default(), hdc_screen);
            return Err("No se pudo crear el contexto de memoria compatible".to_string());
        }

        let hbitmap = CreateCompatibleBitmap(hdc_screen, width, height);
        if hbitmap.0.is_null() {
            let _ = DeleteDC(hdc_mem);
            let _ = ReleaseDC(HWND::default(), hdc_screen);
            return Err("No se pudo crear el mapa de bits compatible para la captura".to_string());
        }

        let old_obj = SelectObject(hdc_mem, hbitmap);

        // CAPTUREBLT (0x40000000) asegura que ventanas transparentes y layered sean capturadas fielmente
        let rop = ROP_CODE(SRCCOPY.0 | 0x40000000);
        let bitblt_res = BitBlt(
            hdc_mem,
            0,
            0,
            width,
            height,
            hdc_screen,
            x,
            y,
            rop,
        );

        let _ = SelectObject(hdc_mem, old_obj);

        if let Err(e) = bitblt_res {
            let _ = DeleteObject(hbitmap);
            let _ = DeleteDC(hdc_mem);
            let _ = ReleaseDC(HWND::default(), hdc_screen);
            return Err(format!("Fallo en la operación BitBlt al capturar pantalla: {e}"));
        }

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // Top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut buffer = vec![0u8; (width * height * 4) as usize];
        let lines_copied = GetDIBits(
            hdc_screen,
            hbitmap,
            0,
            height as u32,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        let _ = DeleteObject(hbitmap);
        let _ = DeleteDC(hdc_mem);
        let _ = ReleaseDC(HWND::default(), hdc_screen);

        if lines_copied == 0 {
            return Err("No se pudieron extraer los píxeles con GetDIBits".to_string());
        }

        // Convertir formato BGRA nativo de Windows a RGBA canónico
        for chunk in buffer.chunks_exact_mut(4) {
            let b = chunk[0];
            let r = chunk[2];
            chunk[0] = r;
            chunk[2] = b;
            chunk[3] = 255; // Opacidad total
        }

        Ok(ScreenSnapshot {
            x,
            y,
            width: width as u32,
            height: height as u32,
            rgba: buffer,
        })
    }
}

#[cfg(not(windows))]
pub fn capture_virtual_screen() -> Result<ScreenSnapshot, String> {
    Err("Captura de pantalla solo disponible en Windows".to_string())
}

/// Enumera todos los monitores activos en el sistema operativo.
#[cfg(windows)]
pub fn enumerate_monitors() -> Vec<MonitorTarget> {
    use std::sync::Mutex;
    static MONITORS: Mutex<Vec<MonitorTarget>> = Mutex::new(Vec::new());

    if let Ok(mut lock) = MONITORS.lock() {
        lock.clear();
    }

    unsafe extern "system" fn monitor_enum_proc(
        hmonitor: HMONITOR,
        _hdc: HDC,
        _lprect: *mut windows::Win32::Foundation::RECT,
        _lparam: windows::Win32::Foundation::LPARAM,
    ) -> windows::Win32::Foundation::BOOL {
        let mut mi = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };

        unsafe {
            if GetMonitorInfoW(hmonitor, &mut mi).as_bool() {
                if let Ok(mut list) = MONITORS.lock() {
                    let id = list.len() + 1;
                    let is_primary = (mi.dwFlags & 1) != 0;
                    let x = mi.rcMonitor.left;
                    let y = mi.rcMonitor.top;
                    let width = mi.rcMonitor.right - mi.rcMonitor.left;
                    let height = mi.rcMonitor.bottom - mi.rcMonitor.top;

                    list.push(MonitorTarget {
                        id,
                        name: format!("Monitor {}", id),
                        x,
                        y,
                        width,
                        height,
                        is_primary,
                    });
                }
            }
        }
        windows::Win32::Foundation::BOOL(1)
    }

    unsafe {
        let _ = EnumDisplayMonitors(
            HDC::default(),
            None,
            Some(monitor_enum_proc),
            windows::Win32::Foundation::LPARAM(0),
        );
    }

    if let Ok(lock) = MONITORS.lock() {
        lock.clone()
    } else {
        Vec::new()
    }
}

#[cfg(not(windows))]
pub fn enumerate_monitors() -> Vec<MonitorTarget> {
    Vec::new()
}
