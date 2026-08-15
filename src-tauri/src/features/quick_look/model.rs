use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QuickLookMediaType {
    Audio,
    Video,
    Image,
}

impl QuickLookMediaType {
    pub fn from_extension(ext: &str) -> Option<Self> {
        let lower = ext.to_ascii_lowercase();
        match lower.as_str() {
            "mp3" | "flac" | "wav" | "aac" | "m4a" | "ogg" | "opus" | "wma" => {
                Some(Self::Audio)
            }
            "mp4" | "mkv" | "avi" | "mov" | "webm" | "flv" | "wmv" | "m4v" => {
                Some(Self::Video)
            }
            "jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" | "svg" => {
                Some(Self::Image)
            }
            _ => None,
        }
    }

    pub fn from_path(path: &Path) -> Option<Self> {
        path.extension()
            .and_then(|ext| ext.to_str())
            .and_then(Self::from_extension)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickLookPayload {
    pub path: String,
    pub file_name: String,
    pub media_type: QuickLookMediaType,
    pub file_size_bytes: u64,
    pub formatted_size: String,
    pub track_title: Option<String>,
    pub track_artist: Option<String>,
    pub duration_seconds: Option<f64>,
}

impl QuickLookPayload {
    pub fn new(path_str: String, media_type: QuickLookMediaType) -> Self {
        let path = Path::new(&path_str);
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&path_str)
            .to_string();

        let file_size_bytes = std::fs::metadata(path)
            .map(|m| m.len())
            .unwrap_or(0);

        let formatted_size = format_file_size(file_size_bytes);

        let (track_title, track_artist, duration_seconds) = if media_type == QuickLookMediaType::Audio {
            extract_audio_metadata(path)
        } else {
            (None, None, None)
        };

        Self {
            path: path_str,
            file_name,
            media_type,
            file_size_bytes,
            formatted_size,
            track_title,
            track_artist,
            duration_seconds,
        }
    }
}

fn format_file_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.0} KB", bytes as f64 / KB as f64)
    } else {
        format!("{bytes} B")
    }
}

fn extract_audio_metadata(path: &Path) -> (Option<String>, Option<String>, Option<f64>) {
    use lofty::file::{AudioFile, TaggedFileExt};
    use lofty::probe::Probe;
    use lofty::tag::Accessor;


    let probe = match Probe::open(path).and_then(|p| p.read()) {
        Ok(tagged) => tagged,
        Err(_) => return (None, None, None),
    };

    let duration_seconds = {
        let dur = probe.properties().duration();
        let secs = dur.as_secs_f64();
        if secs > 0.0 {
            Some(secs)
        } else {
            None
        }
    };

    let tag = probe.primary_tag().or_else(|| probe.first_tag());
    let (title, artist) = match tag {
        Some(t) => (
            t.title().map(|s| s.to_string()),
            t.artist().map(|s| s.to_string()),
        ),
        None => (None, None),
    };

    (title, artist, duration_seconds)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_media_type_detection() {
        assert_eq!(QuickLookMediaType::from_extension("mp3"), Some(QuickLookMediaType::Audio));
        assert_eq!(QuickLookMediaType::from_extension("FLAC"), Some(QuickLookMediaType::Audio));
        assert_eq!(QuickLookMediaType::from_extension("wav"), Some(QuickLookMediaType::Audio));
        assert_eq!(QuickLookMediaType::from_extension("mp4"), Some(QuickLookMediaType::Video));
        assert_eq!(QuickLookMediaType::from_extension("MKV"), Some(QuickLookMediaType::Video));
        assert_eq!(QuickLookMediaType::from_extension("jpg"), Some(QuickLookMediaType::Image));
        assert_eq!(QuickLookMediaType::from_extension("PNG"), Some(QuickLookMediaType::Image));
        assert_eq!(QuickLookMediaType::from_extension("pdf"), None);
        assert_eq!(QuickLookMediaType::from_extension("docx"), None);
        assert_eq!(QuickLookMediaType::from_extension("exe"), None);
    }

    #[test]
    fn test_format_file_size() {
        assert_eq!(format_file_size(500), "500 B");
        assert_eq!(format_file_size(2048), "2 KB");
        assert_eq!(format_file_size(15 * 1024 * 1024), "15.0 MB");
        assert_eq!(format_file_size(2 * 1024 * 1024 * 1024), "2.00 GB");
    }
}

