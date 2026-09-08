use std::{
    path::{Path, PathBuf},
    process::Command,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FFmpegStatus {
    pub is_available: bool,
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageConvertOptions {
    pub target_format: String, // "jpg", "png", "webp", "avif", "bmp", "tiff", "gif"
    pub quality: Option<u32>,   // 1 - 100
    pub resize_width: Option<u32>,
    pub resize_height: Option<u32>,
    pub keep_aspect_ratio: Option<bool>,
    pub strip_metadata: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoToAudioOptions {
    pub target_format: String, // "mp3", "flac", "wav", "aac", "ogg", "m4a"
    pub bitrate: Option<String>, // "128k", "192k", "256k", "320k"
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoTranscodeOptions {
    pub target_format: String, // "mp4", "mkv", "webm"
    pub video_codec: String,   // "h264", "hevc", "av1", "vp9", "copy"
    pub crf: Option<u32>,
    pub preset: Option<String>, // "ultrafast", "fast", "medium", "slow"
    pub scale: Option<String>,  // "1920:1080", "1280:720", "854:480", "none"
    pub audio_codec: Option<String>, // "aac", "mp3", "opus", "copy"
    pub audio_bitrate: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioTranscodeOptions {
    pub target_format: String, // "mp3", "flac", "wav", "ogg", "aac", "m4a"
    pub bitrate: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionJob {
    pub id: String,
    pub input_path: String,
    pub output_path: String,
    pub status: String, // "pending", "processing", "completed", "error"
    pub error_message: Option<String>,
    pub progress_percent: Option<f32>,
}

fn media_binary(name: &str) -> Option<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() { roots.push(parent.join("ffmpeg")); }
    }
    roots.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("vendor/ffmpeg"));
    roots.into_iter().map(|root| root.join(format!("{name}.exe"))).find(|path| path.is_file())
}

pub fn find_ffmpeg_binary() -> Option<PathBuf> { media_binary("ffmpeg") }
pub fn find_ffprobe_binary() -> Option<PathBuf> { media_binary("ffprobe") }

fn validate_paths(input: &Path, output: &Path) -> Result<(), String> {
    if !input.is_file() { return Err(format!("No existe el archivo de entrada: {}", input.display())); }
    if output.exists() { return Err(format!("El destino ya existe; elige otro nombre: {}", output.display())); }
    Ok(())
}

pub fn get_ffmpeg_status() -> FFmpegStatus {
    let ffmpeg = find_ffmpeg_binary();
    let ffprobe = find_ffprobe_binary();
    let mut is_available = false;

    let mut version = None;
    if let Some(ref path) = ffmpeg {
        let mut cmd = Command::new(path);
        cmd.arg("-version");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        if let Ok(output) = cmd.output() {
            is_available = output.status.success() && ffprobe.is_some();
            if let Ok(v_str) = String::from_utf8(output.stdout) {
                if let Some(first_line) = v_str.lines().next() {
                    version = Some(first_line.to_string());
                }
            }
        }
    }

    FFmpegStatus {
        is_available,
        ffmpeg_path: ffmpeg.map(|p| p.to_string_lossy().to_string()),
        ffprobe_path: ffprobe.map(|p| p.to_string_lossy().to_string()),
        version,
    }
}

pub fn convert_image(
    input_path: &Path,
    output_path: &Path,
    opts: &ImageConvertOptions,
) -> Result<(), String> {
    validate_paths(input_path, output_path)?;
    let fmt = opts.target_format.to_lowercase();

    // Intentar primero conversión nativa rápida y pura en Rust para JPG, PNG y WEBP
    if matches!(fmt.as_str(), "jpg" | "jpeg" | "png") {
        if let Ok(()) = convert_image_native(input_path, output_path, opts) {
            return Ok(());
        }
    }

    // Fallback a FFmpeg (necesario para AVIF o formatos especiales)
    let ffmpeg = find_ffmpeg_binary().ok_or("FFmpeg no está disponible en el sistema")?;
    let input_clean = input_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");
    let output_clean = output_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");

    if let Some(parent) = output_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut cmd = Command::new(ffmpeg);
    cmd.arg("-nostdin").arg("-n").arg("-i").arg(input_clean);

    // Filtros de escala
    let mut vf_filters = Vec::new();
    if let (Some(w), Some(h)) = (opts.resize_width, opts.resize_height) {
        if opts.keep_aspect_ratio.unwrap_or(true) {
            vf_filters.push(format!("scale={w}:{h}:force_original_aspect_ratio=decrease"));
        } else {
            vf_filters.push(format!("scale={w}:{h}"));
        }
    } else if let Some(w) = opts.resize_width {
        vf_filters.push(format!("scale={w}:-1"));
    } else if let Some(h) = opts.resize_height {
        vf_filters.push(format!("scale=-1:{h}"));
    }

    if !vf_filters.is_empty() {
        cmd.arg("-vf").arg(vf_filters.join(","));
    }

    // Calidad y formato
    match fmt.as_str() {
        "jpg" | "jpeg" => {
            let q = opts.quality.unwrap_or(85).clamp(1, 100);
            let q_val = ((100 - q) * 30 / 100).max(1);
            cmd.arg("-q:v").arg(q_val.to_string());
        }
        "webp" => {
            let q = opts.quality.unwrap_or(85).clamp(1, 100);
            cmd.arg("-c:v").arg("libwebp").arg("-quality").arg(q.to_string());
        }
        "avif" => {
            let q = opts.quality.unwrap_or(80).clamp(1, 100);
            let crf = (63 - (q * 63 / 100)).clamp(0, 63);
            cmd.arg("-c:v").arg("libsvtav1").arg("-crf").arg(crf.to_string());
        }
        "png" => {
            cmd.arg("-c:v").arg("png");
        }
        _ => {}
    }

    if opts.strip_metadata.unwrap_or(false) {
        cmd.arg("-map_metadata").arg("-1");
    }

    cmd.arg(output_clean);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd.output().map_err(|e| format!("Error ejecutando FFmpeg: {e}"))?;
    if !output.status.success() {
        let err_text = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg falló al convertir imagen: {err_text}"));
    }

    Ok(())
}

fn convert_image_native(
    input_path: &Path,
    output_path: &Path,
    opts: &ImageConvertOptions,
) -> Result<(), String> {
    let fmt = opts.target_format.to_lowercase();
    let target_format = match fmt.as_str() {
        "jpg" | "jpeg" => image::ImageFormat::Jpeg,
        "png" => image::ImageFormat::Png,
        "webp" => image::ImageFormat::WebP,
        _ => return Err(format!("Formato no soportado nativamente: {fmt}")),
    };

    let img = image::open(input_path).map_err(|e| format!("Error abriendo imagen: {e}"))?;

    let processed_img = match (opts.resize_width, opts.resize_height) {
        (Some(w), Some(h)) => {
            if opts.keep_aspect_ratio.unwrap_or(true) {
                img.resize(w, h, image::imageops::FilterType::Lanczos3)
            } else {
                img.resize_exact(w, h, image::imageops::FilterType::Lanczos3)
            }
        }
        (Some(w), None) => {
            let ratio = w as f64 / img.width() as f64;
            let h = (img.height() as f64 * ratio).round().max(1.0) as u32;
            img.resize_exact(w, h, image::imageops::FilterType::Lanczos3)
        }
        (None, Some(h)) => {
            let ratio = h as f64 / img.height() as f64;
            let w = (img.width() as f64 * ratio).round().max(1.0) as u32;
            img.resize_exact(w, h, image::imageops::FilterType::Lanczos3)
        }
        (None, None) => img,
    };

    if let Some(parent) = output_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    match target_format {
        image::ImageFormat::Jpeg => {
            let q = opts.quality.unwrap_or(85).clamp(1, 100) as u8;
            let file = std::fs::OpenOptions::new().write(true).create_new(true).open(output_path).map_err(|e| format!("Error creando archivo: {e}"))?;
            let mut writer = std::io::BufWriter::new(file);
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut writer, q);
            encoder.encode_image(&processed_img).map_err(|e| format!("Error codificando JPEG: {e}"))?;
        }
        _ => {
            processed_img.write_to(&mut std::io::BufWriter::new(std::fs::OpenOptions::new().write(true).create_new(true).open(output_path).map_err(|e| e.to_string())?), target_format)
                .map_err(|e| format!("Error guardando imagen: {e}"))?;
        }
    }

    Ok(())
}

pub fn extract_video_audio(
    input_path: &Path,
    output_path: &Path,
    opts: &VideoToAudioOptions,
) -> Result<(), String> {
    validate_paths(input_path, output_path)?;
    let ffmpeg = find_ffmpeg_binary().ok_or("FFmpeg no está disponible en el sistema")?;
    let input_clean = input_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");
    let output_clean = output_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");

    if let Some(parent) = output_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut cmd = Command::new(ffmpeg);
    cmd.arg("-nostdin").arg("-n").arg("-i").arg(input_clean).arg("-vn");

    let fmt = opts.target_format.to_lowercase();
    match fmt.as_str() {
        "mp3" => {
            cmd.arg("-c:a").arg("libmp3lame");
            cmd.arg("-b:a").arg(opts.bitrate.as_deref().unwrap_or("320k"));
        }
        "flac" => {
            cmd.arg("-c:a").arg("flac");
            let level = match opts.bitrate.as_deref() {
                Some("flac_standard") => "5",
                _ => "8",
            };
            cmd.arg("-compression_level").arg(level);
        }
        "wav" => {
            let pcm_codec = match opts.bitrate.as_deref() {
                Some("wav_16") => "pcm_s16le",
                _ => "pcm_s24le",
            };
            cmd.arg("-c:a").arg(pcm_codec);
        }
        "aac" | "m4a" => {
            cmd.arg("-c:a").arg("aac");
            cmd.arg("-b:a").arg(opts.bitrate.as_deref().unwrap_or("256k"));
        }
        "ogg" => {
            cmd.arg("-c:a").arg("libvorbis");
            cmd.arg("-b:a").arg(opts.bitrate.as_deref().unwrap_or("192k"));
        }
        _ => {
            cmd.arg("-c:a").arg("libmp3lame").arg("-b:a").arg("320k");
        }
    }

    if let Some(sr) = opts.sample_rate {
        cmd.arg("-ar").arg(sr.to_string());
    }

    if let Some(ch) = opts.channels {
        cmd.arg("-ac").arg(ch.to_string());
    }

    cmd.arg(output_clean);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd.output().map_err(|e| format!("Error ejecutando FFmpeg: {e}"))?;
    if !output.status.success() {
        let err_text = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg falló al extraer audio: {err_text}"));
    }

    Ok(())
}

pub fn transcode_video(
    input_path: &Path,
    output_path: &Path,
    opts: &VideoTranscodeOptions,
) -> Result<(), String> {
    validate_paths(input_path, output_path)?;
    let ffmpeg = find_ffmpeg_binary().ok_or("FFmpeg no está disponible en el sistema")?;
    let input_clean = input_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");
    let output_clean = output_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");

    if let Some(parent) = output_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut cmd = Command::new(ffmpeg);
    cmd.arg("-nostdin").arg("-n").arg("-i").arg(input_clean);

    match if opts.target_format == "webm" && !matches!(opts.video_codec.as_str(), "vp9" | "av1" | "copy") { "vp9" } else { opts.video_codec.as_str() } {
        "copy" => {
            cmd.arg("-c:v").arg("copy");
        }
        "hevc" | "h265" => {
            cmd.arg("-c:v").arg("libx265");
            cmd.arg("-crf").arg(opts.crf.unwrap_or(24).to_string());
            cmd.arg("-preset").arg(opts.preset.as_deref().unwrap_or("medium"));
        }
        "av1" => {
            cmd.arg("-c:v").arg("libsvtav1");
            cmd.arg("-crf").arg(opts.crf.unwrap_or(30).to_string());
        }
        "vp9" => {
            cmd.arg("-c:v").arg("libvpx-vp9");
            cmd.arg("-crf").arg(opts.crf.unwrap_or(30).to_string());
            cmd.arg("-b:v").arg("0");
        }
        _ => {
            // Default H.264
            cmd.arg("-c:v").arg("libx264");
            cmd.arg("-crf").arg(opts.crf.unwrap_or(22).to_string());
            cmd.arg("-preset").arg(opts.preset.as_deref().unwrap_or("medium"));
        }
    }

    if let Some(ref scale) = opts.scale {
        if scale != "none" && !scale.is_empty() {
            cmd.arg("-vf").arg(format!("scale={scale}:force_original_aspect_ratio=decrease"));
        }
    }

    match if opts.target_format == "webm" { "opus" } else { opts.audio_codec.as_deref().unwrap_or("copy") } {
        "copy" => {
            cmd.arg("-c:a").arg("copy");
        }
        "aac" => {
            cmd.arg("-c:a").arg("aac");
            cmd.arg("-b:a").arg(opts.audio_bitrate.as_deref().unwrap_or("192k"));
        }
        "mp3" => {
            cmd.arg("-c:a").arg("libmp3lame");
            cmd.arg("-b:a").arg(opts.audio_bitrate.as_deref().unwrap_or("192k"));
        }
        "opus" => {
            cmd.arg("-c:a").arg("libopus");
            cmd.arg("-b:a").arg(opts.audio_bitrate.as_deref().unwrap_or("128k"));
        }
        _ => {
            cmd.arg("-c:a").arg("copy");
        }
    }

    cmd.arg(output_clean);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd.output().map_err(|e| format!("Error ejecutando FFmpeg: {e}"))?;
    if !output.status.success() {
        let err_text = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg falló al transcodificar vídeo: {err_text}"));
    }

    Ok(())
}

pub fn transcode_audio(
    input_path: &Path,
    output_path: &Path,
    opts: &AudioTranscodeOptions,
) -> Result<(), String> {
    validate_paths(input_path, output_path)?;
    let ffmpeg = find_ffmpeg_binary().ok_or("FFmpeg no está disponible en el sistema")?;
    let input_clean = input_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");
    let output_clean = output_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");

    if let Some(parent) = output_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut cmd = Command::new(ffmpeg);
    cmd.arg("-nostdin").arg("-n").arg("-i").arg(input_clean);

    let fmt = opts.target_format.to_lowercase();
    match fmt.as_str() {
        "mp3" => {
            cmd.arg("-c:a").arg("libmp3lame");
            cmd.arg("-b:a").arg(opts.bitrate.as_deref().unwrap_or("320k"));
        }
        "flac" => {
            cmd.arg("-c:a").arg("flac");
            let level = match opts.bitrate.as_deref() {
                Some("flac_standard") => "5",
                _ => "8",
            };
            cmd.arg("-compression_level").arg(level);
        }
        "wav" => {
            let pcm_codec = match opts.bitrate.as_deref() {
                Some("wav_16") => "pcm_s16le",
                _ => "pcm_s24le",
            };
            cmd.arg("-c:a").arg(pcm_codec);
        }
        "aac" | "m4a" => {
            cmd.arg("-c:a").arg("aac");
            cmd.arg("-b:a").arg(opts.bitrate.as_deref().unwrap_or("256k"));
        }
        "ogg" => {
            cmd.arg("-c:a").arg("libvorbis");
            cmd.arg("-b:a").arg(opts.bitrate.as_deref().unwrap_or("192k"));
        }
        _ => {
            cmd.arg("-c:a").arg("libmp3lame").arg("-b:a").arg("320k");
        }
    }

    if let Some(sr) = opts.sample_rate {
        cmd.arg("-ar").arg(sr.to_string());
    }

    if let Some(ch) = opts.channels {
        cmd.arg("-ac").arg(ch.to_string());
    }

    cmd.arg(output_clean);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd.output().map_err(|e| format!("Error ejecutando FFmpeg: {e}"))?;
    if !output.status.success() {
        let err_text = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg falló al transcodificar audio: {err_text}"));
    }

    Ok(())
}

/// Extrae ZIP en una carpeta nueva, sin sobrescribir ni aceptar rutas externas.
pub fn extract_zip(input: &Path) -> Result<PathBuf, String> {
    use std::io::Read;
    let file = std::fs::File::open(input).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("ZIP no válido: {e}"))?;
    if archive.len() > 10000 { return Err("El ZIP supera el límite de 10000 entradas".into()); }
    let mut total = 0u64;
    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|e| e.to_string())?;
        let relative = entry.enclosed_name().ok_or("El ZIP contiene rutas externas")?;
        if relative.components().any(|c| c.as_os_str().to_string_lossy().contains(':')) || entry.is_symlink() {
            return Err("El ZIP contiene enlaces o rutas no admitidas".into());
        }
        total = total.checked_add(entry.size()).ok_or("Tamaño inválido")?;
        if total > 4 * 1024 * 1024 * 1024 { return Err("El ZIP supera el límite de extracción de 4 GiB".into()); }
    }
    let parent = input.parent().ok_or("La entrada no tiene carpeta")?;
    let stem = input.file_stem().ok_or("Nombre no válido")?.to_string_lossy();
    let destination = parent.join(format!("{stem}_extraído"));
    std::fs::create_dir(&destination).map_err(|e| format!("No se pudo crear una carpeta nueva {}: {e}", destination.display()))?;
    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|e| e.to_string())?;
        let relative = entry.enclosed_name().ok_or("Ruta no válida")?;
        let target = destination.join(relative);
        if entry.is_dir() { std::fs::create_dir_all(&target).map_err(|e| e.to_string())?; continue; }
        if let Some(parent) = target.parent() { std::fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
        let expected = entry.size();
        let mut output = std::fs::OpenOptions::new().write(true).create_new(true).open(&target).map_err(|e| e.to_string())?;
        let copied = std::io::copy(&mut entry.take(expected + 1), &mut output).map_err(|e| format!("Extracción incompleta en {}: {e}", destination.display()))?;
        if copied != expected { return Err("El tamaño extraído no coincide con el ZIP".into()); }
    }
    Ok(destination)
}

#[cfg(test)]
mod tests;
