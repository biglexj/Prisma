use std::path::Path;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}, mpsc::{Receiver, sync_channel}};
use std::time::Duration;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde_json::{Value, json};
use tauri::{AppHandle, Manager};

const MAX_METADATA: usize = 192 * 1024;

fn thumbnail(data_url: &str) -> Option<String> {
    let (_, encoded) = data_url.split_once(',')?;
    if encoded.len() > 12 * 1024 * 1024 { return None; }
    let bytes = STANDARD.decode(encoded).ok()?;
    let mut reader = image::ImageReader::new(std::io::Cursor::new(bytes)).with_guessed_format().ok()?;
    let mut limits = image::Limits::default();
    limits.max_alloc = Some(64 * 1024 * 1024);
    limits.max_image_width = Some(4096);
    limits.max_image_height = Some(4096);
    reader.limits(limits);
    let image = reader.decode().ok()?.thumbnail(256, 256).to_rgb8();
    let mut jpeg = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 80).encode_image(&image).ok()?;
    Some(STANDARD.encode(jpeg))
}

fn current(app: &AppHandle) -> Value {
    let own = app.try_state::<crate::features::synapse::SynapseState>().map(|state| state.get_playback_status());
    let (title, artist, artwork) = if let Some(own) = own.filter(|own| own.is_playing && !own.title.is_empty()) {
        let artwork = own.path.as_deref().and_then(|path| crate::infrastructure::artwork::load_music_artwork_data_url(Path::new(path)));
        (own.title, own.artist, artwork)
    } else {
        let system = crate::infrastructure::media::system_media::read().ok().flatten()
            .and_then(|media| serde_json::to_value(media).ok()).unwrap_or(Value::Null);
        (system["title"].as_str().unwrap_or("Audio de Windows").to_owned(),
         system["artist"].as_str().unwrap_or("").to_owned(),
         system["artworkUrl"].as_str().map(str::to_owned))
    };
    json!({"title": title.chars().take(160).collect::<String>(),
        "artist": artist.chars().take(160).collect::<String>(),
        "artwork": artwork.as_deref().and_then(thumbnail)})
}

// Metadata extraction and image resizing never run on the PCM/TLS sending thread.
pub fn start(app: AppHandle, running: Arc<AtomicBool>) -> Receiver<Vec<u8>> {
    let (sender, receiver) = sync_channel(1);
    std::thread::spawn(move || {
        let mut previous = Vec::new();
        while running.load(Ordering::Relaxed) {
            if let Ok(bytes) = serde_json::to_vec(&current(&app)) {
                if bytes.len() < MAX_METADATA && bytes != previous && sender.try_send(bytes.clone()).is_ok() {
                    previous = bytes;
                }
            }
            for _ in 0..20 {
                if !running.load(Ordering::Relaxed) { return; }
                std::thread::sleep(Duration::from_millis(100));
            }
        }
    });
    receiver
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn thumbnail_is_small_jpeg_and_invalid_artwork_is_omitted() {
        let image = image::RgbImage::from_pixel(800, 600, image::Rgb([40, 90, 180]));
        let mut source = Vec::new();
        image::codecs::jpeg::JpegEncoder::new(&mut source).encode_image(&image).unwrap();
        let encoded = thumbnail(&format!("data:image/jpeg;base64,{}", STANDARD.encode(source))).unwrap();
        let bytes = STANDARD.decode(encoded).unwrap();
        let decoded = image::load_from_memory(&bytes).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (256, 192));
        assert!(bytes.len() < MAX_METADATA / 2);
        assert!(thumbnail("data:image/jpeg;base64,broken").is_none());
    }
}
