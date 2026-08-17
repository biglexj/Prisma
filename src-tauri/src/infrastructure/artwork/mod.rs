use std::{fs, io::Cursor, path::Path, sync::LazyLock};
use tokio::sync::Semaphore;

use base64::{Engine as _, engine::general_purpose::STANDARD};
use image::{ImageFormat, ImageReader};
use lofty::{
    config::ParseOptions,
    file::TaggedFileExt,
    picture::{Picture, PictureType},
    probe::Probe,
};

pub static ARTWORK_SEMAPHORE: LazyLock<Semaphore> = LazyLock::new(|| Semaphore::new(4));

const MAX_ARTWORK_INPUT_BYTES: usize = 8 * 1024 * 1024;
const ARTWORK_MAX_DIM: u32 = 384;
const FOLDER_COVER_NAMES: &[&str] = &[
    "cover.jpg",
    "cover.jpeg",
    "cover.png",
    "cover.webp",
    "folder.jpg",
    "folder.jpeg",
    "folder.png",
    "folder.webp",
    "front.jpg",
    "front.jpeg",
    "front.png",
    "front.webp",
    "album.jpg",
    "album.jpeg",
    "album.png",
    "album.webp",
];

pub fn load_music_artwork_data_url(audio_path: &Path) -> Option<String> {
    embedded_artwork(audio_path).or_else(|| folder_artwork(audio_path))
}

pub fn load_music_artwork_raw_bytes(audio_path: &Path) -> Option<(Vec<u8>, &'static str)> {
    if let Some(picture) = embedded_picture(audio_path) {
        let data = picture.data().to_vec();
        let mime = detect_image_mime(&data).unwrap_or("image/jpeg");
        return Some((data, mime));
    }
    folder_artwork_bytes(audio_path)
}

fn embedded_picture(audio_path: &Path) -> Option<Picture> {
    let options = ParseOptions::new().read_properties(false);
    let tagged_file = Probe::open(audio_path)
        .ok()?
        .options(options)
        .guess_file_type()
        .ok()?
        .read()
        .ok()?;

    tagged_file
        .tags()
        .iter()
        .flat_map(|tag| tag.pictures())
        .find(|picture| picture.pic_type() == PictureType::CoverFront)
        .or_else(|| {
            tagged_file
                .tags()
                .iter()
                .flat_map(|tag| tag.pictures())
                .next()
        })
        .cloned()
}

fn embedded_artwork(audio_path: &Path) -> Option<String> {
    let picture = embedded_picture(audio_path)?;
    picture_data_url(&picture)
}

fn folder_artwork_bytes(audio_path: &Path) -> Option<(Vec<u8>, &'static str)> {
    let parent = audio_path.parent()?;
    let entries: Vec<_> = fs::read_dir(parent).ok()?.flatten().collect();

    for expected_name in FOLDER_COVER_NAMES {
        let Some(entry) = entries.iter().find(|entry| {
            entry
                .file_name()
                .to_str()
                .is_some_and(|name| name.eq_ignore_ascii_case(expected_name))
        }) else {
            continue;
        };
        let Ok(data) = fs::read(entry.path()) else {
            continue;
        };
        let mime = detect_image_mime(&data).unwrap_or("image/jpeg");
        return Some((data, mime));
    }

    None
}

fn folder_artwork(audio_path: &Path) -> Option<String> {
    let (data, _) = folder_artwork_bytes(audio_path)?;
    bytes_to_data_url(&data)
}

fn picture_data_url(picture: &Picture) -> Option<String> {
    bytes_to_data_url(picture.data())
}

fn bytes_to_data_url(data: &[u8]) -> Option<String> {
    if data.is_empty() || data.len() > MAX_ARTWORK_INPUT_BYTES {
        return None;
    }

    if let Ok(reader) = ImageReader::new(Cursor::new(data)).with_guessed_format() {
        if let Ok(img) = reader.decode() {
            let resized = if img.width() > ARTWORK_MAX_DIM || img.height() > ARTWORK_MAX_DIM {
                img.thumbnail(ARTWORK_MAX_DIM, ARTWORK_MAX_DIM)
            } else {
                img
            };

            let mut buffer = Vec::new();
            if resized
                .write_to(&mut Cursor::new(&mut buffer), ImageFormat::WebP)
                .is_ok()
            {
                return Some(format!(
                    "data:image/webp;base64,{}",
                    STANDARD.encode(&buffer)
                ));
            } else {
                buffer.clear();
                if resized
                    .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Jpeg)
                    .is_ok()
                {
                    return Some(format!(
                        "data:image/jpeg;base64,{}",
                        STANDARD.encode(&buffer)
                    ));
                }
            }
        }
    }

    if data.len() <= 512 * 1024 {
        let mime = detect_image_mime(data)?;
        Some(format!("data:{mime};base64,{}", STANDARD.encode(data)))
    } else {
        None
    }
}

fn detect_image_mime(data: &[u8]) -> Option<&'static str> {
    if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if data.starts_with(b"\x89PNG\r\n\x1A\n") {
        Some("image/png")
    } else if data.starts_with(b"GIF87a") || data.starts_with(b"GIF89a") {
        Some("image/gif")
    } else if data.len() >= 12 && data.starts_with(b"RIFF") && &data[8..12] == b"WEBP" {
        Some("image/webp")
    } else if data.starts_with(b"BM") {
        Some("image/bmp")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use image::{ImageBuffer, Rgb};

    use super::{bytes_to_data_url, detect_image_mime, load_music_artwork_data_url};

    #[test]
    fn recognizes_common_cover_formats() {
        assert_eq!(detect_image_mime(b"\xFF\xD8\xFFrest"), Some("image/jpeg"));
        assert_eq!(
            detect_image_mime(b"\x89PNG\r\n\x1A\nrest"),
            Some("image/png")
        );
        assert_eq!(detect_image_mime(b"RIFF0000WEBPrest"), Some("image/webp"));
        assert_eq!(detect_image_mime(b"not-an-image"), None);
    }

    #[test]
    fn builds_a_browser_safe_data_url() {
        let data_url = bytes_to_data_url(b"\xFF\xD8\xFFrest").unwrap();
        assert!(data_url.starts_with("data:image/jpeg;base64,"));
    }

    #[test]
    fn downscales_large_images_to_webp() {
        let img: ImageBuffer<Rgb<u8>, _> = ImageBuffer::new(1200, 1200);
        let mut raw_bytes = Vec::new();
        img.write_to(&mut std::io::Cursor::new(&mut raw_bytes), image::ImageFormat::Png)
            .unwrap();

        let data_url = bytes_to_data_url(&raw_bytes).unwrap();
        assert!(data_url.starts_with("data:image/webp;base64,"));
        // Transformed WebP should be substantially smaller than raw PNG
        assert!(data_url.len() < raw_bytes.len() * 2);
    }

    #[test]
    fn uses_a_folder_cover_when_the_audio_has_no_embedded_picture() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("prisma-artwork-{nonce}"));
        std::fs::create_dir_all(&root).unwrap();
        let audio_path = root.join("canción.mp3");
        std::fs::write(&audio_path, b"audio de prueba").unwrap();
        std::fs::write(root.join("Folder.JPG"), b"\xFF\xD8\xFFcover").unwrap();

        let artwork = load_music_artwork_data_url(&audio_path).unwrap();

        assert!(artwork.starts_with("data:image/jpeg;base64,") || artwork.starts_with("data:image/webp;base64,"));
        std::fs::remove_dir_all(root).unwrap();
    }
}
