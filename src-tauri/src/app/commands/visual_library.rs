use std::{collections::HashSet, path::Path};

use tauri::State;

use crate::{
    app::state::VisualLibraryState,
    features::{
        folder_session::classify_path,
        visual_library::{
            VisualFolderScan, VisualFolderSource, VisualLibraryItem, VisualMediaKind,
            scan_visual_folder,
        },
    },
    infrastructure::media_preview::{load_image_data_url, load_video_thumbnail_data_url},
};

#[tauri::command]
pub fn visual_library_list_folders(
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<Vec<VisualFolderSource>, String> {
    state.list(kind)
}

#[tauri::command]
pub fn visual_library_list_excluded_folders(
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<Vec<VisualFolderSource>, String> {
    state.list_excluded(kind)
}

#[tauri::command]
pub async fn visual_library_add_folder(
    path: String,
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<VisualFolderSource, String> {
    let owned_state = state.inner().clone();
    let excluded_paths = owned_state.excluded_paths(kind)?;
    let scan = scan_in_background(path, kind, excluded_paths).await?;
    owned_state.upsert(scan.source)
}

#[tauri::command]
pub async fn visual_library_add_excluded_folder(
    path: String,
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<VisualFolderSource, String> {
    let owned_state = state.inner().clone();
    let scan = scan_in_background(path, kind, vec![]).await?;
    owned_state.upsert_excluded(scan.source)
}

#[tauri::command]
pub async fn visual_library_rescan_folder(
    path: String,
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<VisualFolderSource, String> {
    let owned_state = state.inner().clone();
    let excluded_paths = owned_state.excluded_paths(kind)?;
    let scan = scan_in_background(path, kind, excluded_paths).await?;
    owned_state.upsert(scan.source)
}

#[tauri::command]
pub fn visual_library_remove_folder(
    path: String,
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<Vec<VisualFolderSource>, String> {
    state.remove(&path, kind)
}

#[tauri::command]
pub fn visual_library_remove_excluded_folder(
    path: String,
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<Vec<VisualFolderSource>, String> {
    state.remove_excluded(&path, kind)
}

#[tauri::command]
pub async fn visual_library_list_items(
    kind: VisualMediaKind,
    state: State<'_, VisualLibraryState>,
) -> Result<Vec<VisualLibraryItem>, String> {
    let paths = state.paths(kind)?;
    let excluded_paths = state.excluded_paths(kind)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut seen = HashSet::new();
        let mut items = Vec::new();
        for path in paths {
            if let Ok(scan) = scan_visual_folder(Path::new(&path), kind, &excluded_paths) {
                for item in scan.items {
                    if seen.insert(item.path.clone()) {
                        items.push(item);
                    }
                }
            }
        }
        items.sort_by(|left, right| right.modified_at_millis.cmp(&left.modified_at_millis));
        items
    })
    .await
    .map_err(|error| format!("No se pudo completar el escaneo visual: {error}"))
}

#[tauri::command]
pub async fn visual_library_image_preview(path: String) -> Result<Option<String>, String> {
    let _permit = crate::infrastructure::media_preview::VISUAL_PREVIEW_SEMAPHORE
        .acquire()
        .await
        .map_err(|error| format!("Error en semáforo de previsualizaciones: {error}"))?;

    tauri::async_runtime::spawn_blocking(move || {
        let canonical_path = Path::new(&path)
            .canonicalize()
            .map_err(|error| format!("No se pudo abrir el elemento visual: {error}"))?;
        if !canonical_path.is_file() {
            return Err("La ruta indicada no corresponde a un archivo compatible.".to_owned());
        }
        let family = classify_path(&canonical_path);
        if family == Some(VisualMediaKind::Image.family()) {
            Ok(load_image_data_url(&canonical_path))
        } else if family == Some(VisualMediaKind::Video.family()) {
            Ok(load_video_thumbnail_data_url(&canonical_path))
        } else {
            Err("La ruta indicada no corresponde a una imagen o vídeo compatible.".to_owned())
        }
    })
    .await
    .map_err(|error| format!("No se pudo preparar la vista previa: {error}"))?
}

async fn scan_in_background(
    path: String,
    kind: VisualMediaKind,
    excluded_paths: Vec<String>,
) -> Result<VisualFolderScan, String> {
    tauri::async_runtime::spawn_blocking(move || scan_visual_folder(Path::new(&path), kind, &excluded_paths))
        .await
        .map_err(|error| format!("No se pudo completar el escaneo visual: {error}"))?
}

#[tauri::command]
pub async fn show_in_file_manager(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean_path = path.trim_start_matches(r"\\?\").trim_start_matches(r"\\?\UNC\").to_string();
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            let win_path = clean_path.replace('/', "\\");
            let target = Path::new(&win_path);
            if target.is_file() {
                let _ = Command::new("explorer")
                    .arg(format!("/select,{}", win_path))
                    .spawn();
            } else if target.is_dir() {
                let _ = Command::new("explorer")
                    .arg(&win_path)
                    .spawn();
            } else if let Some(parent) = target.parent() {
                let parent_str = parent.to_string_lossy().to_string();
                let _ = Command::new("explorer")
                    .arg(&parent_str)
                    .spawn();
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            let target = Path::new(&clean_path);
            let _ = target;
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Error al abrir explorador de archivos: {e}"))?
}

#[tauri::command]
pub async fn open_in_file_manager(path: String) -> Result<(), String> {
    show_in_file_manager(path).await
}

#[tauri::command]
pub async fn open_path_with_default_app(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean_path = path.trim_start_matches(r"\\?\").trim_start_matches(r"\\?\UNC\").to_string();
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            let win_path = clean_path.replace('/', "\\");
            Command::new("cmd")
                .args(["/C", "start", "", &win_path])
                .spawn()
                .map_err(|e| format!("Error al abrir archivo con la aplicación predeterminada: {e}"))?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = clean_path;
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Error en runtime al abrir archivo: {e}"))?
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean_url = url.trim().to_string();
        if !clean_url.starts_with("http://") && !clean_url.starts_with("https://") && !clean_url.starts_with("mailto:") {
            return Err("URL no válida o protocolo no permitido".to_string());
        }

        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            Command::new("rundll32")
                .args(["url.dll,FileProtocolHandler", &clean_url])
                .spawn()
                .map_err(|e| format!("Error al abrir URL externa: {e}"))?;
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = &clean_url;
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Error en runtime al abrir URL: {e}"))?
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SubtitleTrackMeta {
    pub label: String,
    pub path: String,
    pub format: String,
    pub language: Option<String>,
}

/// Busca archivos de subtítulos externos (.srt, .vtt, .ass, .ssa) en la misma carpeta del vídeo.
#[tauri::command]
pub async fn video_get_subtitles(video_path: String) -> Result<Vec<SubtitleTrackMeta>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean = video_path.trim_start_matches(r"\\?\");
        let video_p = Path::new(clean);
        let parent = match video_p.parent() {
            Some(p) => p,
            None => return Ok(Vec::new()),
        };

        let stem = match video_p.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_lowercase(),
            None => return Ok(Vec::new()),
        };

        let mut tracks = Vec::new();
        let sub_exts = ["srt", "vtt", "ass", "ssa", "sub"];

        if let Ok(entries) = std::fs::read_dir(parent) {
            for entry in entries.flatten() {
                let p = entry.path();
                if !p.is_file() {
                    continue;
                }
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if sub_exts.contains(&ext_lower.as_str()) {
                        if let Some(file_name) = p.file_name().and_then(|f| f.to_str()) {
                            let name_lower = file_name.to_lowercase();
                            if name_lower.starts_with(&stem) {
                                let label = p
                                    .file_stem()
                                    .and_then(|s| s.to_str())
                                    .unwrap_or("Subtítulo")
                                    .to_string();

                                let lang = if name_lower.contains(".es.")
                                    || name_lower.contains("spanish")
                                    || name_lower.contains("español")
                                {
                                    Some("Español".to_string())
                                } else if name_lower.contains(".en.")
                                    || name_lower.contains("english")
                                    || name_lower.contains("inglés")
                                {
                                    Some("Inglés".to_string())
                                } else {
                                    None
                                };

                                tracks.push(SubtitleTrackMeta {
                                    label: lang.clone().unwrap_or(label),
                                    path: p.to_string_lossy().into_owned(),
                                    format: ext_lower,
                                    language: lang,
                                });
                            }
                        }
                    }
                }
            }
        }

        Ok(tracks)
    })
    .await
    .map_err(|e| format!("Error en tarea de subtítulos: {e}"))?
}

/// Lee un archivo SRT/VTT externo y lo devuelve como contenido WebVTT compatible con <track>.
#[tauri::command]
pub async fn video_read_subtitle_vtt(subtitle_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean = subtitle_path.trim_start_matches(r"\\?\");
        let bytes = std::fs::read(clean)
            .map_err(|e| format!("No se pudo leer el archivo de subtítulos: {e}"))?;

        let text = String::from_utf8_lossy(&bytes);

        if text.trim_start().starts_with("WEBVTT") {
            return Ok(text.into_owned());
        }

        let mut vtt = String::from("WEBVTT\n\n");
        for line in text.lines() {
            if line.contains("-->") {
                let converted = line.replace(',', ".");
                vtt.push_str(&converted);
            } else {
                vtt.push_str(line);
            }
            vtt.push('\n');
        }

        Ok(vtt)
    })
    .await
    .map_err(|e| format!("Error al leer subtítulos: {e}"))?
}

/// Metadatos de una pista de audio detectada por ffprobe.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AudioTrackMeta {
    pub index: usize,
    pub label: String,
    pub language: Option<String>,
    pub codec: Option<String>,
    pub channels: Option<u32>,
}

/// Lee las pistas de audio del archivo de vídeo usando ffprobe.
/// Devuelve la lista de pistas encontradas, o un error descriptivo si ffprobe no está disponible.
#[tauri::command]
pub async fn video_get_audio_tracks(path: String) -> Result<Vec<AudioTrackMeta>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean = path.trim_start_matches(r"\\?\");

        // Intentar localizar ffprobe en PATH o en ubicaciones conocidas de Windows
        let mut ffprobe_candidates = vec![
            "ffprobe".to_string(),
            r"C:\Users\biglexj\AppData\Local\Microsoft\WinGet\Links\ffprobe.exe".to_string(),
            r"C:\Program Files\Krita (x64)\bin\ffprobe.exe".to_string(),
        ];

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                ffprobe_candidates.push(parent.join("ffprobe.exe").to_string_lossy().into_owned());
            }
        }

        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            ffprobe_candidates.push(format!(r"{}\Microsoft\WinGet\Links\ffprobe.exe", local_appdata));
        }

        let mut output = None;
        for candidate in &ffprobe_candidates {
            if candidate.is_empty() {
                continue;
            }

            let mut cmd = std::process::Command::new(candidate);
            cmd.args([
                "-v", "quiet",
                "-print_format", "json",
                "-show_streams",
                "-select_streams", "a",
                clean,
            ]);

            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }

            if let Ok(out) = cmd.output() {
                if out.status.success() {
                    output = Some(out.stdout);
                    break;
                }
            }
        }

        let raw = output.ok_or_else(|| {
            "ffprobe no encontrado. Instala ffmpeg para detectar pistas de audio.".to_string()
        })?;

        let json: serde_json::Value = serde_json::from_slice(&raw)
            .map_err(|e| format!("Error al parsear salida de ffprobe: {e}"))?;

        let streams = json["streams"]
            .as_array()
            .ok_or_else(|| "ffprobe no devolvió streams".to_string())?;

        let mut tracks: Vec<AudioTrackMeta> = Vec::new();
        for (i, stream) in streams.iter().enumerate() {
            let lang = stream["tags"]["language"]
                .as_str()
                .or_else(|| stream["tags"]["LANGUAGE"].as_str())
                .map(|s| s.to_string());

            let title = stream["tags"]["title"]
                .as_str()
                .or_else(|| stream["tags"]["TITLE"].as_str())
                .map(|s| s.to_string());

            let codec = stream["codec_name"].as_str().map(|s| s.to_uppercase());

            let channels = stream["channels"].as_u64().map(|c| c as u32);

            // Construir etiqueta legible
            let label = if let Some(t) = &title {
                t.clone()
            } else {
                let mut parts = vec![format!("Pista {}", i + 1)];
                if let Some(ref l) = lang {
                    if l != "und" {
                        parts.push(l.to_uppercase());
                    }
                }
                if let Some(ref c) = codec {
                    parts.push(c.clone());
                }
                if let Some(ch) = channels {
                    let ch_label = match ch {
                        1 => "Mono".to_string(),
                        2 => "Estéreo".to_string(),
                        6 => "5.1".to_string(),
                        8 => "7.1".to_string(),
                        n => format!("{n} ch"),
                    };
                    parts.push(ch_label);
                }
                parts.join(" · ")
            };

            tracks.push(AudioTrackMeta {
                index: i,
                label,
                language: lang,
                codec,
                channels,
            });
        }

        Ok(tracks)
    })
    .await
    .map_err(|e| format!("Error al consultar pistas de audio: {e}"))?
}

/// Extrae una pista de audio específica del vídeo a un archivo temporal rápido (.m4a / .mp3) para reproducirla en sincronía.
#[tauri::command]
pub async fn video_extract_audio_track(path: String, track_index: usize) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean = path.trim_start_matches(r"\\?\");

        let mut ffprobe_candidates = vec![
            "ffmpeg".to_string(),
            r"C:\Users\biglexj\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe".to_string(),
            r"C:\Program Files\Krita (x64)\bin\ffmpeg.exe".to_string(),
        ];

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                ffprobe_candidates.push(parent.join("ffmpeg.exe").to_string_lossy().into_owned());
            }
        }

        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            ffprobe_candidates.push(format!(r"{}\Microsoft\WinGet\Links\ffmpeg.exe", local_appdata));
        }

        let temp_dir = std::env::temp_dir().join("prisma_audio_tracks");
        let _ = std::fs::create_dir_all(&temp_dir);

        use std::hash::{DefaultHasher, Hasher};
        let mut hasher = DefaultHasher::new();
        hasher.write(clean.as_bytes());
        hasher.write_usize(track_index);
        let hash = hasher.finish();

        let out_file = temp_dir.join(format!("track_{}_{}.m4a", hash, track_index));

        // Si ya existe y no está vacío, reutilizarlo inmediatamente
        if out_file.exists() && out_file.metadata().map(|m| m.len() > 0).unwrap_or(false) {
            return Ok(out_file.to_string_lossy().into_owned());
        }

        let mut success = false;
        for candidate in &ffprobe_candidates {
            if candidate.is_empty() {
                continue;
            }

            // Intento: Copia directa o extracción a AAC rápido
            let mut cmd = std::process::Command::new(candidate);
            cmd.args([
                "-y",
                "-i", clean,
                "-map", &format!("0:a:{}", track_index),
                "-c:a", "aac",
                "-b:a", "192k",
                &out_file.to_string_lossy(),
            ]);

            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }

            if let Ok(status) = cmd.status() {
                if status.success() && out_file.exists() {
                    success = true;
                    break;
                }
            }
        }

        if success {
            Ok(out_file.to_string_lossy().into_owned())
        } else {
            Err("No se pudo extraer la pista de audio con ffmpeg".to_string())
        }
    })
    .await
    .map_err(|e| format!("Error al extraer pista de audio: {e}"))?
}

