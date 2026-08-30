use std::{fs::File, io::Read, path::Path, process::Command};
use serde::{Deserialize, Serialize};
use crate::infrastructure::converter::find_ffprobe_binary;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
    pub metering_mode: Option<String>,
    pub software: Option<String>,
    pub color_space: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

#[derive(Default)]
struct ParsedExif {
    make: Option<String>,
    model: Option<String>,
    lens: Option<String>,
    date_taken: Option<String>,
    iso: Option<String>,
    aperture: Option<String>,
    shutter: Option<String>,
    focal_length: Option<String>,
    exposure_bias: Option<String>,
    flash: Option<String>,
    white_balance: Option<String>,
    metering_mode: Option<String>,
    software: Option<String>,
    color_space: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
}

/// Lee los metadatos EXIF de una imagen.
/// Primero intenta el extractor nativo de JPEG APP1 / TIFF (sin dependencias externas);
/// si no encuentra todos los datos, intenta ffprobe como complemento.
pub fn read_image_exif(image_path: &Path) -> Result<ImageExifData, String> {
    let clean = image_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");
    let file_name = image_path.file_name().and_then(|f| f.to_str()).unwrap_or("").to_string();
    let file_size_bytes = std::fs::metadata(image_path).map(|m| m.len()).unwrap_or(0);

    let (mut width, mut height) = image::image_dimensions(image_path).unwrap_or((0, 0));
    let format = image_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("IMG")
        .to_uppercase();

    // 1. Intentar parser nativo puro en los primeros 256KB del archivo
    let native_exif = parse_native_file_exif(image_path);

    // 2. Si falta algún dato o ancho/alto son 0, intentar ffprobe como complemento
    let mut ffprobe_exif = ParsedExif::default();
    if native_exif.model.is_none() || width == 0 || height == 0 {
        if let Some(ffprobe) = find_ffprobe_binary() {
            if let Ok(data) = read_exif_ffprobe(&ffprobe, clean) {
                if width == 0 { width = data.0; }
                if height == 0 { height = data.1; }
                ffprobe_exif = data.2;
            }
        }
    }

    let camera_make = native_exif.make.or(ffprobe_exif.make);
    let camera_model = native_exif.model.or(ffprobe_exif.model);
    let lens_model = native_exif.lens.or(ffprobe_exif.lens);
    let date_taken = native_exif.date_taken.or(ffprobe_exif.date_taken);
    let iso = native_exif.iso.or(ffprobe_exif.iso);
    let aperture = native_exif.aperture.or(ffprobe_exif.aperture);
    let shutter_speed = native_exif.shutter.or(ffprobe_exif.shutter);
    let focal_length = native_exif.focal_length.or(ffprobe_exif.focal_length);
    let exposure_bias = native_exif.exposure_bias.or(ffprobe_exif.exposure_bias);
    let flash = native_exif.flash.or(ffprobe_exif.flash);
    let white_balance = native_exif.white_balance.or(ffprobe_exif.white_balance);
    let metering_mode = native_exif.metering_mode.or(ffprobe_exif.metering_mode);
    let software = native_exif.software.or(ffprobe_exif.software);
    let color_space = native_exif.color_space.or(ffprobe_exif.color_space);
    let latitude = native_exif.latitude.or(ffprobe_exif.latitude);
    let longitude = native_exif.longitude.or(ffprobe_exif.longitude);

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
        metering_mode,
        software,
        color_space,
        latitude,
        longitude,
    })
}

fn parse_native_file_exif(path: &Path) -> ParsedExif {
    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return ParsedExif::default(),
    };

    // Leer hasta 256KB iniciales donde se ubica el segmento APP1 EXIF
    let mut buf = vec![0u8; 262_144];
    let n = file.read(&mut buf).unwrap_or(0);
    buf.truncate(n);

    if buf.len() < 16 {
        return ParsedExif::default();
    }

    // JPEG SOI marker
    if buf[0] == 0xFF && buf[1] == 0xD8 {
        parse_jpeg_app1(&buf).unwrap_or_default()
    } else if (buf[0] == b'I' && buf[1] == b'I') || (buf[0] == b'M' && buf[1] == b'M') {
        parse_tiff_header(&buf, 0).unwrap_or_default()
    } else {
        ParsedExif::default()
    }
}

fn parse_jpeg_app1(buf: &[u8]) -> Option<ParsedExif> {
    let mut pos = 2;
    while pos + 4 < buf.len() {
        if buf[pos] != 0xFF {
            break;
        }
        let marker = buf[pos + 1];
        let len = u16::from_be_bytes([buf[pos + 2], buf[pos + 3]]) as usize;
        if len < 2 {
            break;
        }

        // APP1 Marker (0xE1)
        if marker == 0xE1 {
            let data_start = pos + 4;
            let data_end = (pos + 2 + len).min(buf.len());
            let app1 = &buf[data_start..data_end];
            if app1.len() > 6 && &app1[0..6] == b"Exif\0\0" {
                return parse_tiff_header(app1, 6);
            }
        }

        // Si llegamos al inicio del scan (0xDA), terminaron los headers
        if marker == 0xDA {
            break;
        }

        pos += 2 + len;
    }
    None
}

fn parse_tiff_header(buf: &[u8], offset: usize) -> Option<ParsedExif> {
    if buf.len() < offset + 8 {
        return None;
    }
    let tiff = &buf[offset..];
    let is_le = if tiff[0] == b'I' && tiff[1] == b'I' {
        true
    } else if tiff[0] == b'M' && tiff[1] == b'M' {
        false
    } else {
        return None;
    };

    let read_u16 = |slice: &[u8], pos: usize| -> Option<u16> {
        if pos + 2 <= slice.len() {
            if is_le {
                Some(u16::from_le_bytes([slice[pos], slice[pos + 1]]))
            } else {
                Some(u16::from_be_bytes([slice[pos], slice[pos + 1]]))
            }
        } else {
            None
        }
    };

    let read_u32 = |slice: &[u8], pos: usize| -> Option<u32> {
        if pos + 4 <= slice.len() {
            if is_le {
                Some(u32::from_le_bytes([slice[pos], slice[pos + 1], slice[pos + 2], slice[pos + 3]]))
            } else {
                Some(u32::from_be_bytes([slice[pos], slice[pos + 1], slice[pos + 2], slice[pos + 3]]))
            }
        } else {
            None
        }
    };

    let read_i32 = |slice: &[u8], pos: usize| -> Option<i32> {
        if pos + 4 <= slice.len() {
            if is_le {
                Some(i32::from_le_bytes([slice[pos], slice[pos + 1], slice[pos + 2], slice[pos + 3]]))
            } else {
                Some(i32::from_be_bytes([slice[pos], slice[pos + 1], slice[pos + 2], slice[pos + 3]]))
            }
        } else {
            None
        }
    };

    let magic = read_u16(tiff, 2)?;
    if magic != 42 {
        return None;
    }

    let ifd0_offset = read_u32(tiff, 4)? as usize;
    let mut parsed = ParsedExif::default();

    let read_ascii = |tag_pos: usize| -> Option<String> {
        let count = read_u32(tiff, tag_pos + 4)? as usize;
        if count == 0 { return None; }
        let val_offset = if count <= 4 {
            tag_pos + 8
        } else {
            read_u32(tiff, tag_pos + 8)? as usize
        };
        if val_offset + count <= tiff.len() {
            let slice = &tiff[val_offset..val_offset + count];
            let clean = slice.split(|&b| b == 0).next().unwrap_or(slice);
            String::from_utf8(clean.to_vec()).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
        } else {
            None
        }
    };

    let read_rational = |tag_pos: usize| -> Option<(u32, u32)> {
        let val_offset = read_u32(tiff, tag_pos + 8)? as usize;
        if val_offset + 8 <= tiff.len() {
            let num = read_u32(tiff, val_offset)?;
            let den = read_u32(tiff, val_offset + 4)?;
            Some((num, den))
        } else {
            None
        }
    };

    let read_srational = |tag_pos: usize| -> Option<(i32, i32)> {
        let val_offset = read_u32(tiff, tag_pos + 8)? as usize;
        if val_offset + 8 <= tiff.len() {
            let num = read_i32(tiff, val_offset)?;
            let den = read_i32(tiff, val_offset + 4)?;
            Some((num, den))
        } else {
            None
        }
    };

    let mut exif_sub_ifd_offset: Option<usize> = None;
    let mut gps_ifd_offset: Option<usize> = None;

    // 1. Parse IFD0
    if ifd0_offset + 2 <= tiff.len() {
        let num_entries = read_u16(tiff, ifd0_offset)? as usize;
        let mut cur = ifd0_offset + 2;
        for _ in 0..num_entries {
            if cur + 12 > tiff.len() { break; }
            let tag = read_u16(tiff, cur)?;
            match tag {
                0x010F => parsed.make = read_ascii(cur),
                0x0110 => parsed.model = read_ascii(cur),
                0x0131 => parsed.software = read_ascii(cur),
                0x0132 => parsed.date_taken = read_ascii(cur),
                0x8769 => exif_sub_ifd_offset = read_u32(tiff, cur + 8).map(|o| o as usize),
                0x8825 => gps_ifd_offset = read_u32(tiff, cur + 8).map(|o| o as usize),
                _ => {}
            }
            cur += 12;
        }
    }

    // 2. Parse ExifSubIFD (parámetros fotográficos)
    if let Some(sub_offset) = exif_sub_ifd_offset {
        if sub_offset + 2 <= tiff.len() {
            if let Some(num_entries) = read_u16(tiff, sub_offset) {
                let mut cur = sub_offset + 2;
                for _ in 0..num_entries as usize {
                    if cur + 12 > tiff.len() { break; }
                    let tag = match read_u16(tiff, cur) {
                        Some(t) => t,
                        None => break,
                    };
                    match tag {
                        0x829A => { // ExposureTime (Shutter Speed)
                            if let Some((num, den)) = read_rational(cur) {
                                if num > 0 && den > 0 {
                                    if num == 1 || den > num {
                                        let factor = (den as f64 / num as f64).round() as u32;
                                        parsed.shutter = Some(format!("1/{factor} s"));
                                    } else {
                                        let val = num as f64 / den as f64;
                                        parsed.shutter = Some(format!("{val:.1} s"));
                                    }
                                }
                            }
                        }
                        0x829D => { // FNumber (Aperture)
                            if let Some((num, den)) = read_rational(cur) {
                                if den > 0 {
                                    let f = num as f64 / den as f64;
                                    parsed.aperture = Some(format!("f/{f:.1}"));
                                }
                            }
                        }
                        0x8827 => { // ISOSpeedRatings
                            let count = read_u32(tiff, cur + 4).unwrap_or(1);
                            if count >= 1 {
                                let iso_val = read_u16(tiff, cur + 8).unwrap_or(0);
                                if iso_val > 0 {
                                    parsed.iso = Some(format!("{iso_val}"));
                                }
                            }
                        }
                        0x9003 => { // DateTimeOriginal
                            if let Some(d) = read_ascii(cur) {
                                parsed.date_taken = Some(d);
                            }
                        }
                        0x920A => { // FocalLength
                            if let Some((num, den)) = read_rational(cur) {
                                if den > 0 {
                                    let mm = (num as f64 / den as f64).round() as u32;
                                    parsed.focal_length = Some(format!("{mm} mm"));
                                }
                            }
                        }
                        0x9204 => { // ExposureBiasValue
                            if let Some((num, den)) = read_srational(cur) {
                                if den != 0 {
                                    let bias = num as f64 / den as f64;
                                    parsed.exposure_bias = Some(format!("{bias:+.1} EV"));
                                }
                            }
                        }
                        0x9209 => { // Flash
                            let flash_val = read_u16(tiff, cur + 8).unwrap_or(0);
                            parsed.flash = Some(if flash_val & 1 != 0 {
                                "Disparado".to_string()
                            } else {
                                "No disparado".to_string()
                            });
                        }
                        0x9207 => { // MeteringMode
                            let mode_val = read_u16(tiff, cur + 8).unwrap_or(0);
                            parsed.metering_mode = match mode_val {
                                1 => Some("Promedio".into()),
                                2 => Some("Ponderado al centro".into()),
                                3 => Some("Puntual (Spot)".into()),
                                4 => Some("Multi-spot".into()),
                                5 => Some("Matricial (Patrón)".into()),
                                6 => Some("Parcial".into()),
                                _ => None,
                            };
                        }
                        0xA405 => { // WhiteBalance
                            let wb_val = read_u16(tiff, cur + 8).unwrap_or(0);
                            parsed.white_balance = match wb_val {
                                0 => Some("Automático".into()),
                                1 => Some("Manual / Personalizado".into()),
                                _ => None,
                            };
                        }
                        0xA001 => { // ColorSpace
                            let cs_val = read_u16(tiff, cur + 8).unwrap_or(0);
                            parsed.color_space = match cs_val {
                                1 => Some("sRGB".into()),
                                65535 => Some("Adobe RGB / No calibrado".into()),
                                _ => None,
                            };
                        }
                        0xA434 => { // LensModel
                            parsed.lens = read_ascii(cur);
                        }
                        _ => {}
                    }
                    cur += 12;
                }
            }
        }
    }

    // 3. Parse GPS IFD si existe
    if let Some(gps_offset) = gps_ifd_offset {
        if gps_offset + 2 <= tiff.len() {
            if let Some(num_entries) = read_u16(tiff, gps_offset) {
                let mut cur = gps_offset + 2;
                let mut lat_ref = 'N';
                let mut lon_ref = 'E';
                let mut lat_deg = 0.0;
                let mut lon_deg = 0.0;
                let mut has_lat = false;
                let mut has_lon = false;

                for _ in 0..num_entries as usize {
                    if cur + 12 > tiff.len() { break; }
                    let tag = match read_u16(tiff, cur) {
                        Some(t) => t,
                        None => break,
                    };
                    match tag {
                        0x0001 => { // GPSLatitudeRef
                            if let Some(c) = tiff.get(cur + 8) {
                                lat_ref = *c as char;
                            }
                        }
                        0x0002 => { // GPSLatitude (3 rationals)
                            if let Some(offset) = read_u32(tiff, cur + 8) {
                                let o = offset as usize;
                                if o + 24 <= tiff.len() {
                                    let d_num = read_u32(tiff, o).unwrap_or(0);
                                    let d_den = read_u32(tiff, o + 4).unwrap_or(1);
                                    let m_num = read_u32(tiff, o + 8).unwrap_or(0);
                                    let m_den = read_u32(tiff, o + 12).unwrap_or(1);
                                    let s_num = read_u32(tiff, o + 16).unwrap_or(0);
                                    let s_den = read_u32(tiff, o + 20).unwrap_or(1);

                                    let deg = d_num as f64 / d_den.max(1) as f64;
                                    let min = m_num as f64 / m_den.max(1) as f64;
                                    let sec = s_num as f64 / s_den.max(1) as f64;
                                    lat_deg = deg + (min / 60.0) + (sec / 3600.0);
                                    has_lat = true;
                                }
                            }
                        }
                        0x0003 => { // GPSLongitudeRef
                            if let Some(c) = tiff.get(cur + 8) {
                                lon_ref = *c as char;
                            }
                        }
                        0x0004 => { // GPSLongitude (3 rationals)
                            if let Some(offset) = read_u32(tiff, cur + 8) {
                                let o = offset as usize;
                                if o + 24 <= tiff.len() {
                                    let d_num = read_u32(tiff, o).unwrap_or(0);
                                    let d_den = read_u32(tiff, o + 4).unwrap_or(1);
                                    let m_num = read_u32(tiff, o + 8).unwrap_or(0);
                                    let m_den = read_u32(tiff, o + 12).unwrap_or(1);
                                    let s_num = read_u32(tiff, o + 16).unwrap_or(0);
                                    let s_den = read_u32(tiff, o + 20).unwrap_or(1);

                                    let deg = d_num as f64 / d_den.max(1) as f64;
                                    let min = m_num as f64 / m_den.max(1) as f64;
                                    let sec = s_num as f64 / s_den.max(1) as f64;
                                    lon_deg = deg + (min / 60.0) + (sec / 3600.0);
                                    has_lon = true;
                                }
                            }
                        }
                        _ => {}
                    }
                    cur += 12;
                }

                if has_lat {
                    if lat_ref == 'S' { lat_deg = -lat_deg; }
                    parsed.latitude = Some((lat_deg * 100000.0).round() / 100000.0);
                }
                if has_lon {
                    if lon_ref == 'W' { lon_deg = -lon_deg; }
                    parsed.longitude = Some((lon_deg * 100000.0).round() / 100000.0);
                }
            }
        }
    }

    Some(parsed)
}

fn read_exif_ffprobe(ffprobe: &Path, clean: &str) -> Result<(u32, u32, ParsedExif), String> {
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

    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("ffprobe falló".into());
    }

    let json_val: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;
    let streams = json_val["streams"].as_array();
    let video_stream = streams.and_then(|s| s.iter().find(|st| st["codec_type"].as_str() == Some("video")));

    let width = video_stream.and_then(|s| s["width"].as_u64()).unwrap_or(0) as u32;
    let height = video_stream.and_then(|s| s["height"].as_u64()).unwrap_or(0) as u32;

    let tags = json_val["format"]["tags"].as_object();
    let stream_tags = video_stream.and_then(|s| s["tags"].as_object());

    let get_tag = |key: &str| -> Option<String> {
        tags.and_then(|t| t.get(key).or_else(|| t.get(&key.to_lowercase())).or_else(|| t.get(&key.to_uppercase())))
            .or_else(|| stream_tags.and_then(|st| st.get(key).or_else(|| st.get(&key.to_lowercase())).or_else(|| st.get(&key.to_uppercase()))))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    };

    let make = get_tag("make");
    let model = get_tag("model");
    let lens = get_tag("lens_model").or_else(|| get_tag("LensModel"));
    let date_taken = get_tag("creation_time").or_else(|| get_tag("DateTimeOriginal"));
    let iso = get_tag("iso");
    let aperture = get_tag("f_number").map(|a| if a.starts_with('f') { a } else { format!("f/{a}") });
    let shutter = get_tag("exposure_time");
    let focal_length = get_tag("focal_length").map(|fl| if fl.ends_with("mm") { fl } else { format!("{fl} mm") });
    let software = get_tag("software");

    Ok((
        width,
        height,
        ParsedExif {
            make,
            model,
            lens,
            date_taken,
            iso,
            aperture,
            shutter,
            focal_length,
            exposure_bias: None,
            flash: None,
            white_balance: None,
            metering_mode: None,
            software,
            color_space: None,
            latitude: None,
            longitude: None,
        },
    ))
}

fn gcd(mut a: u32, mut b: u32) -> u32 {
    while b != 0 {
        let t = b;
        b = a % b;
        a = t;
    }
    if a == 0 { 1 } else { a }
}
