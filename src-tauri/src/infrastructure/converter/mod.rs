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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionJob {
    pub id: String,
    pub input_path: String,
    pub output_path: String,
    pub status: String, // "pending", "processing", "completed", "error"
    pub error_message: Option<String>,
    pub progress_percent: Option<f32>,
}

pub fn find_ffmpeg_binary() -> Option<PathBuf> {
    let mut candidates = vec![
        PathBuf::from("ffmpeg.exe"),
        PathBuf::from("ffmpeg"),
    ];

    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        candidates.push(PathBuf::from(format!(r"{}\Microsoft\WinGet\Links\ffmpeg.exe", local_appdata)));
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            candidates.push(parent.join("ffmpeg.exe"));
            candidates.push(parent.join("bin").join("ffmpeg.exe"));
        }
    }

    candidates.push(PathBuf::from(r"C:\Program Files\Krita (x64)\bin\ffmpeg.exe"));
    candidates.push(PathBuf::from(r"C:\ffmpeg\bin\ffmpeg.exe"));

    for path in candidates {
        let mut cmd = Command::new(&path);
        cmd.arg("-version");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        if let Ok(out) = cmd.output() {
            if out.status.success() {
                return Some(path);
            }
        }
    }

    None
}

pub fn find_ffprobe_binary() -> Option<PathBuf> {
    let mut candidates = vec![
        PathBuf::from("ffprobe.exe"),
        PathBuf::from("ffprobe"),
    ];

    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        candidates.push(PathBuf::from(format!(r"{}\Microsoft\WinGet\Links\ffprobe.exe", local_appdata)));
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            candidates.push(parent.join("ffprobe.exe"));
            candidates.push(parent.join("bin").join("ffprobe.exe"));
        }
    }

    candidates.push(PathBuf::from(r"C:\Program Files\Krita (x64)\bin\ffprobe.exe"));
    candidates.push(PathBuf::from(r"C:\ffmpeg\bin\ffprobe.exe"));

    for path in candidates {
        let mut cmd = Command::new(&path);
        cmd.arg("-version");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        if let Ok(out) = cmd.output() {
            if out.status.success() {
                return Some(path);
            }
        }
    }

    None
}

pub fn get_ffmpeg_status() -> FFmpegStatus {
    let ffmpeg = find_ffmpeg_binary();
    let ffprobe = find_ffprobe_binary();
    let is_available = ffmpeg.is_some();

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
    let ffmpeg = find_ffmpeg_binary().ok_or("FFmpeg no está disponible en el sistema")?;
    let input_clean = input_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");
    let output_clean = output_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");

    if let Some(parent) = output_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut cmd = Command::new(ffmpeg);
    cmd.arg("-y").arg("-i").arg(input_clean);

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
    let fmt = opts.target_format.to_lowercase();
    match fmt.as_str() {
        "jpg" | "jpeg" => {
            let q = opts.quality.unwrap_or(85).clamp(1, 100);
            // FFmpeg usa q:v 1-31 (donde 1 es mejor)
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

pub fn extract_video_audio(
    input_path: &Path,
    output_path: &Path,
    opts: &VideoToAudioOptions,
) -> Result<(), String> {
    let ffmpeg = find_ffmpeg_binary().ok_or("FFmpeg no está disponible en el sistema")?;
    let input_clean = input_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");
    let output_clean = output_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");

    if let Some(parent) = output_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut cmd = Command::new(ffmpeg);
    cmd.arg("-y").arg("-i").arg(input_clean).arg("-vn");

    let fmt = opts.target_format.to_lowercase();
    match fmt.as_str() {
        "mp3" => {
            cmd.arg("-c:a").arg("libmp3lame");
            cmd.arg("-b:a").arg(opts.bitrate.as_deref().unwrap_or("320k"));
        }
        "flac" => {
            cmd.arg("-c:a").arg("flac");
        }
        "wav" => {
            cmd.arg("-c:a").arg("pcm_s16le");
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
    let ffmpeg = find_ffmpeg_binary().ok_or("FFmpeg no está disponible en el sistema")?;
    let input_clean = input_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");
    let output_clean = output_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");

    if let Some(parent) = output_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut cmd = Command::new(ffmpeg);
    cmd.arg("-y").arg("-i").arg(input_clean);

    match opts.video_codec.as_str() {
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

    match opts.audio_codec.as_deref().unwrap_or("copy") {
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
    let ffmpeg = find_ffmpeg_binary().ok_or("FFmpeg no está disponible en el sistema")?;
    let input_clean = input_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");
    let output_clean = output_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");

    if let Some(parent) = output_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut cmd = Command::new(ffmpeg);
    cmd.arg("-y").arg("-i").arg(input_clean);

    let fmt = opts.target_format.to_lowercase();
    match fmt.as_str() {
        "mp3" => {
            cmd.arg("-c:a").arg("libmp3lame");
            cmd.arg("-b:a").arg(opts.bitrate.as_deref().unwrap_or("320k"));
        }
        "flac" => {
            cmd.arg("-c:a").arg("flac");
        }
        "wav" => {
            cmd.arg("-c:a").arg("pcm_s16le");
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
