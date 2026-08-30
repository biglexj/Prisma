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
    Archive,
    Epub,
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
            "epub" => Self::Epub,
            "zip" | "7z" | "rar" | "tar" | "gz" | "bz2" | "xz" | "tgz" => Self::Archive,
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
pub struct ArchiveEntryInfo {
    pub name: String,
    pub uncompressed_size: u64,
    pub compressed_size: u64,
    pub is_dir: bool,
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
    pub archive_items_count: Option<usize>,
    pub archive_uncompressed_bytes: Option<u64>,
    pub archive_entries: Option<Vec<ArchiveEntryInfo>>,
    pub epub_author: Option<String>,
    pub epub_description: Option<String>,
    pub epub_cover_data_url: Option<String>,
    pub epub_chapters: Option<Vec<String>>,
    pub exif_camera: Option<String>,
    pub exif_lens: Option<String>,
    pub exif_iso: Option<String>,
    pub exif_aperture: Option<String>,
    pub exif_shutter: Option<String>,
    pub exif_focal_length: Option<String>,
    pub exif_date_taken: Option<String>,
    pub selection_index: Option<usize>,
    pub selection_total: Option<usize>,
    pub extension: String,
    pub modified_date: Option<String>,
}

impl QuickLookPayload {
    pub fn new(path_str: String, media_type: QuickLookMediaType) -> Self {
        Self::with_selection(path_str, media_type, None, None)
    }

    pub fn with_selection(
        path_str: String,
        media_type: QuickLookMediaType,
        selection_index: Option<usize>,
        selection_total: Option<usize>,
    ) -> Self {
        let clean_path_str = path_str.trim_start_matches(r"\\?\").to_string();
        let path = Path::new(&clean_path_str);
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&clean_path_str)
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

        let (archive_items_count, archive_uncompressed_bytes, archive_entries) =
            if media_type == QuickLookMediaType::Archive {
                if ext == "zip" {
                    inspect_zip_archive(path)
                } else {
                    (None, None, None)
                }
            } else {
                (None, None, None)
            };

        let (epub_author, epub_description, epub_cover_data_url, epub_chapters) =
            if media_type == QuickLookMediaType::Epub {
                inspect_epub(path)
            } else {
                (None, None, None, None)
            };

        let (exif_camera, exif_lens, exif_iso, exif_aperture, exif_shutter, exif_focal_length, exif_date_taken) =
            if media_type == QuickLookMediaType::Image {
                if let Ok(exif) = crate::infrastructure::exif::read_image_exif(path) {
                    let camera = match (exif.camera_make, exif.camera_model) {
                        (Some(make), Some(model)) => {
                            if model.to_lowercase().starts_with(&make.to_lowercase()) {
                                Some(model)
                            } else {
                                Some(format!("{make} {model}"))
                            }
                        }
                        (None, Some(model)) => Some(model),
                        (Some(make), None) => Some(make),
                        (None, None) => None,
                    };
                    (
                        camera,
                        exif.lens_model,
                        exif.iso,
                        exif.aperture,
                        exif.shutter_speed,
                        exif.focal_length,
                        exif.date_taken,
                    )
                } else {
                    (None, None, None, None, None, None, None)
                }
            } else {
                (None, None, None, None, None, None, None)
            };

        Self {
            path: clean_path_str,
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
            archive_items_count,
            archive_uncompressed_bytes,
            archive_entries,
            epub_author,
            epub_description,
            epub_cover_data_url,
            epub_chapters,
            exif_camera,
            exif_lens,
            exif_iso,
            exif_aperture,
            exif_shutter,
            exif_focal_length,
            exif_date_taken,
            selection_index,
            selection_total,
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

pub fn inspect_zip_archive(path: &Path) -> (Option<usize>, Option<u64>, Option<Vec<ArchiveEntryInfo>>) {
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (None, None, None),
    };
    let mut archive = match zip::ZipArchive::new(file) {
        Ok(a) => a,
        Err(_) => return (None, None, None),
    };

    let count = archive.len();
    let mut total_uncompressed: u64 = 0;
    let mut entries = Vec::new();

    for i in 0..count {
        if let Ok(entry) = archive.by_index(i) {
            let uncompressed = entry.size();
            let compressed = entry.compressed_size();
            total_uncompressed += uncompressed;

            if entries.len() < 35 {
                entries.push(ArchiveEntryInfo {
                    name: entry.name().to_string(),
                    uncompressed_size: uncompressed,
                    compressed_size: compressed,
                    is_dir: entry.is_dir(),
                });
            }
        }
    }

    (Some(count), Some(total_uncompressed), Some(entries))
}

pub fn inspect_epub(path: &Path) -> (Option<String>, Option<String>, Option<String>, Option<Vec<String>>) {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use std::io::Read;

    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (None, None, None, None),
    };
    let mut archive = match zip::ZipArchive::new(file) {
        Ok(a) => a,
        Err(_) => return (None, None, None, None),
    };

    // 1. Encontrar la ruta del OPF desde container.xml
    let mut opf_path = String::from("OEBPS/content.opf");
    if let Ok(mut container) = archive.by_name("META-INF/container.xml") {
        let mut xml = String::new();
        if container.read_to_string(&mut xml).is_ok() {
            if let Some(pos) = xml.find("full-path=\"") {
                let start = pos + 11;
                if let Some(end) = xml[start..].find('"') {
                    opf_path = xml[start..start + end].to_string();
                }
            }
        }
    }

    let mut opf_content = String::new();
    let mut opf_folder = String::new();
    if let Some(idx) = opf_path.rfind('/') {
        opf_folder = opf_path[..=idx].to_string();
    }

    if let Ok(mut opf_file) = archive.by_name(&opf_path) {
        let _ = opf_file.read_to_string(&mut opf_content);
    } else {
        // Fallback: buscar cualquier archivo .opf en el zip
        for i in 0..archive.len() {
            if let Ok(name) = archive.by_index(i).map(|e| e.name().to_string()) {
                if name.ends_with(".opf") {
                    if let Ok(mut opf_file) = archive.by_name(&name) {
                        let _ = opf_file.read_to_string(&mut opf_content);
                        if let Some(idx) = name.rfind('/') {
                            opf_folder = name[..=idx].to_string();
                        }
                        break;
                    }
                }
            }
        }
    }

    if opf_content.is_empty() {
        return (None, None, None, None);
    }

    // 2. Extraer metadatos del OPF
    let author = extract_xml_tag_content(&opf_content, "dc:creator");
    let description = extract_xml_tag_content(&opf_content, "dc:description");

    // 3. Extraer portada
    let mut cover_data_url = None;
    let mut cover_href = None;

    // Buscar cover en <item ... properties="cover-image" ... href="..." /> o id="cover" o id="cover-image"
    for line in opf_content.lines() {
        if line.contains("<item ") && (line.contains("cover-image") || line.contains("id=\"cover\"") || line.contains("id=\"cover-image\"")) {
            if let Some(pos) = line.find("href=\"") {
                let start = pos + 6;
                if let Some(end) = line[start..].find('"') {
                    cover_href = Some(line[start..start + end].to_string());
                    break;
                }
            }
        }
    }

    // Fallback de portada si no se encontró en el manifest: buscar imágenes en el zip que contengan "cover"
    let target_cover_entry = if let Some(href) = cover_href {
        let full = if href.starts_with('/') {
            href.trim_start_matches('/').to_string()
        } else {
            format!("{}{}", opf_folder, href)
        };
        Some(full)
    } else {
        let mut found = None;
        for i in 0..archive.len() {
            if let Ok(name) = archive.by_index(i).map(|e| e.name().to_string()) {
                let lower = name.to_ascii_lowercase();
                if (lower.ends_with(".jpg") || lower.ends_with(".jpeg") || lower.ends_with(".png") || lower.ends_with(".webp"))
                    && (lower.contains("cover") || lower.contains("portada")) {
                    found = Some(name);
                    break;
                }
            }
        }
        found
    };

    if let Some(cover_name) = target_cover_entry {
        if let Ok(mut entry) = archive.by_name(&cover_name) {
            let mut buf = Vec::new();
            if entry.read_to_end(&mut buf).is_ok() && !buf.is_empty() {
                let mime = if cover_name.ends_with(".png") {
                    "image/png"
                } else if cover_name.ends_with(".webp") {
                    "image/webp"
                } else {
                    "image/jpeg"
                };
                cover_data_url = Some(format!("data:{mime};base64,{}", STANDARD.encode(&buf)));
            }
        }
    }

    // 4. Extraer capítulos del toc.ncx / nav.xhtml o manifest
    let mut chapters = Vec::new();
    let ncx_path = format!("{}toc.ncx", opf_folder);
    if let Ok(mut ncx_file) = archive.by_name(&ncx_path) {
        let mut ncx_content = String::new();
        if ncx_file.read_to_string(&mut ncx_content).is_ok() {
            for part in ncx_content.split("<text>") {
                if let Some(end) = part.find("</text>") {
                    let title = part[..end].trim().to_string();
                    if !title.is_empty() && !chapters.contains(&title) {
                        chapters.push(title);
                        if chapters.len() >= 20 {
                            break;
                        }
                    }
                }
            }
        }
    }

    let chapters_opt = if chapters.is_empty() { None } else { Some(chapters) };

    (author, description, cover_data_url, chapters_opt)
}

fn extract_xml_tag_content(xml: &str, tag: &str) -> Option<String> {
    let open_tag = format!("<{tag}");
    let close_tag = format!("</{tag}>");
    if let Some(start_idx) = xml.find(&open_tag) {
        let rest = &xml[start_idx..];
        if let Some(tag_end) = rest.find('>') {
            let content_start = tag_end + 1;
            if let Some(content_end) = rest.find(&close_tag) {
                if content_end > content_start {
                    let raw = rest[content_start..content_end].trim();
                    let clean = if raw.starts_with("<![CDATA[") && raw.ends_with("]]>") {
                        &raw[9..raw.len() - 3]
                    } else {
                        raw
                    };
                    return Some(clean.to_string());
                }
            }
        }
    }
    None
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
        assert_eq!(QuickLookMediaType::from_extension("mp3"), QuickLookMediaType::Audio);
        assert_eq!(QuickLookMediaType::from_extension("FLAC"), QuickLookMediaType::Audio);
        assert_eq!(QuickLookMediaType::from_extension("wav"), QuickLookMediaType::Audio);
        assert_eq!(QuickLookMediaType::from_extension("mp4"), QuickLookMediaType::Video);
        assert_eq!(QuickLookMediaType::from_extension("MKV"), QuickLookMediaType::Video);
        assert_eq!(QuickLookMediaType::from_extension("jpg"), QuickLookMediaType::Image);
        assert_eq!(QuickLookMediaType::from_extension("PNG"), QuickLookMediaType::Image);
        assert_eq!(QuickLookMediaType::from_extension("pdf"), QuickLookMediaType::Pdf);
        assert_eq!(QuickLookMediaType::from_extension("epub"), QuickLookMediaType::Epub);
        assert_eq!(QuickLookMediaType::from_extension("zip"), QuickLookMediaType::Archive);
        assert_eq!(QuickLookMediaType::from_extension("7z"), QuickLookMediaType::Archive);
        assert_eq!(QuickLookMediaType::from_extension("rar"), QuickLookMediaType::Archive);
        assert_eq!(QuickLookMediaType::from_extension("docx"), QuickLookMediaType::Generic);
        assert_eq!(QuickLookMediaType::from_extension("exe"), QuickLookMediaType::Generic);
    }

    #[test]
    fn test_format_file_size() {
        assert_eq!(format_file_size(500), "500 B");
        assert_eq!(format_file_size(2048), "2 KB");
        assert_eq!(format_file_size(15 * 1024 * 1024), "15.0 MB");
        assert_eq!(format_file_size(2 * 1024 * 1024 * 1024), "2.00 GB");
    }
}

