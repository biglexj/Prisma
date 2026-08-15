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

        result
    }
}

#[cfg(not(target_os = "windows"))]
pub fn load_video_thumbnail_data_url(_path: &Path) -> Option<String> {
    None
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
}
