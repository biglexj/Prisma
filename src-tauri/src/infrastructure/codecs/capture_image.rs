use std::io::Cursor;

/// El formato del archivo y sus bytes se resuelven juntos para todas las capturas.
pub fn capture_extension(format: &str) -> Result<&'static str, String> {
    match format.to_ascii_lowercase().as_str() {
        "png" => Ok("png"),
        "jpg" | "jpeg" => Ok("jpg"),
        "webp" => Ok("webp"),
        "elx" => Ok("elx"),
        _ => Err(format!("Formato de captura no compatible: {format}")),
    }
}

pub fn encode_capture_image(bytes: &[u8], format: &str) -> Result<Vec<u8>, String> {
    let extension = capture_extension(format)?;
    let image = image::load_from_memory(bytes)
        .map_err(|e| format!("No se pudo leer la captura: {e}"))?;
    if extension == "elx" || extension == "jpg" {
        // RGB8: componer transparencia sobre blanco, sin perder canales silenciosamente.
        let rgba = image.to_rgba8();
        let rgb = image::RgbImage::from_fn(rgba.width(), rgba.height(), |x, y| {
            let p = rgba.get_pixel(x, y).0;
            let alpha = p[3] as u32;
            image::Rgb([0, 1, 2].map(|c| ((p[c] as u32 * alpha + 255 * (255 - alpha) + 127) / 255) as u8))
        });
        if extension == "elx" {
            return super::elyx::encode_elyx(&rgb);
        }
        let mut output = Vec::new();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, 95)
            .encode_image(&rgb).map_err(|e| format!("No se pudo codificar JPG: {e}"))?;
        return Ok(output);
    }
    let mut output = Cursor::new(Vec::new());
    let format = if extension == "webp" { image::ImageFormat::WebP } else { image::ImageFormat::Png };
    image.write_to(&mut output, format)
        .map_err(|e| format!("No se pudo codificar la captura: {e}"))?;
    Ok(output.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn capture_formats_have_real_signatures_and_reopen() {
        for (w, h) in [(1, 1), (17, 13), (513, 19), (19, 513), (65, 71)] {
            let input = image::RgbImage::from_fn(w, h, |x, y| image::Rgb([
                (x.wrapping_mul(67) + y * 19) as u8, (x * 13 + y * 83) as u8, (x * 113 + y * 7) as u8,
            ]));
            let mut png = Cursor::new(Vec::new());
            input.write_to(&mut png, image::ImageFormat::Png).unwrap();
            for format in ["png", "webp", "jpeg", "elx"] {
                let encoded = encode_capture_image(png.get_ref(), format).unwrap();
                let decoded = if format == "elx" {
                    assert!(encoded.starts_with(super::super::elyx::ELYX_MAGIC));
                    super::super::elyx::decode_elyx_from_reader(Cursor::new(encoded)).unwrap().0
                } else {
                    let expected = match format { "png" => image::ImageFormat::Png, "webp" => image::ImageFormat::WebP, _ => image::ImageFormat::Jpeg };
                    assert_eq!(image::guess_format(&encoded).unwrap(), expected);
                    image::load_from_memory(&encoded).unwrap().to_rgb8()
                };
                assert_eq!(decoded.dimensions(), (w, h));
                if format != "jpeg" { assert_eq!(decoded, input); }
            }
        }
    }
    #[test]
    fn rgb_formats_compose_alpha_on_white_and_reject_bad_input() {
        let input = image::RgbaImage::from_pixel(1, 1, image::Rgba([255, 0, 0, 0]));
        let mut png = Cursor::new(Vec::new());
        input.write_to(&mut png, image::ImageFormat::Png).unwrap();
        for format in ["png", "webp"] {
            let encoded = encode_capture_image(png.get_ref(), format).unwrap();
            assert_eq!(image::load_from_memory(&encoded).unwrap().to_rgba8(), input);
        }
        let encoded = encode_capture_image(png.get_ref(), "elx").unwrap();
        let (decoded, _) = super::super::elyx::decode_elyx_from_reader(Cursor::new(encoded)).unwrap();
        assert_eq!(decoded.get_pixel(0, 0).0, [255; 3]);
        assert!(encode_capture_image(b"invalid", "png").is_err());
        assert!(capture_extension("vp9").is_err());
    }
}
