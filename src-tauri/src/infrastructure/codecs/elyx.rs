use std::{
    fs::File,
    io::{BufReader, Read},
    path::Path,
};

use image::RgbImage;
use serde::Deserialize;
use sha2::{Digest, Sha256};

pub const ELYX_MAGIC: &[u8; 8] = b"ELYX\r\n\x1a\n";
const MAX_PIXELS: u64 = 60_000_000;

fn default_tile() -> u32 {
    0
}

fn default_levels() -> u32 {
    3
}

fn default_step() -> u32 {
    1
}

fn default_chroma_ratio() -> f64 {
    2.0
}

#[derive(Debug, Clone, Deserialize)]
pub struct ElyxHeader {
    pub version: u32,
    pub width: u32,
    pub height: u32,
    pub mode: String,
    #[serde(default = "default_tile")]
    pub tile: u32,
    #[serde(default = "default_levels")]
    pub levels: u32,
    #[serde(default = "default_step")]
    pub step: u32,
    pub color: String,
    pub wavelet: String,
    pub entropy: String,
    #[serde(default)]
    #[allow(dead_code)]
    pub orig_width: Option<u32>,
    #[serde(default)]
    #[allow(dead_code)]
    pub orig_height: Option<u32>,
    #[serde(default = "default_chroma_ratio")]
    pub chroma_ratio: f64,
    pub pixel_sha256: Option<String>,
}

fn get_subband_step_v2(base_step: u32, level: usize, is_chroma: bool, chroma_ratio: f64, is_hh: bool) -> i32 {
    if base_step <= 1 {
        return 1;
    }
    let level_multipliers = [1.85, 1.15, 0.75];
    let mult = if level < level_multipliers.len() {
        level_multipliers[level]
    } else {
        1.0
    };
    let mut q = base_step as f64 * mult;
    if is_chroma {
        q *= chroma_ratio;
    }
    if is_hh {
        q *= 1.65;
    }
    (q.round() as i32).max(1)
}

#[inline]
fn dequantize_centroid_v2(qv: i32, q: i32) -> i32 {
    if q <= 1 || qv == 0 {
        return qv;
    }
    let threshold = (q as f64 * 1.35).floor();
    let sign = if qv < 0 { -1.0 } else { 1.0 };
    let abs_q = qv.abs() as f64;
    (sign * (threshold + (abs_q - 0.65) * q as f64).round()) as i32
}

fn unpack_and_inverse_wavelet_2d_v2(
    flat: &[i32],
    offset: usize,
    w: usize,
    h: usize,
    levels: u32,
    base_step: u32,
    is_chroma: bool,
    chroma_ratio: f64,
) -> (Vec<i32>, usize) {
    let mut plane = vec![0i32; w * h];
    let fh = h >> levels;
    let fw = w >> levels;
    let mut pos = offset;

    // 1. Reconstrucción de la sub-banda LL con predictor MED (JPEG-LS)
    let mut ll_rec = vec![0i32; fh * fw];
    for y in 0..fh {
        for x in 0..fw {
            let diff = flat[pos];
            pos += 1;
            let pred = if x > 0 && y > 0 {
                let left = ll_rec[y * fw + (x - 1)];
                let top = ll_rec[(y - 1) * fw + x];
                let top_left = ll_rec[(y - 1) * fw + (x - 1)];
                let min_lt = left.min(top);
                let max_lt = left.max(top);
                if top_left >= max_lt {
                    min_lt
                } else if top_left <= min_lt {
                    max_lt
                } else {
                    left + top - top_left
                }
            } else if x > 0 {
                ll_rec[y * fw + (x - 1)]
            } else if y > 0 {
                ll_rec[(y - 1) * fw + x]
            } else {
                0
            };

            let val = diff + pred;
            ll_rec[y * fw + x] = val;
            plane[y * w + x] = val;
        }
    }

    // 2. Desempacar y descuantizar sub-bandas HL, LH, HH por nivel
    for lev in 0..(levels as usize) {
        let hh = h >> lev;
        let ww = w >> lev;
        let hy = hh >> 1;
        let hx = ww >> 1;
        let b_len = hy * hx;

        let q_hl = get_subband_step_v2(base_step, lev, is_chroma, chroma_ratio, false);
        let q_hh = get_subband_step_v2(base_step, lev, is_chroma, chroma_ratio, true);

        // Sub-banda HL (arriba-derecha)
        for y in 0..hy {
            let top_off = y * w;
            for x in 0..hx {
                let qv = flat[pos + y * hx + x];
                plane[top_off + (x + hx)] = if base_step > 1 {
                    dequantize_centroid_v2(qv, q_hl)
                } else {
                    qv
                };
            }
        }
        pos += b_len;

        // Sub-banda LH (abajo-izquierda)
        for y in 0..hy {
            let bot_off = (y + hy) * w;
            for x in 0..hx {
                let qv = flat[pos + y * hx + x];
                plane[bot_off + x] = if base_step > 1 {
                    dequantize_centroid_v2(qv, q_hl)
                } else {
                    qv
                };
            }
        }
        pos += b_len;

        // Sub-banda HH (abajo-derecha)
        for y in 0..hy {
            let bot_off = (y + hy) * w;
            for x in 0..hx {
                let qv = flat[pos + y * hx + x];
                plane[bot_off + (x + hx)] = if base_step > 1 {
                    dequantize_centroid_v2(qv, q_hh)
                } else {
                    qv
                };
            }
        }
        pos += b_len;
    }

    // 3. Transformada Wavelet Inversa CDF 5/3 2D (columnas primero, luego filas)
    let mut col_buf = vec![0i32; h];
    let mut row_buf = vec![0i32; w];

    for lev in (0..levels).rev() {
        let hh = (h >> lev) as usize;
        let ww = (w >> lev) as usize;

        // Columnas
        for x in 0..ww {
            for y in 0..hh {
                col_buf[y] = plane[y * w + x];
            }
            lift_1d_inverse(&mut col_buf[..hh]);
            for y in 0..hh {
                plane[y * w + x] = col_buf[y];
            }
        }

        // Filas
        for y in 0..hh {
            let row_off = y * w;
            for x in 0..ww {
                row_buf[x] = plane[row_off + x];
            }
            lift_1d_inverse(&mut row_buf[..ww]);
            for x in 0..ww {
                plane[row_off + x] = row_buf[x];
            }
        }
    }

    (plane, pos)
}

fn lift_1d_inverse(signal: &mut [i32]) {
    let len = signal.len();
    if len < 2 {
        return;
    }
    let n = len / 2;

    let s = signal[0..n].to_vec();
    let d = signal[n..2 * n].to_vec();

    let mut e = vec![0i32; n];
    for i in 0..n {
        let prev = if i == 0 { d[0] } else { d[i - 1] };
        e[i] = s[i] - ((prev + d[i] + 2) >> 2);
    }

    let mut odd = vec![0i32; n];
    for i in 0..n {
        let nxt = if i + 1 < n { e[i + 1] } else { e[n - 1] };
        odd[i] = d[i] + ((e[i] + nxt) >> 1);
    }

    for i in 0..n {
        signal[2 * i] = e[i];
        signal[2 * i + 1] = odd[i];
    }
}

fn inverse_transform_channel(chan: &mut [i32], ph: usize, pw: usize, levels: u32, step: u32) {
    let mut col_buf = Vec::new();
    for lev in (0..levels).rev() {
        let cur_hh = ph >> lev;
        let cur_ww = pw >> lev;
        let hy = cur_hh / 2;
        let hx = cur_ww / 2;

        if step > 1 {
            // Unquantize detail bands
            for r in 0..hy {
                for c in hx..cur_ww {
                    chan[r * pw + c] *= step as i32;
                }
            }
            for r in hy..cur_hh {
                for c in 0..cur_ww {
                    chan[r * pw + c] *= step as i32;
                }
            }
        }

        // 1. Invert columns (axis 0)
        col_buf.resize(cur_hh, 0);
        for c in 0..cur_ww {
            for r in 0..cur_hh {
                col_buf[r] = chan[r * pw + c];
            }
            lift_1d_inverse(&mut col_buf);
            for r in 0..cur_hh {
                chan[r * pw + c] = col_buf[r];
            }
        }

        // 2. Invert rows (axis 1)
        for r in 0..cur_hh {
            let row_slice = &mut chan[r * pw..r * pw + cur_ww];
            lift_1d_inverse(row_slice);
        }
    }
}

/// ElyX v1 RGB8 sin pérdidas; compatible con el decodificador existente.
/// Teselas de 512, CDF 5/3 de tres niveles, YCoCg-R y DEFLATE.
pub fn encode_elyx(image: &RgbImage) -> Result<Vec<u8>, String> {
    let (width, height) = image.dimensions();
    if width == 0 || height == 0 || width as u64 * height as u64 > MAX_PIXELS {
        return Err("ElyX admite imágenes de 1 a 60 millones de píxeles".into());
    }
    let header = serde_json::json!({
        "version": 1, "width": width, "height": height, "mode": "RGB8",
        "tile": 512, "levels": 3, "step": 1, "color": "YCoCg-R",
        "wavelet": "CDF53", "entropy": "zigzag16-byteplanes-deflate",
        "pixel_sha256": format!("{:x}", Sha256::digest(image.as_raw())),
    });
    let header = serde_json::to_vec(&header).map_err(|e| e.to_string())?;
    let mut output = Vec::new();
    output.extend_from_slice(ELYX_MAGIC);
    output.extend_from_slice(&(header.len() as u32).to_le_bytes());
    output.extend_from_slice(&header);
    for y in (0..height).step_by(512) {
        for x in (0..width).step_by(512) {
            let hh = (height - y).min(512) as usize;
            let ww = (width - x).min(512) as usize;
            let ph = hh.div_ceil(8) * 8;
            let pw = ww.div_ceil(8) * 8;
            let mut channels = vec![vec![0i32; ph * pw]; 3];
            for r in 0..ph {
                for c in 0..pw {
                    let pixel = image.get_pixel(x + c.min(ww - 1) as u32, y + r.min(hh - 1) as u32).0;
                    let co = pixel[0] as i32 - pixel[2] as i32;
                    let t = pixel[2] as i32 + (co >> 1);
                    let cg = pixel[1] as i32 - t;
                    channels[0][r * pw + c] = t + (cg >> 1);
                    channels[1][r * pw + c] = co;
                    channels[2][r * pw + c] = cg;
                }
            }
            for channel in &mut channels {
                for level in 0..3 {
                    let h = ph >> level;
                    let w = pw >> level;
                    // La transformada directa aplica filas y después columnas.
                    for r in 0..h { lift_1d_forward(&mut channel[r * pw..r * pw + w]); }
                    let mut column = vec![0i32; h];
                    for c in 0..w {
                        for r in 0..h { column[r] = channel[r * pw + c]; }
                        lift_1d_forward(&mut column);
                        for r in 0..h { channel[r * pw + c] = column[r]; }
                    }
                }
            }
            let n = ph * pw * 3;
            let mut raw = vec![0u8; n * 2];
            for (i, value) in channels.iter().flatten().enumerate() {
                if !(-32768..=32767).contains(value) { return Err("Coeficiente ElyX fuera de rango".into()); }
                let zigzag = ((value << 1) ^ (value >> 31)) as u16;
                raw[i] = zigzag as u8;
                raw[n + i] = (zigzag >> 8) as u8;
            }
            let compressed = miniz_oxide::deflate::compress_to_vec_zlib(&raw, 6);
            output.extend_from_slice(&(compressed.len() as u32).to_le_bytes());
            output.extend_from_slice(&crc32fast::hash(&raw).to_le_bytes());
            output.extend_from_slice(&compressed);
        }
    }
    Ok(output)
}

fn lift_1d_forward(signal: &mut [i32]) {
    let n = signal.len() / 2;
    if n == 0 { return; }
    let mut even: Vec<i32> = signal.iter().step_by(2).copied().collect();
    let mut detail: Vec<i32> = signal.iter().skip(1).step_by(2).copied().collect();
    for i in 0..n { detail[i] -= (even[i] + even[(i + 1).min(n - 1)]) >> 1; }
    for i in 0..n { even[i] += (detail[i.saturating_sub(1)] + detail[i] + 2) >> 2; }
    signal[..n].copy_from_slice(&even);
    signal[n..].copy_from_slice(&detail);
}

pub fn decode_elyx_from_reader<R: Read>(mut r: R) -> Result<(RgbImage, ElyxHeader), String> {
    let mut magic = [0u8; 8];
    r.read_exact(&mut magic)
        .map_err(|e| format!("Error leyendo firma ELYX: {e}"))?;
    if &magic != ELYX_MAGIC {
        return Err("Firma ELYX inválida".to_string());
    }

    let mut hn_bytes = [0u8; 4];
    r.read_exact(&mut hn_bytes)
        .map_err(|e| format!("Error leyendo tamaño de cabecera: {e}"))?;
    let hn = u32::from_le_bytes(hn_bytes) as usize;
    if !(2..=65536).contains(&hn) {
        return Err("Cabecera excesiva o inválida".to_string());
    }

    let mut header_buf = vec![0u8; hn];
    r.read_exact(&mut header_buf)
        .map_err(|e| format!("Error leyendo cabecera JSON: {e}"))?;

    let header: ElyxHeader = serde_json::from_slice(&header_buf)
        .map_err(|e| format!("Error parseando cabecera JSON ELYX: {e}"))?;

    if (header.version != 1 && header.version != 2)
        || header.mode != "RGB8"
        || header.color != "YCoCg-R"
        || header.entropy != "zigzag16-byteplanes-deflate"
    {
        return Err("Versión o herramientas no compatibles en ElyX".to_string());
    }

    if header.version == 1 && header.wavelet != "CDF53" {
        return Err(format!("Wavelet no compatible en ElyX v1: {}", header.wavelet));
    }

    if header.version == 2 && header.wavelet != "CDF53-2D-MED-deadzone" && header.wavelet != "CDF53" {
        return Err(format!("Wavelet no compatible en ElyX v2: {}", header.wavelet));
    }

    let w = header.width as usize;
    let ht = header.height as usize;
    let tile = header.tile as usize;
    let levels = header.levels;
    let step = header.step;

    if w < 1 || ht < 1 || (w as u64 * ht as u64) > MAX_PIXELS {
        return Err("Dimensiones inválidas o superiores a 60 MP".to_string());
    }
    if !(1..=64).contains(&step) || !(1..=4).contains(&levels) {
        return Err("Parámetros de compresión ElyX inválidos".to_string());
    }

    // Ruta para ElyX v2 de bloque global (tile == 0)
    if header.version == 2 && tile == 0 {
        let n = w * ht * 3;
        let expected = n * 2;

        let mut block_header = [0u8; 8];
        r.read_exact(&mut block_header)
            .map_err(|e| format!("Archivo ELYX v2 truncado al leer cabecera de bloque: {e}"))?;
        let size = u32::from_le_bytes(block_header[0..4].try_into().unwrap()) as usize;
        let crc = u32::from_le_bytes(block_header[4..8].try_into().unwrap());

        if size < 1 || size > expected + 65536 {
            return Err("Bloque de compresión excesivo o corrupto en ElyX v2".to_string());
        }

        let mut payload = vec![0u8; size];
        r.read_exact(&mut payload)
            .map_err(|e| format!("Error leyendo payload de bloque global v2: {e}"))?;

        let decompressed = miniz_oxide::inflate::decompress_to_vec_zlib(&payload)
            .map_err(|e| format!("Error descomprimiendo DEFLATE global en ElyX v2: {e:?}"))?;

        if decompressed.len() != expected {
            return Err(format!(
                "Longitud inválida de bytes descomprimidos en ElyX v2: esperados {expected}, obtenidos {}",
                decompressed.len()
            ));
        }

        let computed_crc = crc32fast::hash(&decompressed);
        if computed_crc != crc {
            return Err("CRC32 corrupto en bloque global de ElyX v2".to_string());
        }

        let lo = &decompressed[0..n];
        let hi = &decompressed[n..2 * n];
        let mut flat = vec![0i32; n];
        for i in 0..n {
            let zz = (lo[i] as u32) | ((hi[i] as u32) << 8);
            flat[i] = ((zz >> 1) as i32) ^ (-((zz & 1) as i32));
        }

        let (y_plane, off1) = unpack_and_inverse_wavelet_2d_v2(
            &flat, 0, w, ht, levels, step, false, header.chroma_ratio,
        );
        let (co_plane, off2) = unpack_and_inverse_wavelet_2d_v2(
            &flat, off1, w, ht, levels, step, true, header.chroma_ratio,
        );
        let (cg_plane, _) = unpack_and_inverse_wavelet_2d_v2(
            &flat, off2, w, ht, levels, step, true, header.chroma_ratio,
        );

        let mut dst = RgbImage::new(header.width, header.height);
        for y_idx in 0..ht {
            let row_off = y_idx * w;
            for x_idx in 0..w {
                let p = row_off + x_idx;
                let y_val = y_plane[p];
                let co_val = co_plane[p];
                let cg_val = cg_plane[p];

                let t = y_val - (cg_val >> 1);
                let g = cg_val + t;
                let b = t - (co_val >> 1);
                let red = co_val + b;

                let px = dst.get_pixel_mut(x_idx as u32, y_idx as u32);
                px.0[0] = red.clamp(0, 255) as u8;
                px.0[1] = g.clamp(0, 255) as u8;
                px.0[2] = b.clamp(0, 255) as u8;
            }
        }

        let mut leftover = [0u8; 1];
        if r.read(&mut leftover).unwrap_or(0) > 0 {
            return Err("Datos sobrantes al final del archivo ELYX v2".to_string());
        }

        if step == 1 {
            if let Some(ref expected_sha) = header.pixel_sha256 {
                let mut hasher = Sha256::new();
                for chunk_y in (0..ht).step_by(128) {
                    let strip_h = (ht - chunk_y).min(128);
                    for sy in 0..strip_h {
                        for sx in 0..w {
                            let px = dst.get_pixel(sx as u32, (chunk_y + sy) as u32);
                            hasher.update(px.0);
                        }
                    }
                }
                let actual_sha = format!("{:x}", hasher.finalize());
                if &actual_sha != expected_sha {
                    return Err(format!(
                        "SHA256 de píxeles no coincide en modo sin pérdida: esperada {expected_sha}, obtenida {actual_sha}"
                    ));
                }
            }
        }

        return Ok((dst, header));
    }

    if !(32..=1024).contains(&tile) || (tile % (1 << levels) != 0) {
        return Err("Parámetros de compresión ElyX inválidos (tesela no válida)".to_string());
    }

    let unit = 1 << levels;
    let mut dst = RgbImage::new(header.width, header.height);

    for y in (0..ht).step_by(tile) {
        for x in (0..w).step_by(tile) {
            let hh = (ht - y).min(tile);
            let ww = (w - x).min(tile);
            let ph = hh + (-(hh as isize)).rem_euclid(unit as isize) as usize;
            let pw = ww + (-(ww as isize)).rem_euclid(unit as isize) as usize;

            let n = ph * pw * 3;
            let expected = n * 2;

            let mut block_header = [0u8; 8];
            r.read_exact(&mut block_header)
                .map_err(|e| format!("Archivo ELYX truncado al leer tesela ({x},{y}): {e}"))?;
            let size = u32::from_le_bytes(block_header[0..4].try_into().unwrap()) as usize;
            let crc = u32::from_le_bytes(block_header[4..8].try_into().unwrap());

            if size < 1 || size > expected + 65536 {
                return Err(format!("Bloque excesivo en tesela ({x},{y})"));
            }

            let mut payload = vec![0u8; size];
            r.read_exact(&mut payload)
                .map_err(|e| format!("Error leyendo payload de tesela ({x},{y}): {e}"))?;

            let decompressed = miniz_oxide::inflate::decompress_to_vec_zlib(&payload)
                .map_err(|e| format!("Error descomprimiendo DEFLATE en ({x},{y}): {e:?}"))?;

            if decompressed.len() != expected {
                return Err(format!(
                    "Longitud inválida de bytes descomprimidos en ({x},{y})"
                ));
            }

            let computed_crc = crc32fast::hash(&decompressed);
            if computed_crc != crc {
                return Err(format!("CRC32 corrupto en tesela ({x},{y})"));
            }

            let lo = &decompressed[0..n];
            let hi = &decompressed[n..2 * n];

            let mut y_chan = vec![0i32; ph * pw];
            let mut co_chan = vec![0i32; ph * pw];
            let mut cg_chan = vec![0i32; ph * pw];

            let plane_size = ph * pw;
            for i in 0..plane_size {
                let zz0 = (lo[i] as u32) | ((hi[i] as u32) << 8);
                y_chan[i] = ((zz0 >> 1) as i32) ^ (-((zz0 & 1) as i32));

                let idx1 = plane_size + i;
                let zz1 = (lo[idx1] as u32) | ((hi[idx1] as u32) << 8);
                co_chan[i] = ((zz1 >> 1) as i32) ^ (-((zz1 & 1) as i32));

                let idx2 = 2 * plane_size + i;
                let zz2 = (lo[idx2] as u32) | ((hi[idx2] as u32) << 8);
                cg_chan[i] = ((zz2 >> 1) as i32) ^ (-((zz2 & 1) as i32));
            }

            // Transformada inversa CDF 5/3 en cada canal
            inverse_transform_channel(&mut y_chan, ph, pw, levels, step);
            inverse_transform_channel(&mut co_chan, ph, pw, levels, step);
            inverse_transform_channel(&mut cg_chan, ph, pw, levels, step);

            // Reversión de color YCoCg-R a RGB y volcado a dst
            for r_idx in 0..hh {
                for c_idx in 0..ww {
                    let idx = r_idx * pw + c_idx;
                    let y_val = y_chan[idx];
                    let co_val = co_chan[idx];
                    let cg_val = cg_chan[idx];

                    let t = y_val - (cg_val >> 1);
                    let g = cg_val + t;
                    let b = t - (co_val >> 1);
                    let red = co_val + b;

                    let px = dst.get_pixel_mut((x + c_idx) as u32, (y + r_idx) as u32);
                    px.0[0] = red.clamp(0, 255) as u8;
                    px.0[1] = g.clamp(0, 255) as u8;
                    px.0[2] = b.clamp(0, 255) as u8;
                }
            }
        }
    }

    let mut leftover = [0u8; 1];
    if r.read(&mut leftover).unwrap_or(0) > 0 {
        return Err("Datos sobrantes al final del archivo ELYX".to_string());
    }

    // Validación de SHA256 en lossless (step == 1) si está presente
    if step == 1 {
        if let Some(ref expected_sha) = header.pixel_sha256 {
            let mut hasher = Sha256::new();
            for chunk_y in (0..ht).step_by(128) {
                let strip_h = (ht - chunk_y).min(128);
                for sy in 0..strip_h {
                    for sx in 0..w {
                        let px = dst.get_pixel(sx as u32, (chunk_y + sy) as u32);
                        hasher.update(px.0);
                    }
                }
            }
            let actual_sha = format!("{:x}", hasher.finalize());
            if &actual_sha != expected_sha {
                return Err(format!(
                    "SHA256 de píxeles no coincide en modo sin pérdida: esperada {expected_sha}, obtenida {actual_sha}"
                ));
            }
        }
    }

    Ok((dst, header))
}

pub fn decode_elyx_file(path: &Path) -> Result<(RgbImage, ElyxHeader), String> {
    let f = File::open(path).map_err(|e| format!("No se pudo abrir el archivo {}: {e}", path.display()))?;
    let reader = BufReader::new(f);
    decode_elyx_from_reader(reader)
}

pub fn read_elyx_dimensions(path: &Path) -> Option<(u32, u32)> {
    let f = File::open(path).ok()?;
    let mut r = BufReader::new(f);
    let mut magic = [0u8; 8];
    r.read_exact(&mut magic).ok()?;
    if &magic != ELYX_MAGIC {
        return None;
    }
    let mut hn_bytes = [0u8; 4];
    r.read_exact(&mut hn_bytes).ok()?;
    let hn = u32::from_le_bytes(hn_bytes) as usize;
    if !(2..=65536).contains(&hn) {
        return None;
    }
    let mut header_buf = vec![0u8; hn];
    r.read_exact(&mut header_buf).ok()?;
    let header: ElyxHeader = serde_json::from_slice(&header_buf).ok()?;
    Some((header.width, header.height))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_decode_rgb_1_1_s1() {
        let p = PathBuf::from(r"D:\Imágenes\ELYX_nativo_20261017_181309\pruebas\rgb_1_1_s1.elx");
        if p.exists() {
            let (img, header) = decode_elyx_file(&p).expect("Fallo decodificando rgb_1_1_s1.elx");
            assert_eq!(img.width(), 1);
            assert_eq!(img.height(), 1);
            assert_eq!(header.step, 1);
        }
    }

    #[test]
    fn test_decode_rgb_17_13_s1() {
        let p = PathBuf::from(r"D:\Imágenes\ELYX_nativo_20261017_181309\pruebas\rgb_17_13_s1.elx");
        if p.exists() {
            let (img, header) = decode_elyx_file(&p).expect("Fallo decodificando rgb_17_13_s1.elx");
            assert_eq!(img.width(), 17);
            assert_eq!(img.height(), 13);
            assert_eq!(header.step, 1);
        }
    }

    #[test]
    fn test_decode_rgb_65_71_s8() {
        let p = PathBuf::from(r"D:\Imágenes\ELYX_nativo_20261017_181309\pruebas\rgb_65_71_s8.elx");
        if p.exists() {
            let (img, header) = decode_elyx_file(&p).expect("Fallo decodificando rgb_65_71_s8.elx");
            assert_eq!(img.width(), 65);
            assert_eq!(img.height(), 71);
            assert_eq!(header.step, 8);
        }
    }

    #[test]
    fn test_decode_peyto_s1_lossless() {
        let p = PathBuf::from(r"D:\Imágenes\ELYX_nativo_20261017_181309\variantes\Peyto_s1.elx");
        if p.exists() {
            let (img, header) = decode_elyx_file(&p).expect("Fallo decodificando Peyto_s1.elx");
            assert_eq!(img.width(), 8192);
            assert_eq!(img.height(), 5464);
            assert_eq!(header.step, 1);
        }
    }

    #[test]
    fn test_decode_peyto_s8_lossy() {
        let p = PathBuf::from(r"D:\Imágenes\ELYX_nativo_20261017_181309\variantes\Peyto_s8.elx");
        if p.exists() {
            let (img, header) = decode_elyx_file(&p).expect("Fallo decodificando Peyto_s8.elx");
            assert_eq!(img.width(), 8192);
            assert_eq!(img.height(), 5464);
            assert_eq!(header.step, 8);
        }
    }

    #[test]
    fn test_rejects_corrupt_signature() {
        let p = PathBuf::from(r"D:\Imágenes\ELYX_nativo_20261017_181309\pruebas\firma.elx");
        if p.exists() {
            let res = decode_elyx_file(&p);
            assert!(res.is_err(), "Debe rechazar firma corrupta");
        }
    }

    #[test]
    fn test_decode_elyx_v2_test_file() {
        let p = PathBuf::from(r"D:\Imágenes\Test.elx");
        if p.exists() {
            let dims = read_elyx_dimensions(&p);
            assert_eq!(dims, Some((1120, 1600)), "Dimensiones leídas de Test.elx no coinciden");

            let (img, header) = decode_elyx_file(&p).expect("Fallo decodificando Test.elx v2");
            assert_eq!(img.width(), 1120);
            assert_eq!(img.height(), 1600);
            assert_eq!(header.version, 2);
            assert_eq!(header.wavelet, "CDF53-2D-MED-deadzone");
            assert_eq!(header.step, 8);
        }
    }
}
