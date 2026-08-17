use std::{path::Path, process::Command};
use serde::{Deserialize, Serialize};
use crate::infrastructure::converter::find_ffprobe_binary;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageExifData {
    pub path: String,
    pub file_name: String,
    pub file_size_bytes: u64,
    pub format: String,
    pub width: u32,
    pub height: u32,
    pub aspect_ratio: String,
    pub megapixels: f32,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens_model: Option<String>,
    pub date_taken: Option<String>,
    pub iso: Option<String>,
    pub aperture: Option<String>,
    pub shutter_speed: Option<String>,
    pub focal_length: Option<String>,
    pub exposure_bias: Option<String>,
    pub flash: Option<String>,
    pub white_balance: Option<String>,
    pub software: Option<String>,
    pub color_space: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

pub fn read_image_exif(image_path: &Path) -> Result<ImageExifData, String> {
    let clean = image_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");
    let file_name = image_path.file_name().and_then(|f| f.to_str()).unwrap_or("").to_string();
    let file_size_bytes = std::fs::metadata(image_path).map(|m| m.len()).unwrap_or(0);

    let ffprobe = find_ffprobe_binary().ok_or("ffprobe no disponible")?;

    let mut cmd = Command::new(ffprobe);
    cmd.args([
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        clean,
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd.output().map_err(|e| format!("Error ejecutando ffprobe: {e}"))?;
    if !output.status.success() {
        return Err("No se pudo obtener información de la imagen".to_string());
    }

    let json_val: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Error parseando salida JSON de ffprobe: {e}"))?;

    let streams = json_val["streams"].as_array();
    let video_stream = streams.and_then(|s| s.iter().find(|st| st["codec_type"].as_str() == Some("video")));

    let width = video_stream.and_then(|s| s["width"].as_u64()).unwrap_or(0) as u32;
    let height = video_stream.and_then(|s| s["height"].as_u64()).unwrap_or(0) as u32;
    let format = video_stream
        .and_then(|s| s["codec_name"].as_str())
        .or_else(|| json_val["format"]["format_name"].as_str())
        .unwrap_or("Desconocido")
        .to_uppercase();

    let megapixels = if width > 0 && height > 0 {
        ((width as f64 * height as f64) / 1_000_000.0 * 10.0).round() as f32 / 10.0
    } else {
        0.0
    };

    let aspect_ratio = if width > 0 && height > 0 {
        let gcd = gcd(width, height);
        format!("{}:{}", width / gcd, height / gcd)
    } else {
        "1:1".to_string()
    };

    let tags = json_val["format"]["tags"].as_object();
    let stream_tags = video_stream.and_then(|s| s["tags"].as_object());

    let get_tag = |key: &str| -> Option<String> {
        tags.and_then(|t| t.get(key).or_else(|| t.get(&key.to_lowercase())).or_else(|| t.get(&key.to_uppercase())))
            .or_else(|| stream_tags.and_then(|st| st.get(key).or_else(|| st.get(&key.to_lowercase())).or_else(|| st.get(&key.to_uppercase()))))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    };

    let camera_make = get_tag("make").or_else(|| get_tag("Make"));
    let camera_model = get_tag("model").or_else(|| get_tag("Model"));
    let lens_model = get_tag("lens_model").or_else(|| get_tag("LensModel")).or_else(|| get_tag("Lens"));
    let date_taken = get_tag("creation_time")
        .or_else(|| get_tag("date:create"))
        .or_else(|| get_tag("DateTimeOriginal"))
        .or_else(|| get_tag("DateTime"));
    let iso = get_tag("iso").or_else(|| get_tag("ISO")).or_else(|| get_tag("photographic_sensitivity"));
    let aperture = get_tag("f_number").or_else(|| get_tag("FNumber")).or_else(|| get_tag("ApertureValue")).map(|a| {
        if a.starts_with('f') || a.starts_with('F') { a } else { format!("f/{a}") }
    });
    let shutter_speed = get_tag("exposure_time").or_else(|| get_tag("ExposureTime")).or_else(|| get_tag("ShutterSpeedValue"));
    let focal_length = get_tag("focal_length").or_else(|| get_tag("FocalLength")).map(|fl| {
        if fl.ends_with("mm") { fl } else { format!("{fl} mm") }
    });
    let exposure_bias = get_tag("exposure_bias_value").or_else(|| get_tag("ExposureBiasValue"));
    let flash = get_tag("flash").or_else(|| get_tag("Flash"));
    let white_balance = get_tag("white_balance").or_else(|| get_tag("WhiteBalance"));
    let software = get_tag("software").or_else(|| get_tag("Software"));
    let color_space = get_tag("color_space").or_else(|| get_tag("ColorSpace"));

    Ok(ImageExifData {
        path: clean.to_string(),
        file_name,
        file_size_bytes,
        format,
        width,
        height,
        aspect_ratio,
        megapixels,
        camera_make,
        camera_model,
        lens_model,
        date_taken,
        iso,
        aperture,
        shutter_speed,
        focal_length,
        exposure_bias,
        flash,
        white_balance,
        software,
        color_space,
        latitude: None,
        longitude: None,
    })
}

fn gcd(mut a: u32, mut b: u32) -> u32 {
    while b != 0 {
        let t = b;
        b = a % b;
        a = t;
    }
    if a == 0 { 1 } else { a }
}
