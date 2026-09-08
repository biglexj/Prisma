use super::*;
use std::io::Write;

#[test]
fn real_media_conversion_and_overwrite_protection() {
    let root = std::env::temp_dir().join(format!("prisma-converter-test-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let input = root.join("entrada.png");
    image::RgbImage::from_pixel(32, 24, image::Rgb([20, 180, 120])).save(&input).unwrap();
    for format in ["jpg", "png", "webp", "avif", "bmp", "tiff", "gif"] {
        let output = root.join(format!("salida.{format}"));
        let options = ImageConvertOptions { target_format: format.into(), quality: Some(75), resize_width: Some(16), resize_height: None, keep_aspect_ratio: Some(true), strip_metadata: Some(true) };
        convert_image(&input, &output, &options).unwrap();
        assert!(output.metadata().unwrap().len() > 0);
        assert!(convert_image(&input, &output, &options).is_err());
    }
    let source = root.join("fuente.mp4");
    let result = Command::new(find_ffmpeg_binary().unwrap()).args(["-v", "error", "-nostdin", "-f", "lavfi", "-i", "color=c=blue:s=32x24:r=10", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "0.3", "-c:v", "libx264", "-c:a", "aac"]).arg(&source).output().unwrap();
    assert!(result.status.success(), "{}", String::from_utf8_lossy(&result.stderr));
    for format in ["mp3", "flac", "wav", "aac", "ogg", "m4a"] {
        let audio = root.join(format!("audio.{format}"));
        extract_video_audio(&source, &audio, &VideoToAudioOptions { target_format: format.into(), bitrate: Some("128k".into()), sample_rate: None, channels: Some(2) }).unwrap();
        transcode_audio(&audio, &root.join(format!("transcode-{format}.wav")), &AudioTranscodeOptions { target_format: "wav".into(), bitrate: None, sample_rate: None, channels: None }).unwrap();
    }
    for format in ["mp4", "mkv", "webm"] {
        let video = root.join(format!("convertido.{format}"));
        transcode_video(&source, &video, &VideoTranscodeOptions { target_format: format.into(), video_codec: "h264".into(), crf: Some(30), preset: Some("ultrafast".into()), scale: None, audio_codec: Some("aac".into()), audio_bitrate: Some("128k".into()) }).unwrap();
        let probe = Command::new(find_ffprobe_binary().unwrap()).args(["-v", "error", "-show_streams"]).arg(video).output().unwrap();
        assert!(probe.status.success());
        assert!(String::from_utf8_lossy(&probe.stdout).contains("codec_type=video"));
    }
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn zip_extraction_rejects_traversal_and_existing_destination() {
    let root = std::env::temp_dir().join(format!("prisma-zip-test-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    for (name, entry_name) in [("valid.zip", "folder/hola.txt"), ("bad.zip", "../escape.txt")] {
        let file = std::fs::File::create(root.join(name)).unwrap();
        let mut writer = zip::ZipWriter::new(file);
        writer.start_file(entry_name, zip::write::SimpleFileOptions::default()).unwrap();
        writer.write_all(b"hola").unwrap();
        writer.finish().unwrap();
    }
    let destination = extract_zip(&root.join("valid.zip")).unwrap();
    assert_eq!(std::fs::read(destination.join("folder/hola.txt")).unwrap(), b"hola");
    assert!(extract_zip(&root.join("valid.zip")).is_err());
    assert!(extract_zip(&root.join("bad.zip")).is_err());
    assert!(!root.join("escape.txt").exists());
    std::fs::remove_dir_all(root).unwrap();
}
