use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mkv", "avi", "webm", "mov", "wmv", "flv", "m4v", "ts", "3gp"];
const PLAYLIST_EXTENSIONS: &[&str] = &["m3u", "m3u8", "pls", "xspf"];

/// Un ítem dentro de una playlist (M3U, M3U8, PLS, XSPF).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistItem {
    /// Ruta absoluta al archivo multimedia.
    pub path: String,
    /// Título extraído de los metadatos de la lista (artista - título) o nombre de archivo.
    pub title: String,
    /// Duración en segundos (0 si desconocida).
    pub duration_secs: i64,
    /// Indica si el archivo existe actualmente en el disco.
    pub is_available: bool,
    /// Indica si el ítem es un vídeo.
    pub is_video: bool,
}

/// Metadatos de una playlist detectada en las fuentes del sistema.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistMeta {
    /// Nombre de la playlist (nombre del archivo sin extensión).
    pub name: String,
    /// Ruta absoluta al archivo de la lista.
    pub path: String,
    /// Cantidad total de entradas en la lista.
    pub item_count: usize,
    /// Cantidad de archivos válidos existentes en disco.
    pub valid_count: usize,
    /// Cantidad de vídeos detectados en la lista.
    pub video_count: usize,
    /// Cantidad de canciones/audios detectados en la lista.
    pub audio_count: usize,
    /// Tipo de medio: "video", "music" o "mixed".
    pub media_kind: String,
    /// Timestamp Unix de la última modificación del archivo.
    pub modified_at: u64,
    /// Si el usuario ha marcado la playlist como oculta en Prisma.
    pub is_hidden: bool,
}

/// Parsea un archivo de lista de reproducción soportando automáticamente
/// los formatos de VLC y Windows: M3U, M3U8, XSPF (XML de VLC) y PLS.
pub fn parse_playlist(playlist_path: &Path) -> Result<Vec<PlaylistItem>, String> {
    let raw_bytes = std::fs::read(playlist_path)
        .map_err(|e| format!("No se pudo leer la playlist '{}': {e}", playlist_path.display()))?;

    let content = decode_text_auto(&raw_bytes);

    let base_dir = playlist_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf();

    let ext = playlist_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    // 1. Formato XSPF de VLC (XML)
    if ext == "xspf" || content.trim_start().starts_with("<?xml") || content.contains("<playlist") {
        return Ok(parse_xspf(&content, &base_dir));
    }

    // 2. Formato PLS (INI)
    if ext == "pls" || content.trim_start().starts_with("[playlist]") {
        return Ok(parse_pls(&content, &base_dir));
    }

    // 3. Formato estándar M3U / M3U8
    Ok(parse_m3u_text(&content, &base_dir))
}

/// Alias para compatibilidad con código existente
pub fn parse_m3u(playlist_path: &Path) -> Result<Vec<PlaylistItem>, String> {
    parse_playlist(playlist_path)
}

/// Parsea el contenido en texto de un M3U/M3U8.
fn parse_m3u_text(content: &str, base_dir: &PathBuf) -> Vec<PlaylistItem> {
    let mut items = Vec::new();
    let mut pending_title = String::new();
    let mut pending_duration: i64 = 0;

    for line in content.lines() {
        let line = line.trim();

        if line.is_empty() || line == "#EXTM3U" {
            continue;
        }

        if let Some(info) = line.strip_prefix("#EXTINF:") {
            if let Some((dur_str, title)) = info.split_once(',') {
                pending_duration = dur_str.trim().parse::<i64>().unwrap_or(0);
                pending_title = title.trim().to_owned();
            }
            continue;
        }

        if line.starts_with('#') {
            continue;
        }

        let decoded = url_decode(line);
        let resolved = resolve_path(&decoded, base_dir);
        let is_available = resolved.is_file();

        let ext = resolved
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        let is_video = VIDEO_EXTENSIONS.contains(&ext.as_str());

        let title = if pending_title.is_empty() {
            resolved
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| decoded.clone())
        } else {
            pending_title.clone()
        };

        items.push(PlaylistItem {
            path: resolved.to_string_lossy().into_owned(),
            title,
            duration_secs: pending_duration,
            is_available,
            is_video,
        });

        pending_title.clear();
        pending_duration = 0;
    }

    items
}

/// Parsea el formato XML XSPF (estándar nativo de exportación de VLC).
fn parse_xspf(content: &str, base_dir: &PathBuf) -> Vec<PlaylistItem> {
    let mut items = Vec::new();
    let mut rest = content;

    while let Some(start) = rest.find("<track>") {
        let after_start = &rest[start + 7..];
        let Some(end) = after_start.find("</track>") else { break };
        let track_block = &after_start[..end];
        rest = &after_start[end + 8..];

        let Some(raw_loc) = extract_tag_value(track_block, "location") else { continue };
        let unescaped_loc = unescape_xml(raw_loc.trim());
        let decoded_loc = url_decode(&unescaped_loc);
        let resolved = resolve_path(&decoded_loc, base_dir);
        let is_available = resolved.is_file();

        let ext = resolved
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        let is_video = VIDEO_EXTENSIONS.contains(&ext.as_str());

        let title_opt = extract_tag_value(track_block, "title").map(|t| unescape_xml(t.trim()));
        let creator_opt = extract_tag_value(track_block, "creator").map(|c| unescape_xml(c.trim()));
        let duration_ms = extract_tag_value(track_block, "duration")
            .and_then(|d| d.trim().parse::<i64>().ok())
            .unwrap_or(0);
        let duration_secs = duration_ms / 1000;

        let title = match (title_opt, creator_opt) {
            (Some(t), Some(c)) if !t.is_empty() && !c.is_empty() && !t.contains(&c) => format!("{c} - {t}"),
            (Some(t), _) if !t.is_empty() => t,
            _ => resolved
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| decoded_loc.clone()),
        };

        items.push(PlaylistItem {
            path: resolved.to_string_lossy().into_owned(),
            title,
            duration_secs,
            is_available,
            is_video,
        });
    }

    items
}

/// Parsea el formato PLS (formato INI de Shoutcast y VLC).
fn parse_pls(content: &str, base_dir: &PathBuf) -> Vec<PlaylistItem> {
    let mut files = HashMap::new();
    let mut titles = HashMap::new();
    let mut lengths = HashMap::new();

    for line in content.lines() {
        let line = line.trim();
        if let Some((k, v)) = line.split_once('=') {
            let k = k.trim().to_lowercase();
            let v = v.trim();
            if let Some(num_str) = k.strip_prefix("file") {
                if let Ok(num) = num_str.parse::<usize>() {
                    files.insert(num, v.to_owned());
                }
            } else if let Some(num_str) = k.strip_prefix("title") {
                if let Ok(num) = num_str.parse::<usize>() {
                    titles.insert(num, v.to_owned());
                }
            } else if let Some(num_str) = k.strip_prefix("length") {
                if let Ok(num) = num_str.parse::<usize>() {
                    lengths.insert(num, v.parse::<i64>().unwrap_or(0));
                }
            }
        }
    }

    let mut keys: Vec<usize> = files.keys().cloned().collect();
    keys.sort_unstable();

    let mut items = Vec::new();
    for k in keys {
        if let Some(raw_path) = files.get(&k) {
            let decoded = url_decode(raw_path);
            let resolved = resolve_path(&decoded, base_dir);
            let is_available = resolved.is_file();
            let ext = resolved
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            let is_video = VIDEO_EXTENSIONS.contains(&ext.as_str());

            let title = titles.get(&k).cloned().unwrap_or_else(|| {
                resolved
                    .file_stem()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_else(|| decoded.clone())
            });
            let duration_secs = lengths.get(&k).cloned().unwrap_or(0);

            items.push(PlaylistItem {
                path: resolved.to_string_lossy().into_owned(),
                title,
                duration_secs,
                is_available,
                is_video,
            });
        }
    }
    items
}

/// Extrae el texto interno de una etiqueta XML simple.
fn extract_tag_value<'a>(block: &'a str, tag: &str) -> Option<&'a str> {
    let open_tag = format!("<{tag}>");
    let close_tag = format!("</{tag}>");
    if let Some(start) = block.find(&open_tag) {
        let content_start = start + open_tag.len();
        if let Some(end) = block[content_start..].find(&close_tag) {
            return Some(&block[content_start..content_start + end]);
        }
    }
    // Soportar etiquetas con atributos (ej. <location ...>)
    let open_prefix = format!("<{tag}");
    if let Some(start) = block.find(&open_prefix) {
        if let Some(tag_end) = block[start..].find('>') {
            let content_start = start + tag_end + 1;
            if let Some(end) = block[content_start..].find(&close_tag) {
                return Some(&block[content_start..content_start + end]);
            }
        }
    }
    None
}

/// Desescapa entidades XML comunes.
fn unescape_xml(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

/// Crea un archivo .m3u extendido con los ítems dados codificado en UTF-8 estándar.
pub fn write_m3u(m3u_path: &Path, name: &str, items: &[PlaylistItem]) -> Result<(), String> {
    let base_dir = m3u_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf();

    let mut lines = vec!["#EXTM3U".to_owned()];

    for item in items {
        let item_path = Path::new(&item.path);
        let rel = make_relative(item_path, &base_dir);
        lines.push(format!("#EXTINF:{},{}", item.duration_secs, item.title));
        lines.push(rel);
    }

    lines.push(format!("# Creado por Prisma — {name}"));

    std::fs::write(m3u_path, lines.join("\n") + "\n")
        .map_err(|e| format!("No se pudo escribir la playlist: {e}"))
}

/// Elimina un archivo de playlist de disco.
pub fn delete_m3u(m3u_path: &Path) -> Result<(), String> {
    if !m3u_path.exists() {
        return Ok(());
    }
    std::fs::remove_file(m3u_path)
        .map_err(|e| format!("No se pudo eliminar la lista de reproducción: {e}"))
}

/// Limpia las pistas no encontradas (que no existen en disco) de un archivo de lista.
pub fn clean_missing_from_m3u(m3u_path: &Path) -> Result<Vec<PlaylistItem>, String> {
    let items = parse_playlist(m3u_path)?;
    let valid_items: Vec<PlaylistItem> = items.into_iter().filter(|it| it.is_available).collect();
    let name = m3u_path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Lista".to_owned());
    write_m3u(m3u_path, &name, &valid_items)?;
    Ok(valid_items)
}

/// Escanea recursivamente un directorio en busca de archivos .m3u / .m3u8 / .pls / .xspf.
pub fn scan_playlists_recursive(folder: &Path, max_depth: usize) -> Vec<PlaylistMeta> {
    let mut result = Vec::new();
    scan_playlists_internal(folder, 0, max_depth, &mut result);
    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    result
}

fn quick_scan_playlist_meta(path: &Path) -> (usize, usize, usize, usize, String) {
    let Ok(raw_bytes) = std::fs::read(path) else {
        return (0, 0, 0, 0, "music".to_owned());
    };
    let content = decode_text_auto(&raw_bytes);
    let mut count: usize = 0;
    let mut video_count: usize = 0;

    let is_xspf = content.contains("<track>");
    if is_xspf {
        for block in content.split("</track>") {
            if block.contains("<location>") {
                count += 1;
                let lower = block.to_lowercase();
                if VIDEO_EXTENSIONS.iter().any(|ext| lower.contains(&format!(".{ext}"))) {
                    video_count += 1;
                }
            }
        }
    } else {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            count += 1;
            let lower = line.to_lowercase();
            if VIDEO_EXTENSIONS.iter().any(|ext| {
                lower.ends_with(ext) || lower.contains(&format!(".{ext}?")) || lower.contains(&format!(".{ext}#"))
            }) {
                video_count += 1;
            }
        }
    }

    let audios = count.saturating_sub(video_count);
    let kind = if video_count > 0 && audios == 0 {
        "video"
    } else if audios > 0 && video_count == 0 {
        "music"
    } else if video_count > 0 && audios > 0 {
        if video_count >= audios {
            "video"
        } else {
            "music"
        }
    } else {
        let lower = path.to_string_lossy().to_lowercase();
        if lower.contains("vídeos") || lower.contains("videos") {
            "video"
        } else {
            "music"
        }
    };

    (count, count, video_count, audios, kind.to_owned())
}

fn scan_playlists_internal(folder: &Path, current_depth: usize, max_depth: usize, out: &mut Vec<PlaylistMeta>) {
    if current_depth > max_depth {
        return;
    }

    let Ok(entries) = std::fs::read_dir(folder) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_dir() {
            scan_playlists_internal(&path, current_depth + 1, max_depth, out);
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());

        let Some(ext_str) = ext else { continue };

        if !PLAYLIST_EXTENSIONS.contains(&ext_str.as_str()) {
            continue;
        }

        let name = path
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| "Sin nombre".to_owned());

        let modified_at = std::fs::metadata(&path)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // Conteo y detección ligera en memoria sin I/O bloqueante por archivo
        let (item_count, valid_count, video_count, audio_count, media_kind) = quick_scan_playlist_meta(&path);

        out.push(PlaylistMeta {
            name,
            path: path.to_string_lossy().into_owned(),
            item_count,
            valid_count,
            video_count,
            audio_count,
            media_kind,
            modified_at,
            is_hidden: false,
        });
    }
}

// ── Gestión de Playlists Ocultas ───────────────────────────────

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct HiddenPlaylistsStore {
    pub hidden_paths: HashSet<String>,
}

impl HiddenPlaylistsStore {
    pub fn load_from_dir(app_data_dir: &Path) -> Self {
        let store_path = app_data_dir.join("hidden_playlists.json");
        if let Ok(bytes) = std::fs::read(&store_path) {
            if let Ok(paths) = serde_json::from_slice::<HashSet<String>>(&bytes) {
                return Self { hidden_paths: paths };
            }
        }
        Self::default()
    }

    pub fn save_to_dir(&self, app_data_dir: &Path) -> Result<(), String> {
        let store_path = app_data_dir.join("hidden_playlists.json");
        let json = serde_json::to_string_pretty(&self.hidden_paths)
            .map_err(|e| format!("Error serializando listas ocultas: {e}"))?;
        std::fs::write(&store_path, json)
            .map_err(|e| format!("Error guardando listas ocultas: {e}"))
    }

    pub fn is_hidden(&self, path: &str) -> bool {
        let norm = path.replace('\\', "/").to_lowercase();
        self.hidden_paths.contains(&norm)
    }

    pub fn toggle(&mut self, path: &str) -> bool {
        let norm = path.replace('\\', "/").to_lowercase();
        if self.hidden_paths.contains(&norm) {
            self.hidden_paths.remove(&norm);
            false
        } else {
            self.hidden_paths.insert(norm);
            true
        }
    }
}

// ── Utilidades privadas ────────────────────────────────────────

/// Decodifica texto reconociendo automáticamente UTF-8 válido o decodificando
/// Windows-1252 / ISO-8859-1 (español con tildes, eñes, diéresis, símbolos) si no es UTF-8.
pub fn decode_text_auto(bytes: &[u8]) -> String {
    if let Ok(valid_str) = std::str::from_utf8(bytes) {
        return valid_str.to_owned();
    }

    bytes
        .iter()
        .map(|&b| match b {
            0x80 => '€',
            0x82 => '‚',
            0x83 => 'ƒ',
            0x84 => '„',
            0x85 => '…',
            0x86 => '†',
            0x87 => '‡',
            0x88 => 'ˆ',
            0x89 => '‰',
            0x8A => 'Š',
            0x8B => '‹',
            0x8C => 'Œ',
            0x8E => 'Ž',
            0x91 => '‘',
            0x92 => '’',
            0x93 => '“',
            0x94 => '”',
            0x95 => '•',
            0x96 => '–',
            0x97 => '—',
            0x98 => '˜',
            0x99 => '™',
            0x9A => 'š',
            0x9B => '›',
            0x9C => 'œ',
            0x9E => 'ž',
            0x9F => 'Ÿ',
            other => other as char,
        })
        .collect()
}

/// Decodifica secuencias %XX en bytes e interpreta con auto-detección UTF-8 / Windows-1252.
fn url_decode(s: &str) -> String {
    let mut bytes = Vec::with_capacity(s.len());
    let src = s.as_bytes();
    let mut i = 0;
    while i < src.len() {
        if src[i] == b'%' && i + 2 < src.len() {
            if let Ok(hex) = std::str::from_utf8(&src[i + 1..i + 3]) {
                if let Ok(byte) = u8::from_str_radix(hex, 16) {
                    bytes.push(byte);
                    i += 3;
                    continue;
                }
            }
        }
        bytes.push(src[i]);
        i += 1;
    }
    decode_text_auto(&bytes)
}

fn resolve_path(raw: &str, base_dir: &PathBuf) -> PathBuf {
    let cleaned = if let Some(stripped) = raw.strip_prefix("file:///") {
        stripped
    } else if let Some(stripped) = raw.strip_prefix("file://") {
        stripped
    } else {
        raw
    };

    let p = Path::new(cleaned);
    if p.is_absolute() {
        return p.to_path_buf();
    }

    let direct = base_dir.join(p);
    if direct.is_file() {
        return direct;
    }

    // Probar si es relativa a carpetas padre de la biblioteca (hasta 4 niveles superiores)
    for ancestor in base_dir.ancestors().skip(1).take(4) {
        let candidate = ancestor.join(p);
        if candidate.is_file() {
            return candidate;
        }
    }

    direct
}

fn make_relative(target: &Path, base: &PathBuf) -> String {
    if let Ok(rel) = target.strip_prefix(base) {
        return rel.to_string_lossy().replace('\\', "/");
    }
    target.to_string_lossy().into_owned()
}
