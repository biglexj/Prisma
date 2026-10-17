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

#[derive(Debug, Clone, Deserialize)]
pub struct ElyxHeader {
    pub version: u32,
    pub width: u32,
    pub height: u32,
    pub mode: String,
    pub tile: u32,
    pub levels: u32,
    pub step: u32,
    pub color: String,
    pub wavelet: String,
    pub entropy: String,
    pub pixel_sha256: Option<String>,
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

    if header.version != 1
        || header.mode != "RGB8"
        || header.color != "YCoCg-R"
        || header.wavelet != "CDF53"
        || header.entropy != "zigzag16-byteplanes-deflate"
    {
        return Err("Versión o herramientas no compatibles en ElyX".to_string());
    }

    let w = header.width as usize;
    let ht = header.height as usize;
    let tile = header.tile as usize;
    let levels = header.levels;
    let step = header.step;

    if w < 1 || ht < 1 || (w as u64 * ht as u64) > MAX_PIXELS {
        return Err("Dimensiones inválidas o superiores a 60 MP".to_string());
    }
    if !(1..=64).contains(&step)
        || !(1..=4).contains(&levels)
        || !(32..=1024).contains(&tile)
        || (tile % (1 << levels) != 0)
    {
        return Err("Parámetros de compresión ElyX inválidos".to_string());
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
}
