use std::path::Path;
use std::process::Command;
use serde::{Deserialize, Serialize};

use crate::infrastructure::converter::find_ffprobe_binary;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VideoTechnicalMetadata {
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub aspect_ratio: String,
    pub codec: String,
    pub codec_display: String,
    pub profile: Option<String>,
    pub pixel_format: String,
    pub bit_depth: u32,
    pub fps: f64,
    pub fps_fraction: String,
    pub duration_secs: f64,
    pub bitrate_bps: Option<u64>,
    pub bitrate_display: String,

    // Colorimetría y Rango Dinámico (DaVinci Workflow)
    pub color_space: Option<String>,
    pub color_transfer: Option<String>,
    pub color_primaries: Option<String>,
    pub color_range: Option<String>,
    pub is_hdr: bool,
    pub log_curve: Option<String>,

    // Dispositivo y Cámara
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub creation_time: Option<String>,

    // Audio
    pub audio_codec: Option<String>,
    pub audio_channels: u32,
    pub audio_sample_rate: u32,
}

fn calculate_aspect_ratio(width: u32, height: u32) -> String {
    if width == 0 || height == 0 {
        return "N/A".to_string();
    }
    let ratio = width as f64 / height as f64;
    if (ratio - 16.0 / 9.0).abs() < 0.05 {
        "16:9".to_string()
    } else if (ratio - 9.0 / 16.0).abs() < 0.05 {
        "9:16 (Vertical)".to_string()
    } else if (ratio - 4.0 / 3.0).abs() < 0.05 {
        "4:3".to_string()
    } else if (ratio - 2.39).abs() < 0.08 || (ratio - 2.35).abs() < 0.08 {
        "2.39:1 (Cinemascope)".to_string()
    } else if (ratio - 1.0).abs() < 0.03 {
        "1:1".to_string()
    } else if (ratio - 21.0 / 9.0).abs() < 0.08 {
        "21:9 (Ultrawide)".to_string()
    } else {
        format!("{:.2}:1", ratio)
    }
}

fn parse_frame_rate(fps_str: &str) -> (f64, String) {
    let clean = fps_str.trim();
    if clean.contains('/') {
        let parts: Vec<&str> = clean.split('/').collect();
        if parts.len() == 2 {
            if let (Ok(num), Ok(den)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                if den > 0.0 {
                    let val = num / den;
                    let rounded = (val * 1000.0).round() / 1000.0;
                    return (rounded, clean.to_string());
                }
            }
        }
    }
    if let Ok(val) = clean.parse::<f64>() {
        let rounded = (val * 1000.0).round() / 1000.0;
        return (rounded, format!("{}/1", rounded));
    }
    (0.0, "0/1".to_string())
}

fn format_bitrate(bps: u64) -> String {
    if bps >= 1_000_000 {
        format!("{:.1} Mbps", bps as f64 / 1_000_000.0)
    } else if bps >= 1_000 {
        format!("{} kbps", bps / 1_000)
    } else {
        format!("{} bps", bps)
    }
}

fn detect_codec_display(codec: &str, profile: Option<&str>) -> String {
    match codec.to_lowercase().as_str() {
        "h264" | "avc" => "H.264 / AVC".to_string(),
        "hevc" | "h265" => "HEVC / H.265".to_string(),
        "prores" => {
            if let Some(prof) = profile {
                format!("Apple ProRes ({prof})")
            } else {
                "Apple ProRes".to_string()
            }
        }
        "av1" => "AV1".to_string(),
        "vp9" => "VP9".to_string(),
        "vp8" => "VP8".to_string(),
        "dnxhd" | "dnxhr" => "Avid DNxHR/HD".to_string(),
        "mpeg4" => "MPEG-4".to_string(),
        other => other.to_uppercase(),
    }
}

fn detect_log_curve(
    color_transfer: Option<&str>,
    tags: &serde_json::Map<String, serde_json::Value>,
    make_model: Option<&str>,
) -> Option<String> {
    if let Some(transfer) = color_transfer {
        let t = transfer.to_lowercase();
        if t.contains("s-log3") || t.contains("slog3") {
            return Some("Sony S-Log3".to_string());
        }
        if t.contains("s-log2") || t.contains("slog2") {
            return Some("Sony S-Log2".to_string());
        }
        if t.contains("arib-std-b67") || t.contains("hlg") {
            return Some("HLG (Hybrid Log-Gamma)".to_string());
        }
        if t.contains("smpte2084") || t.contains("pq") {
            return Some("PQ / HDR10".to_string());
        }
        if t.contains("apple") && t.contains("log") {
            return Some("Apple Log".to_string());
        }
    }

    // Inspeccionar tags de formato / stream
    for (k, v) in tags {
        let key_lower = k.to_lowercase();
        let val_str = v.as_str().unwrap_or("").to_lowercase();
        if key_lower.contains("gamma") || key_lower.contains("log") || key_lower.contains("profile") || key_lower.contains("capture") {
            if val_str.contains("s-log3") || val_str.contains("slog3") {
                return Some("Sony S-Log3".to_string());
            }
            if val_str.contains("c-log3") || val_str.contains("clog3") {
                return Some("Canon C-Log3".to_string());
            }
            if val_str.contains("c-log") || val_str.contains("clog") {
                return Some("Canon C-Log".to_string());
            }
            if val_str.contains("v-log") || val_str.contains("vlog") {
                return Some("Panasonic V-Log".to_string());
            }
            if val_str.contains("d-log") || val_str.contains("dlog") {
                return Some("DJI D-Log".to_string());
            }
            if val_str.contains("n-log") || val_str.contains("nlog") {
                return Some("Nikon N-Log".to_string());
            }
            if val_str.contains("f-log2") || val_str.contains("flog2") {
                return Some("Fujifilm F-Log2".to_string());
            }
            if val_str.contains("f-log") || val_str.contains("flog") {
                return Some("Fujifilm F-Log".to_string());
            }
            if val_str.contains("apple") && val_str.contains("log") {
                return Some("Apple Log".to_string());
            }
            if val_str.contains("bmd") || val_str.contains("blackmagic") {
                return Some("Blackmagic Film / Gen 5".to_string());
            }
        }
    }

    if let Some(mm) = make_model {
        let lower = mm.to_lowercase();
        if lower.contains("apple") && lower.contains("log") {
            return Some("Apple Log".to_string());
        }
    }

    None
}

/// Extrae metadatos técnicos y de colorimetría para cualquier archivo de vídeo local.
pub fn extract_video_technical_metadata(video_path: &Path) -> Result<VideoTechnicalMetadata, String> {
    let clean_path = video_path.to_string_lossy().to_string();
    let ffprobe = find_ffprobe_binary()
        .ok_or_else(|| "ffprobe no encontrado para analizar la ficha técnica del vídeo".to_string())?;

    let mut cmd = Command::new(&ffprobe);
    cmd.args([
        "-v",
        "error",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        &clean_path,
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Fallo al ejecutar ffprobe: {e}"))?;

    if !output.status.success() {
        return Err(format!("ffprobe no pudo analizar el archivo: {}", clean_path));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Error al decodificar JSON de ffprobe: {e}"))?;

    let streams = json["streams"].as_array();
    let format = json["format"].as_object();

    let video_stream = streams.and_then(|s| {
        s.iter().find(|st| st["codec_type"].as_str() == Some("video"))
    }).ok_or_else(|| "No se encontró pista de vídeo válida en el archivo".to_string())?;

    let audio_stream = streams.and_then(|s| {
        s.iter().find(|st| st["codec_type"].as_str() == Some("audio"))
    });

    let width = video_stream["width"].as_u64().unwrap_or(0) as u32;
    let height = video_stream["height"].as_u64().unwrap_or(0) as u32;
    let aspect_ratio = calculate_aspect_ratio(width, height);

    let codec = video_stream["codec_name"].as_str().unwrap_or("unknown").to_string();
    let profile = video_stream["profile"].as_str().map(|s| s.to_string());
    let codec_display = detect_codec_display(&codec, profile.as_deref());

    let pixel_format = video_stream["pix_fmt"].as_str().unwrap_or("").to_string();
    let bit_depth = video_stream["bits_per_raw_sample"]
        .as_str()
        .and_then(|b| b.parse::<u32>().ok())
        .or_else(|| {
            if pixel_format.contains("10") {
                Some(10)
            } else if pixel_format.contains("12") {
                Some(12)
            } else {
                Some(8)
            }
        })
        .unwrap_or(8);

    let (fps, fps_fraction) = video_stream["r_frame_rate"]
        .as_str()
        .map(parse_frame_rate)
        .unwrap_or_else(|| {
            video_stream["avg_frame_rate"]
                .as_str()
                .map(parse_frame_rate)
                .unwrap_or((0.0, "0/1".to_string()))
        });

    let duration_secs = format
        .and_then(|f| f.get("duration"))
        .and_then(|d| d.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let bitrate_bps = format
        .and_then(|f| f.get("bit_rate"))
        .and_then(|b| b.as_str())
        .and_then(|s| s.parse::<u64>().ok())
        .or_else(|| {
            video_stream["bit_rate"]
                .as_str()
                .and_then(|s| s.parse::<u64>().ok())
        });

    let bitrate_display = bitrate_bps
        .map(format_bitrate)
        .unwrap_or_else(|| "N/A".to_string());

    // Colorimetría
    let color_space = video_stream["color_space"].as_str().map(String::from);
    let color_transfer = video_stream["color_transfer"].as_str().map(String::from);
    let color_primaries = video_stream["color_primaries"].as_str().map(String::from);
    let color_range = video_stream["color_range"].as_str().map(String::from);

    let is_hdr = color_transfer.as_deref().is_some_and(|t| {
        let tl = t.to_lowercase();
        tl.contains("smpte2084") || tl.contains("arib-std-b67") || tl.contains("hlg") || tl.contains("pq")
    }) || (color_primaries.as_deref().is_some_and(|p| p.to_lowercase().contains("bt2020")) && bit_depth >= 10);

    let empty_tags = serde_json::Map::new();
    let format_tags = format
        .and_then(|f| f.get("tags"))
        .and_then(|t| t.as_object())
        .unwrap_or(&empty_tags);

    let stream_tags = video_stream
        .get("tags")
        .and_then(|t| t.as_object())
        .unwrap_or(&empty_tags);

    let camera_make = format_tags
        .get("make")
        .or_else(|| format_tags.get("com.apple.quicktime.make"))
        .or_else(|| stream_tags.get("make"))
        .and_then(|v| v.as_str())
        .map(String::from);

    let camera_model = format_tags
        .get("model")
        .or_else(|| format_tags.get("com.apple.quicktime.model"))
        .or_else(|| format_tags.get("com.sony.model"))
        .or_else(|| stream_tags.get("model"))
        .and_then(|v| v.as_str())
        .map(String::from);

    let make_model_combined = match (&camera_make, &camera_model) {
        (Some(mk), Some(md)) => Some(format!("{mk} {md}")),
        (Some(mk), None) => Some(mk.clone()),
        (None, Some(md)) => Some(md.clone()),
        _ => None,
    };

    let log_curve = detect_log_curve(
        color_transfer.as_deref(),
        format_tags,
        make_model_combined.as_deref(),
    ).or_else(|| {
        detect_log_curve(color_transfer.as_deref(), stream_tags, make_model_combined.as_deref())
    });

    let creation_time = format_tags
        .get("creation_time")
        .or_else(|| stream_tags.get("creation_time"))
        .and_then(|v| v.as_str())
        .map(String::from);

    // Audio
    let audio_codec = audio_stream
        .and_then(|a| a.get("codec_name"))
        .and_then(|c| c.as_str())
        .map(String::from);

    let audio_channels = audio_stream
        .and_then(|a| a.get("channels"))
        .and_then(|c| c.as_u64())
        .unwrap_or(0) as u32;

    let audio_sample_rate = audio_stream
        .and_then(|a| a.get("sample_rate"))
        .and_then(|s| s.as_str())
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);

    Ok(VideoTechnicalMetadata {
        path: clean_path,
        width,
        height,
        aspect_ratio,
        codec,
        codec_display,
        profile,
        pixel_format,
        bit_depth,
        fps,
        fps_fraction,
        duration_secs,
        bitrate_bps,
        bitrate_display,
        color_space,
        color_transfer,
        color_primaries,
        color_range,
        is_hdr,
        log_curve,
        camera_make,
        camera_model,
        creation_time,
        audio_codec,
        audio_channels,
        audio_sample_rate,
    })
}
