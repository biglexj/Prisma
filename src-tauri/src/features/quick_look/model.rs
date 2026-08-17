use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QuickLookMediaType {
    Audio,
    Video,
    Image,
    Pdf,
    Text,
    Markdown,
    Html,
    Folder,
    Project,
    Playlist,
    Lyrics,
    Generic,
}

impl QuickLookMediaType {
    pub fn from_extension(ext: &str) -> Self {
        let lower = ext.to_ascii_lowercase();
        match lower.as_str() {
            "mp3" | "flac" | "wav" | "aac" | "m4a" | "ogg" | "opus" | "wma" => Self::Audio,
            "mp4" | "mkv" | "avi" | "mov" | "webm" | "flv" | "wmv" | "m4v" => Self::Video,
            "jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" | "svg" | "ico" => Self::Image,
            "pdf" => Self::Pdf,
            "md" | "markdown" => Self::Markdown,
            "html" | "htm" | "xhtml" => Self::Html,
            "m3u" | "m3u8" | "pls" | "xspf" => Self::Playlist,
            "lrc" | "srt" | "vtt" | "ass" | "ssa" | "sub" => Self::Lyrics,
            "txt" | "json" | "jsonc" | "json5" | "csv" | "tsv" | "xml" | "yaml" | "yml"
            | "toml" | "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "c" | "cpp" | "h" | "hpp"
            | "cs" | "css" | "scss" | "sass" | "less" | "sql" | "sh" | "bash" | "zsh"
            | "bat" | "cmd" | "ps1" | "ini" | "cfg" | "conf" | "properties" | "env"
            | "log" | "diff" | "patch" | "lock" | "dockerfile" | "graphql" | "proto"
            | "vue" | "svelte" | "gitignore" => Self::Text,
            "kra" | "krz" | "ora" | "psd" | "psb" | "af" | "afphoto" | "afdesign" | "afpub"
            | "aftemplate" | "drp" | "dra" | "blend" => Self::Project,
            _ => Self::Generic,
        }
    }

    pub fn from_path(path: &Path) -> Option<Self> {
        if path.is_dir() {
            return Some(Self::Folder);
        }
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if file_name.starts_with('.') && !file_name.is_empty() {
            return Some(Self::Text);
        }
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        Some(Self::from_extension(ext))
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
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub folder_items_count: Option<usize>,
    pub folder_preview_items: Option<Vec<String>>,
    pub text_content: Option<String>,
    pub project_preview_url: Option<String>,
    pub extension: String,
    pub modified_date: Option<String>,
}

impl QuickLookPayload {
    pub fn new(path_str: String, media_type: QuickLookMediaType) -> Self {
        let path = Path::new(&path_str);
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&path_str)
            .to_string();

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();

        let metadata = std::fs::metadata(path).ok();
        let file_size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let formatted_size = format_file_size(file_size_bytes);

        let modified_date = metadata
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| {
                let secs = d.as_secs();
                let days = secs / 86400;
                format!("{days} días transcurridos")
            });

        let (track_title, track_artist, duration_seconds) = if media_type == QuickLookMediaType::Audio {
            extract_audio_metadata(path)
        } else {
            (None, None, None)
        };

        let (width, height) = if media_type == QuickLookMediaType::Image {
            image::image_dimensions(path).ok().map(|(w, h)| (Some(w), Some(h))).unwrap_or((None, None))
        } else if media_type == QuickLookMediaType::Video {
            get_video_dimensions(path).map(|(w, h)| (Some(w), Some(h))).unwrap_or((None, None))
        } else {
            (None, None)
        };

        let (folder_items_count, folder_preview_items, playlist_duration) = if media_type == QuickLookMediaType::Folder {
            let (_, count, items) = inspect_folder(path);
            (Some(count), Some(items), None)
        } else if media_type == QuickLookMediaType::Playlist {
            if let Ok(items) = crate::infrastructure::playlists::parse_m3u(path) {
                let count = items.len();
                let preview: Vec<String> = items.iter().take(15).map(|it| it.title.clone()).collect();
                let total_dur: f64 = items.iter().map(|it| it.duration_secs as f64).sum();
                let dur = if total_dur > 0.0 { Some(total_dur) } else { None };
                (Some(count), Some(preview), dur)
            } else {
                (Some(0), Some(Vec::new()), None)
            }
        } else {
            (None, None, None)
        };

        let duration_seconds = duration_seconds.or(playlist_duration);

        let text_content = if media_type == QuickLookMediaType::Text
            || media_type == QuickLookMediaType::Markdown
            || media_type == QuickLookMediaType::Lyrics
            || media_type == QuickLookMediaType::Html
        {
            read_text_preview(path)
        } else {
            None
        };

        let project_preview_url = if media_type == QuickLookMediaType::Project {
            if ext == "kra" || ext == "krz" || ext == "ora" {
                extract_kra_preview(path)
            } else {
                crate::infrastructure::media_preview::load_video_thumbnail_data_url(path)
            }
        } else {
            None
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
            width,
            height,
            folder_items_count,
            folder_preview_items,
            text_content,
            project_preview_url,
            extension: ext,
            modified_date,
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

#[cfg(target_os = "windows")]
pub fn get_video_dimensions(path: &Path) -> Option<(u32, u32)> {
    use windows::core::HSTRING;
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::SHCreateItemFromParsingName;
    use windows::Win32::UI::Shell::IShellItem2;
    use windows::Win32::UI::Shell::PropertiesSystem::PROPERTYKEY;

    // PKEY_Video_FrameWidth: {64440490-4C8B-11D1-8B70-080036B11A03}, 3
    const PKEY_VIDEO_FRAME_WIDTH: PROPERTYKEY = PROPERTYKEY {
        fmtid: windows::core::GUID::from_u128(0x64440490_4c8b_11d1_8b70_080036b11a03),
        pid: 3,
    };
    // PKEY_Video_FrameHeight: {64440490-4C8B-11D1-8B70-080036B11A03}, 4
    const PKEY_VIDEO_FRAME_HEIGHT: PROPERTYKEY = PROPERTYKEY {
        fmtid: windows::core::GUID::from_u128(0x64440490_4c8b_11d1_8b70_080036b11a03),
        pid: 4,
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
        let item_result: windows::core::Result<IShellItem2> =
            SHCreateItemFromParsingName(&hstring_path, None);

        let item = match item_result {
            Ok(i) => i,
            Err(_) => {
                if should_uninit {
                    CoUninitialize();
                }
                return None;
            }
        };

        let width = item.GetUInt32(&PKEY_VIDEO_FRAME_WIDTH).ok().unwrap_or(0);
        let height = item.GetUInt32(&PKEY_VIDEO_FRAME_HEIGHT).ok().unwrap_or(0);

        if should_uninit {
            CoUninitialize();
        }

        if width > 0 && height > 0 {
            Some((width, height))
        } else {
            None
        }
    }
}

pub fn extract_kra_preview(path: &Path) -> Option<String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use std::io::Read;

    let file = std::fs::File::open(path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;
    let mut buffer = Vec::new();

    if let Ok(mut entry) = archive.by_name("mergedimage.png") {
        entry.read_to_end(&mut buffer).ok()?;
    } else if let Ok(mut entry) = archive.by_name("preview.png") {
        entry.read_to_end(&mut buffer).ok()?;
    } else {
        return None;
    }

    if buffer.is_empty() {
        return None;
    }

    Some(format!("data:image/png;base64,{}", STANDARD.encode(&buffer)))
}

pub fn inspect_folder(path: &Path) -> (u64, usize, Vec<String>) {
    let mut total_bytes = 0u64;
    let mut total_files = 0usize;
    let mut preview_items = Vec::new();

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if preview_items.len() < 6 {
                if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                    preview_items.push(name.to_string());
                }
            }
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    total_bytes += meta.len();
                    total_files += 1;
                } else if meta.is_dir() {
                    total_files += 1;
                }
            }
        }
    }
    (total_bytes, total_files, preview_items)
}

pub fn read_text_preview(path: &Path) -> Option<String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path).ok()?;
    let mut buffer = vec![0u8; 32 * 1024]; // Límite de 32 KB para preview instantáneo
    let bytes_read = file.read(&mut buffer).ok()?;
    String::from_utf8(buffer[..bytes_read].to_vec()).ok()
}

#[cfg(not(target_os = "windows"))]
pub fn get_video_dimensions(_path: &Path) -> Option<(u32, u32)> {
    None
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

