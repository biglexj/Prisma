use std::{path::Path, process::Command};

use crate::infrastructure::converter::find_ffmpeg_binary;

/// Decodifica una imagen JPEG XL (.jxl) a bytes JPEG/WebP para miniatura rápida mediante FFmpeg/libjxl.
pub fn decode_jxl_thumbnail(path: &Path, max_dim: u32) -> Result<Vec<u8>, String> {
    let ffmpeg = find_ffmpeg_binary().ok_or_else(|| "FFmpeg con soporte libjxl no disponible".to_string())?;
    let path_str = path.to_string_lossy();
    let clean_str = path_str.trim_start_matches(r"\\?\");

    let scale_filter = format!("scale='min({max_dim},iw)':-2");
    let mut cmd = Command::new(&ffmpeg);
    cmd.args([
        "-v", "error",
        "-nostdin",
        "-i", clean_str,
        "-vf", &scale_filter,
        "-c:v", "mjpeg",
        "-q:v", "3",
        "-f", "image2",
        "pipe:1",
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("Error ejecutando decodificador JXL: {e}"))?;
    if output.status.success() && !output.stdout.is_empty() {
        Ok(output.stdout)
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(format!("Fallo al decodificar miniatura JXL: {err}"))
    }
}

/// Decodifica una imagen JPEG XL (.jxl) a resolución completa en WebP/PNG para visualización en WebView.
pub fn decode_jxl_full(path: &Path) -> Result<Vec<u8>, String> {
    let ffmpeg = find_ffmpeg_binary().ok_or_else(|| "FFmpeg con soporte libjxl no disponible".to_string())?;
    let path_str = path.to_string_lossy();
    let clean_str = path_str.trim_start_matches(r"\\?\");

    let mut cmd = Command::new(&ffmpeg);
    cmd.args([
        "-v", "error",
        "-nostdin",
        "-i", clean_str,
        "-c:v", "webp",
        "-q:v", "96",
        "-f", "image2",
        "pipe:1",
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("Error ejecutando decodificador JXL: {e}"))?;
    if output.status.success() && !output.stdout.is_empty() {
        Ok(output.stdout)
    } else {
        // Fallback a PNG si WebP falla por dimensiones extremas (> 16383px)
        let mut fallback_cmd = Command::new(&ffmpeg);
        fallback_cmd.args([
            "-v", "error",
            "-nostdin",
            "-i", clean_str,
            "-c:v", "png",
            "-f", "image2",
            "pipe:1",
        ]);

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            fallback_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let fallback_output = fallback_cmd.output().map_err(|e| format!("Error en fallback PNG: {e}"))?;
        if fallback_output.status.success() && !fallback_output.stdout.is_empty() {
            Ok(fallback_output.stdout)
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Err(format!("Fallo decodificando JXL a resolución completa: {err}"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_decode_jxl_thumbnail_and_full() {
        let p = PathBuf::from(r"D:\Imágenes\ELYX_resultados_20261017_174854\variantes\jxl_q70.jxl");
        if p.exists() {
            let thumb = decode_jxl_thumbnail(&p, 480).expect("Fallo decodificando miniatura JXL");
            assert!(!thumb.is_empty());
            assert_eq!(&thumb[0..2], &[0xFF, 0xD8]); // JPEG Magic

            let full = decode_jxl_full(&p).expect("Fallo decodificando JXL completo");
            assert!(!full.is_empty());
        }
    }
}
