use std::{fs, path::Path};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use lofty::{
    config::ParseOptions,
    file::TaggedFileExt,
    picture::{Picture, PictureType},
    probe::Probe,
};

const MAX_ARTWORK_BYTES: usize = 8 * 1024 * 1024;
const FOLDER_COVER_NAMES: &[&str] = &[
    "cover.jpg",
    "cover.jpeg",
    "cover.png",
    "folder.jpg",
    "folder.jpeg",
    "folder.png",
    "front.jpg",
    "front.jpeg",
    "front.png",
    "album.jpg",
    "album.jpeg",
    "album.png",
];

pub fn load_music_artwork_data_url(audio_path: &Path) -> Option<String> {
    embedded_artwork(audio_path).or_else(|| folder_artwork(audio_path))
}

fn embedded_artwork(audio_path: &Path) -> Option<String> {
    let options = ParseOptions::new().read_properties(false);
    let tagged_file = Probe::open(audio_path)
        .ok()?
        .options(options)
        .guess_file_type()
        .ok()?
        .read()
        .ok()?;

    let picture = tagged_file
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
        })?;

    picture_data_url(picture)
}

fn folder_artwork(audio_path: &Path) -> Option<String> {
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
        if let Some(data_url) = bytes_to_data_url(&data) {
            return Some(data_url);
        }
    }

    None
}

fn picture_data_url(picture: &Picture) -> Option<String> {
    bytes_to_data_url(picture.data())
}

fn bytes_to_data_url(data: &[u8]) -> Option<String> {
    if data.is_empty() || data.len() > MAX_ARTWORK_BYTES {
        return None;
    }
    let mime = detect_image_mime(data)?;
    Some(format!("data:{mime};base64,{}", STANDARD.encode(data)))
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

        assert!(artwork.starts_with("data:image/jpeg;base64,"));
        std::fs::remove_dir_all(root).unwrap();
    }
}
