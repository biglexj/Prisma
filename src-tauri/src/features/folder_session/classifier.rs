use std::path::Path;

use super::MediaFamily;

const AUDIO_EXTENSIONS: &[&str] = &[
    "aac", "aif", "aiff", "alac", "ape", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav", "wave",
    "wv",
];
const IMAGE_EXTENSIONS: &[&str] = &[
    "avif", "bmp", "gif", "jpeg", "jpg", "jxl", "png", "tif", "tiff", "webp",
];
const VIDEO_EXTENSIONS: &[&str] = &[
    "3gp", "avi", "flv", "m2ts", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "ts", "webm",
    "wmv",
];

pub fn classify_path(path: &Path) -> Option<MediaFamily> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();

    if AUDIO_EXTENSIONS.contains(&extension.as_str()) {
        Some(MediaFamily::Audio)
    } else if IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        Some(MediaFamily::Image)
    } else if VIDEO_EXTENSIONS.contains(&extension.as_str()) {
        Some(MediaFamily::Video)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{MediaFamily, classify_path};

    #[test]
    fn classification_is_case_insensitive() {
        assert_eq!(
            classify_path(Path::new("Canción.FLAC")),
            Some(MediaFamily::Audio)
        );
        assert_eq!(
            classify_path(Path::new("Foto.WEBP")),
            Some(MediaFamily::Image)
        );
        assert_eq!(
            classify_path(Path::new("Vídeo.MKV")),
            Some(MediaFamily::Video)
        );
        assert_eq!(classify_path(Path::new("notas.txt")), None);
    }
}
