use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::Hasher,
    path::Path,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

use crate::infrastructure::converter::{find_ffmpeg_binary, find_ffprobe_binary};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoPlaybackSource {
    /// Ruta absoluta al archivo reproducible (el original si es web-nativo, o proxy MP4 generado).
    pub playback_path: String,
    /// Indica si se está reproduciendo mediante un proxy transcodificado.
    pub is_proxy: bool,
    /// Identificador del códec original (ej. "cfhd", "h264", "prores").
    pub original_codec: String,
    /// Nombre amigable para mostrar en la interfaz (ej. "GoPro CineForm", "H.264 / AVC").
    pub codec_display: String,
    /// Ancho en píxeles.
    pub width: u32,
    /// Alto en píxeles.
    pub height: u32,
    /// Duración total en segundos.
    pub duration_secs: f64,
}

/// Mapea el identificador de códec a un nombre canónico y legible.
pub fn format_codec_display(codec: &str) -> String {
    match codec.to_ascii_lowercase().as_str() {
        "cfhd" => "GoPro CineForm (HD/4K)".to_string(),
        "prores" | "apch" | "apcn" | "apcs" | "apco" | "ap4h" => "Apple ProRes".to_string(),
        "qtrle" => "QuickTime Animation (RLE)".to_string(),
        "dnxhd" | "dnxhr" => "Avid DNxHD / DNxHR".to_string(),
        "h264" => "H.264 / AVC".to_string(),
        "hevc" => "HEVC / H.265".to_string(),
        "vp8" => "VP8".to_string(),
        "vp9" => "VP9".to_string(),
        "av1" => "AV1".to_string(),
        "mpeg2video" => "MPEG-2 Video".to_string(),
        "mpeg1video" => "MPEG-1 Video".to_string(),
        "wmv1" | "wmv2" | "wmv3" | "vc1" => "Windows Media Video".to_string(),
        "flv1" | "vp6" | "vp6f" => "Flash Video".to_string(),
        "mjpeg" => "Motion JPEG".to_string(),
        "rawvideo" => "Raw Video".to_string(),
        other if other.is_empty() => "Desconocido".to_string(),
        other => other.to_uppercase(),
    }
}

/// Evalúa si el flujo de vídeo es reproducible de forma 100% directa en Chromium / WebView2.
pub fn is_codec_directly_playable(codec: &str, pix_fmt: &str, extension: &str) -> bool {
    let ext = extension.to_ascii_lowercase();
    // Contenedores no estándar para HTML5 que requieren transcodificación
    let container_ok = matches!(ext.as_str(), "mp4" | "webm" | "m4v" | "mov");
    if !container_ok {
        return false;
    }

    match codec.to_ascii_lowercase().as_str() {
        "h264" => {
            // Perfiles 8-bit estándar yuv420p / yuvj420p funcionan directamente.
            // Perfiles de 10-bit, 12-bit o RGB planar (ej. High 4:4:4 Predictive, gbrap12le)
            // fallan en decodificadores estándar de Chromium.
            !pix_fmt.contains("10")
                && !pix_fmt.contains("12")
                && !pix_fmt.starts_with("gbr")
                && !pix_fmt.starts_with("rgb")
                && !pix_fmt.contains("444")
                && !pix_fmt.contains("422")
        }
        "vp8" | "vp9" | "av1" => true,
        _ => false,
    }
}

/// Obtiene la fuente de reproducción óptima para un archivo de vídeo.
/// Si el archivo utiliza un códec profesional no soportado por Chromium (CineForm, ProRes, etc.),
/// genera o reutiliza un proxy ultrarrápido y visualmente indistinguible en caché temporal.
pub fn resolve_video_playback_source(path: &Path) -> Result<VideoPlaybackSource, String> {
    if !path.exists() {
        return Err(format!("El archivo no existe: {}", path.display()));
    }

    let path_str = path.to_string_lossy();
    let clean_path = path_str.trim_start_matches(r"\\?\");
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let ffprobe = find_ffprobe_binary()
        .ok_or_else(|| "ffprobe no encontrado para inspeccionar el vídeo".to_string())?;

    let mut probe_cmd = Command::new(&ffprobe);
    probe_cmd.args([
        "-v",
        "error",
        "-show_entries",
        "stream=index,codec_name,codec_type,pix_fmt,width,height:format=duration",
        "-of",
        "json",
        clean_path,
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        probe_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let probe_output = probe_cmd
        .output()
        .map_err(|e| format!("Fallo al ejecutar ffprobe: {e}"))?;

    if !probe_output.status.success() {
        return Err(format!("ffprobe no pudo analizar el archivo: {}", clean_path));
    }

    let json_val: serde_json::Value = serde_json::from_slice(&probe_output.stdout)
        .map_err(|e| format!("Error al decodificar metadatos de vídeo: {e}"))?;

    let streams = json_val["streams"].as_array();
    let video_stream = streams.and_then(|s| {
        s.iter()
            .find(|st| st["codec_type"].as_str() == Some("video"))
    });

    let original_codec = video_stream
        .and_then(|s| s["codec_name"].as_str())
        .unwrap_or("")
        .to_string();

    let pix_fmt = video_stream
        .and_then(|s| s["pix_fmt"].as_str())
        .unwrap_or("")
        .to_string();

    let width = video_stream
        .and_then(|s| s["width"].as_u64())
        .unwrap_or(0) as u32;

    let height = video_stream
        .and_then(|s| s["height"].as_u64())
        .unwrap_or(0) as u32;

    let duration_secs = json_val["format"]["duration"]
        .as_str()
        .and_then(|d| d.parse::<f64>().ok())
        .unwrap_or(0.0);

    let codec_display = format_codec_display(&original_codec);

    // 1. Si el archivo es nativamente reproducible de forma directa por Chromium
    if is_codec_directly_playable(&original_codec, &pix_fmt, &ext) {
        return Ok(VideoPlaybackSource {
            playback_path: clean_path.to_string(),
            is_proxy: false,
            original_codec,
            codec_display,
            width,
            height,
            duration_secs,
        });
    }

    // 2. Requiere proxy compatible: generar o reutilizar desde la caché temporal
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let file_size = metadata.len();
    let modified = metadata
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let mut hasher = DefaultHasher::new();
    hasher.write(clean_path.as_bytes());
    hasher.write_u64(file_size);
    hasher.write_u64(modified);
    let hash = hasher.finish();

    let cache_dir = std::env::temp_dir().join("prisma_video_proxies");
    let _ = fs::create_dir_all(&cache_dir);
    let proxy_path = cache_dir.join(format!("proxy_{:016x}.mp4", hash));

    // Si el proxy ya existe y tiene un tamaño válido (> 1KB), reutilizar de inmediato
    if proxy_path.exists()
        && proxy_path
            .metadata()
            .map(|m| m.len() > 1024)
            .unwrap_or(false)
    {
        return Ok(VideoPlaybackSource {
            playback_path: proxy_path.to_string_lossy().into_owned(),
            is_proxy: true,
            original_codec,
            codec_display,
            width,
            height,
            duration_secs,
        });
    }

    // 3. Generar proxy ultrarrápido con FFmpeg
    let ffmpeg = find_ffmpeg_binary()
        .ok_or_else(|| "ffmpeg no disponible para generar proxy de vídeo".to_string())?;

    let mut conv = Command::new(&ffmpeg);
    conv.args([
        "-y",
        "-nostdin",
        "-i",
        clean_path,
        "-vf",
        "scale='min(1920,iw)':-2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "17",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
    ]);
    conv.arg(&proxy_path);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        conv.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let conv_status = conv
        .status()
        .map_err(|e| format!("Error al ejecutar transcodificación de proxy: {e}"))?;

    if !conv_status.success() || !proxy_path.exists() {
        return Err(format!(
            "No se pudo generar el proxy de reproducción para el vídeo con códec {}",
            original_codec
        ));
    }

    Ok(VideoPlaybackSource {
        playback_path: proxy_path.to_string_lossy().into_owned(),
        is_proxy: true,
        original_codec,
        codec_display,
        width,
        height,
        duration_secs,
    })
}

#[cfg(test)]
mod tests {
    use std::path::Path;
    use super::*;

    #[test]
    fn test_format_codec_display() {
        assert_eq!(format_codec_display("cfhd"), "GoPro CineForm (HD/4K)");
        assert_eq!(format_codec_display("prores"), "Apple ProRes");
        assert_eq!(format_codec_display("qtrle"), "QuickTime Animation (RLE)");
        assert_eq!(format_codec_display("h264"), "H.264 / AVC");
    }

    #[test]
    fn test_is_codec_directly_playable() {
        assert!(is_codec_directly_playable("h264", "yuv420p", "mp4"));
        assert!(is_codec_directly_playable("vp9", "yuv420p", "webm"));
        // CineForm no es directamente reproducible en Chromium
        assert!(!is_codec_directly_playable("cfhd", "gbrap12le", "mov"));
        // ProRes no es directamente reproducible en Chromium
        assert!(!is_codec_directly_playable("prores", "yuv422p10le", "mov"));
        // H.264 10-bit tampoco
        assert!(!is_codec_directly_playable("h264", "yuv420p10le", "mp4"));
    }

    #[test]
    fn test_resolve_video_playback_source_marcar_mov() {
        let test_path = Path::new(r"D:\Vídeos\Partidos\Render\Marcar.mov");
        if test_path.exists() {
            let res = resolve_video_playback_source(test_path);
            assert!(res.is_ok(), "resolve_video_playback_source falló: {:?}", res.err());
            let source = res.unwrap();
            println!("Resultado de fuente de reproducción: {:?}", source);
            assert_eq!(source.original_codec, "cfhd");
            assert!(source.is_proxy, "Debe ser identificado como proxy");
            assert!(source.playback_path.ends_with(".mp4"));
            assert!(Path::new(&source.playback_path).exists(), "El proxy debe existir en disco");
        }
    }

    #[test]
    fn test_resolve_video_playback_source_direct_mp4() {
        let test_path = Path::new(r"D:\Vídeos\Partidos\Render\Triunfo.mp4");
        if test_path.exists() {
            let res = resolve_video_playback_source(test_path);
            assert!(res.is_ok(), "resolve_video_playback_source falló: {:?}", res.err());
            let source = res.unwrap();
            println!("Resultado MP4 directo: {:?}", source);
            assert_eq!(source.original_codec, "h264");
            assert!(!source.is_proxy, "MP4 estándar debe ser directo sin proxy");
            assert_eq!(source.playback_path, r"D:\Vídeos\Partidos\Render\Triunfo.mp4");
        }
    }
}
