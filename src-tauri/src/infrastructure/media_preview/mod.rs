use std::{fs, io::Cursor, path::Path, sync::LazyLock};
use tokio::sync::Semaphore;

use base64::{Engine as _, engine::general_purpose::STANDARD};
use image::{ImageFormat, ImageReader};

pub static VISUAL_PREVIEW_SEMAPHORE: LazyLock<Semaphore> = LazyLock::new(|| Semaphore::new(4));

const MAX_PREVIEW_FILE_BYTES: u64 = 120 * 1024 * 1024;
const THUMBNAIL_MAX_DIM: u32 = 480;

pub fn load_image_data_url(path: &Path) -> Option<String> {
    let metadata = fs::metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > MAX_PREVIEW_FILE_BYTES {
        return None;
    }

    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if ext == "elx" {
        let (rgb_img, _header) = crate::infrastructure::codecs::elyx::decode_elyx_file(path).ok()?;
        let dyn_img = image::DynamicImage::ImageRgb8(rgb_img);
        let resized = if dyn_img.width() > THUMBNAIL_MAX_DIM || dyn_img.height() > THUMBNAIL_MAX_DIM {
            dyn_img.thumbnail(THUMBNAIL_MAX_DIM, THUMBNAIL_MAX_DIM)
        } else {
            dyn_img
        };
        let mut buffer = Vec::new();
        if resized.write_to(&mut Cursor::new(&mut buffer), ImageFormat::WebP).is_ok() {
            return Some(format!("data:image/webp;base64,{}", STANDARD.encode(&buffer)));
        } else if resized.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Jpeg).is_ok() {
            return Some(format!("data:image/jpeg;base64,{}", STANDARD.encode(&buffer)));
        }
        return None;
    }

    if ext == "jxl" {
        if let Ok(bytes) = crate::infrastructure::codecs::jxl::decode_jxl_thumbnail(path, THUMBNAIL_MAX_DIM) {
            return Some(format!("data:image/jpeg;base64,{}", STANDARD.encode(&bytes)));
        }
    }

    let reader = ImageReader::open(path).ok()?.with_guessed_format().ok()?;
    let format = reader.format()?;
    let img = reader.decode().ok()?;

    let resized = if img.width() > THUMBNAIL_MAX_DIM || img.height() > THUMBNAIL_MAX_DIM {
        img.thumbnail(THUMBNAIL_MAX_DIM, THUMBNAIL_MAX_DIM)
    } else {
        img
    };

    let mut buffer = Vec::new();
    let (mime, enc_format) = match format {
        ImageFormat::Png => ("image/webp", ImageFormat::WebP),
        ImageFormat::WebP => ("image/webp", ImageFormat::WebP),
        _ => ("image/jpeg", ImageFormat::Jpeg),
    };

    if resized.write_to(&mut Cursor::new(&mut buffer), enc_format).is_err() {
        buffer.clear();
        if resized.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Jpeg).is_err() {
            return None;
        }
        return Some(format!("data:image/jpeg;base64,{}", STANDARD.encode(&buffer)));
    }

    Some(format!("data:{mime};base64,{}", STANDARD.encode(&buffer)))
}

pub fn load_image_full_render_data_url(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|e| format!("No se pudo leer archivo: {e}"))?;
    if !metadata.is_file() {
        return Err("La ruta no es un archivo válido".to_string());
    }

    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if ext == "elx" {
        let (rgb_img, _header) = crate::infrastructure::codecs::elyx::decode_elyx_file(path)?;
        let dyn_img = image::DynamicImage::ImageRgb8(rgb_img);
        let mut buffer = Vec::new();
        if dyn_img.width() <= 16383 && dyn_img.height() <= 16383 {
            dyn_img
                .write_to(&mut Cursor::new(&mut buffer), ImageFormat::WebP)
                .map_err(|e| format!("Error codificando WebP para visor: {e}"))?;
            return Ok(format!("data:image/webp;base64,{}", STANDARD.encode(&buffer)));
        } else {
            dyn_img
                .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Jpeg)
                .map_err(|e| format!("Error codificando Jpeg para visor: {e}"))?;
            return Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(&buffer)));
        }
    }

    if ext == "jxl" {
        let bytes = crate::infrastructure::codecs::jxl::decode_jxl_full(path)?;
        return Ok(format!("data:image/webp;base64,{}", STANDARD.encode(&bytes)));
    }

    let reader = ImageReader::open(path)
        .map_err(|e| format!("Error abriendo imagen: {e}"))?
        .with_guessed_format()
        .map_err(|e| format!("Formato no reconocido: {e}"))?;
    let img = reader
        .decode()
        .map_err(|e| format!("Error decodificando imagen: {e}"))?;

    let mut buffer = Vec::new();
    if img.width() <= 16383 && img.height() <= 16383 {
        img.write_to(&mut Cursor::new(&mut buffer), ImageFormat::WebP)
            .map_err(|e| format!("Error codificando WebP para visor: {e}"))?;
        Ok(format!("data:image/webp;base64,{}", STANDARD.encode(&buffer)))
    } else {
        img.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Jpeg)
            .map_err(|e| format!("Error codificando Jpeg para visor: {e}"))?;
        Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(&buffer)))
    }
}

#[cfg(target_os = "windows")]
pub fn load_video_thumbnail_data_url(path: &Path) -> Option<String> {
    use windows::core::HSTRING;
    use windows::Win32::Foundation::SIZE;
    use windows::Win32::Graphics::Gdi::DeleteObject;
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::{
        SHCreateItemFromParsingName, IShellItemImageFactory, SIIGBF_BIGGERSIZEOK,
        SIIGBF_RESIZETOFIT, SIIGBF_THUMBNAILONLY,
    };

    let path_str = path.to_string_lossy();
    let clean_str = if path_str.starts_with(r"\\?\") {
        &path_str[4..]
    } else {
        &path_str
    };

    unsafe {
        let com_init = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let should_uninit = com_init.is_ok();

        let hstring_path = HSTRING::from(clean_str);
        let factory_result: windows::core::Result<IShellItemImageFactory> =
            SHCreateItemFromParsingName(&hstring_path, None);

        let factory = match factory_result {
            Ok(f) => f,
            Err(_) => {
                if should_uninit {
                    CoUninitialize();
                }
                return None;
            }
        };

        let size = SIZE { cx: 360, cy: 240 };
        let hbitmap_result = factory
            .GetImage(size, SIIGBF_BIGGERSIZEOK)
            .or_else(|_| factory.GetImage(size, SIIGBF_RESIZETOFIT))
            .or_else(|_| factory.GetImage(size, SIIGBF_THUMBNAILONLY));

        let result = match hbitmap_result {
            Ok(hbitmap) => {
                let res = convert_hbitmap_to_jpeg_data_url(hbitmap.0 as _);
                let _ = DeleteObject(hbitmap);
                res
            }
            Err(_) => None,
        };

        if should_uninit {
            CoUninitialize();
        }

        result.or_else(|| load_video_thumbnail_ffmpeg(path))
    }
}

pub fn load_video_thumbnail_ffmpeg(path: &Path) -> Option<String> {
    let ffmpeg = crate::infrastructure::converter::find_ffmpeg_binary()?;
    let path_str = path.to_string_lossy();
    let clean_str = path_str.trim_start_matches(r"\\?\");

    let mut cmd = std::process::Command::new(&ffmpeg);
    cmd.args([
        "-v", "error",
        "-nostdin",
        "-ss", "00:00:00.10",
        "-i", clean_str,
        "-vframes", "1",
        "-vf", "scale='min(480,iw)':-2",
        "-f", "image2",
        "-c:v", "mjpeg",
        "-q:v", "4",
        "pipe:1",
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().ok()?;
    if output.status.success() && !output.stdout.is_empty() {
        use base64::Engine;
        use base64::engine::general_purpose::STANDARD;
        Some(format!("data:image/jpeg;base64,{}", STANDARD.encode(&output.stdout)))
    } else {
        let mut fallback_cmd = std::process::Command::new(ffmpeg);
        fallback_cmd.args([
            "-v", "error",
            "-nostdin",
            "-i", clean_str,
            "-vframes", "1",
            "-vf", "scale='min(480,iw)':-2",
            "-f", "image2",
            "-c:v", "mjpeg",
            "-q:v", "4",
            "pipe:1",
        ]);

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            fallback_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let fallback_output = fallback_cmd.output().ok()?;
        if fallback_output.status.success() && !fallback_output.stdout.is_empty() {
            use base64::Engine;
            use base64::engine::general_purpose::STANDARD;
            Some(format!("data:image/jpeg;base64,{}", STANDARD.encode(&fallback_output.stdout)))
        } else {
            None
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn load_video_thumbnail_data_url(path: &Path) -> Option<String> {
    load_video_thumbnail_ffmpeg(path)
}

pub fn load_video_thumbnail_raw_bytes(path: &Path) -> Option<Vec<u8>> {
    let data_url = load_video_thumbnail_data_url(path)?;
    let comma_idx = data_url.find(',')?;
    STANDARD.decode(&data_url[comma_idx + 1..]).ok()
}

#[cfg(target_os = "windows")]
fn convert_hbitmap_to_jpeg_data_url(hbitmap: *mut std::ffi::c_void) -> Option<String> {
    unsafe extern "system" {
        fn GetObjectW(h: *mut std::ffi::c_void, c: i32, pv: *mut std::ffi::c_void) -> i32;
        fn GetDIBits(
            hdc: *mut std::ffi::c_void,
            hbm: *mut std::ffi::c_void,
            start: u32,
            lines: u32,
            bits: *mut u8,
            info: *mut u8,
            usage: u32,
        ) -> i32;
        fn CreateCompatibleDC(hdc: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        fn DeleteDC(hdc: *mut std::ffi::c_void) -> i32;
    }

    #[allow(non_snake_case)]
    #[repr(C)]
    struct BITMAP {
        bmType: i32,
        bmWidth: i32,
        bmHeight: i32,
        bmWidthBytes: i32,
        bmPlanes: u16,
        bmBitsPixel: u16,
        bmBits: *mut std::ffi::c_void,
    }

    unsafe {
        let mut bm: BITMAP = std::mem::zeroed();
        if GetObjectW(hbitmap, std::mem::size_of::<BITMAP>() as i32, &mut bm as *mut _ as *mut _) == 0 {
            return None;
        }

        let width = bm.bmWidth;
        let height = bm.bmHeight;
        if width <= 0 || height <= 0 {
            return None;
        }

        let hdc = CreateCompatibleDC(std::ptr::null_mut());
        let mut bmi = vec![0u8; 40];
        bmi[0..4].copy_from_slice(&40u32.to_ne_bytes());
        bmi[4..8].copy_from_slice(&width.to_ne_bytes());
        bmi[8..12].copy_from_slice(&(-height).to_ne_bytes());
        bmi[12..14].copy_from_slice(&1u16.to_ne_bytes());
        bmi[14..16].copy_from_slice(&32u16.to_ne_bytes());

        let mut pixels = vec![0u8; (width * height * 4) as usize];
        let res = GetDIBits(
            hdc,
            hbitmap,
            0,
            height as u32,
            pixels.as_mut_ptr(),
            bmi.as_mut_ptr(),
            0,
        );
        DeleteDC(hdc);

        if res == 0 {
            return None;
        }

        let mut rgb_pixels = Vec::with_capacity((width * height * 3) as usize);
        for chunk in pixels.chunks_exact(4) {
            let b = chunk[0];
            let g = chunk[1];
            let r = chunk[2];
            rgb_pixels.push(r);
            rgb_pixels.push(g);
            rgb_pixels.push(b);
        }

        let img = image::RgbImage::from_raw(width as u32, height as u32, rgb_pixels)?;
        let dynamic_img = image::DynamicImage::ImageRgb8(img);
        let resized = dynamic_img.thumbnail(THUMBNAIL_MAX_DIM, THUMBNAIL_MAX_DIM);

        let mut buffer = Vec::new();
        resized.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Jpeg).ok()?;
        Some(format!("data:image/jpeg;base64,{}", STANDARD.encode(&buffer)))
    }
}

#[cfg(test)]
mod tests {
    use super::load_image_data_url;
    use image::{ImageBuffer, Rgb};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn loads_and_downscales_image_to_data_url() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("prisma-test-img-{nonce}.jpg"));
        
        let img: ImageBuffer<Rgb<u8>, _> = ImageBuffer::new(800, 600);
        img.save(&path).unwrap();

        let data_url = load_image_data_url(&path).unwrap();
        assert!(data_url.starts_with("data:image/jpeg;base64,") || data_url.starts_with("data:image/webp;base64,"));

        let _ = std::fs::remove_file(path);
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_load_video_thumbnail() {
        use super::load_video_thumbnail_data_url;
        use std::path::Path;

        let test_path = Path::new(r"\\?\D:\Vídeos\Un_universo_en_un_repositorio.mp4");
        assert!(test_path.exists(), "Test video file exists");
        let res = load_video_thumbnail_data_url(test_path);
        println!("Video thumbnail result length: {:?}", res.as_ref().map(|s| s.len()));
        assert!(res.is_some(), "Video thumbnail was successfully generated");
    }

    #[test]
    fn test_load_mov_video_thumbnail() {
        use super::load_video_thumbnail_data_url;
        use std::path::Path;

        let test_path = Path::new(r"D:\Vídeos\Partidos\Render\Marcar.mov");
        if test_path.exists() {
            let res = load_video_thumbnail_data_url(test_path);
            println!("MOV CineForm thumbnail result length: {:?}", res.as_ref().map(|s| s.len()));
            assert!(res.is_some(), "MOV CineForm video thumbnail was successfully generated");
            let data = res.unwrap();
            assert!(data.starts_with("data:image/jpeg;base64,"));
        }
    }

    #[test]
    fn test_load_elyx_thumbnail_and_full_render() {
        use super::{load_image_data_url, load_image_full_render_data_url};
        use std::path::Path;

        let test_path = Path::new(r"D:\Imágenes\ELYX_nativo_20261017_181309\variantes\Peyto_s8.elx");
        if test_path.exists() {
            let thumb = load_image_data_url(test_path).expect("Fallo al generar miniatura de ElyX");
            assert!(thumb.starts_with("data:image/"));

            let full = load_image_full_render_data_url(test_path).expect("Fallo al generar render completo de ElyX");
            assert!(full.starts_with("data:image/"));
        }
    }

    #[test]
    fn test_load_jxl_thumbnail_and_full_render() {
        use super::{load_image_data_url, load_image_full_render_data_url};
        use std::path::Path;

        let test_path = Path::new(r"D:\Imágenes\ELYX_resultados_20261017_174854\variantes\jxl_q70.jxl");
        if test_path.exists() {
            let thumb = load_image_data_url(test_path).expect("Fallo al generar miniatura de JXL");
            assert!(thumb.starts_with("data:image/"));

            let full = load_image_full_render_data_url(test_path).expect("Fallo al generar render completo de JXL");
            assert!(full.starts_with("data:image/"));
        }
    }
}
