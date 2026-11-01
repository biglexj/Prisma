use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Serialize;
use serde_json::Value;
use std::{
    io::{Cursor, Read},
    sync::Mutex,
    time::{Duration, Instant},
};

static LAST_SEARCH: Mutex<Option<Instant>> = Mutex::new(None);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataCandidate {
    title: String,
    artist: String,
    album: String,
    cover_url: String,
    source: &'static str,
}

fn client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("Prisma-Desktop (https://github.com/biglexj/Prisma)")
        .build()
        .map_err(|e| e.to_string())
}

fn read_limited(response: reqwest::blocking::Response, limit: u64) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    response
        .error_for_status()
        .map_err(|e| e.to_string())?
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > limit {
        return Err("Respuesta demasiado grande".into());
    }
    Ok(bytes)
}

fn search_provider(query: &str, deezer: bool) -> Result<Vec<MetadataCandidate>, String> {
    // Serializa inicios de consultas, incluso entre modales, para respetar el catálogo.
    {
        let mut last = LAST_SEARCH.lock().map_err(|e| e.to_string())?;
        if let Some(last) = *last {
            std::thread::sleep(Duration::from_millis(3200).saturating_sub(last.elapsed()));
        }
        *last = Some(Instant::now());
    }
    let endpoint = if deezer {
        "https://api.deezer.com/search"
    } else {
        "https://itunes.apple.com/search"
    };
    let mut url = reqwest::Url::parse(endpoint).map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair(if deezer { "q" } else { "term" }, query)
        .append_pair("limit", "5");
    if !deezer {
        url.query_pairs_mut()
            .append_pair("entity", "song")
            .append_pair("media", "music");
    }
    let body = read_limited(
        client()?.get(url).send().map_err(|e| e.to_string())?,
        1_000_000,
    )?;
    let data: Value = serde_json::from_slice(&body).map_err(|e| e.to_string())?;
    parse_results(&data, deezer)
}

fn parse_results(data: &Value, deezer: bool) -> Result<Vec<MetadataCandidate>, String> {
    if data.get("error").is_some() {
        return Err("Deezer no pudo completar la consulta".into());
    }
    let field = if deezer { "data" } else { "results" };
    let rows = data[field]
        .as_array()
        .ok_or("Respuesta de catálogo no válida")?;
    Ok(rows
        .iter()
        .filter_map(|row| {
            let (title, artist, album, cover) = if deezer {
                (
                    row["title"].as_str()?,
                    row["artist"]["name"].as_str()?,
                    row["album"]["title"].as_str().unwrap_or(""),
                    row["album"]["cover_xl"]
                        .as_str()
                        .or_else(|| row["album"]["cover_big"].as_str())
                        .unwrap_or(""),
                )
            } else {
                (
                    row["trackName"].as_str()?,
                    row["artistName"].as_str()?,
                    row["collectionName"].as_str().unwrap_or(""),
                    row["artworkUrl100"].as_str().unwrap_or(""),
                )
            };
            if title.trim().is_empty() || artist.trim().is_empty() {
                return None;
            }
            Some(MetadataCandidate {
                title: title.into(),
                artist: artist.into(),
                album: album.into(),
                cover_url: cover.replace("100x100bb", "1000x1000bb"),
                source: if deezer { "Deezer" } else { "Apple Music" },
            })
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_catalogs_without_fabricating_missing_fields() {
        let apple = serde_json::json!({"results": [
            {"trackName":"Song", "artistName":"Artist", "collectionName":"Album", "artworkUrl100":"https://is1-ssl.mzstatic.com/image/100x100bb.jpg"},
            {"trackName":"Incomplete"}
        ]});
        let rows = parse_results(&apple, false).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(
            rows[0].cover_url,
            "https://is1-ssl.mzstatic.com/image/1000x1000bb.jpg"
        );
        let deezer = serde_json::json!({"data": [{"title":"Canción", "artist":{"name":"Artista"}, "album":{"title":"Álbum", "cover_big":"https://cdn-images.dzcdn.net/cover.jpg"}}]});
        let rows = parse_results(&deezer, true).unwrap();
        assert_eq!(rows[0].source, "Deezer");
        assert_eq!(rows[0].album, "Álbum");
        assert!(rows[0].cover_url.ends_with("cover.jpg"));
        assert!(parse_results(&serde_json::json!({"error":{}}), true).is_err());
        assert!(
            parse_results(&serde_json::json!({"results": []}), false)
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn rejects_invalid_queries_and_cover_destinations_before_network() {
        assert!(search(" ", false).is_err());
        assert!(search(&"x".repeat(501), false).is_err());
        for url in [
            "http://cdn-images.dzcdn.net/a.jpg",
            "https://localhost/a.jpg",
            "https://evil.mzstatic.com.example/a.jpg",
            "file:///cover.jpg",
            "https://cdn-images.dzcdn.net:444/a.jpg",
        ] {
            assert!(download_cover(url).is_err(), "{url}");
        }
    }

    #[test]
    fn embeds_cover_and_metadata_in_flac_preserving_unrelated_tags() {
        use crate::infrastructure::tags::{read_audio_tags, write_audio_tags};
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("prisma-metadata-{nonce}.flac"));
        let mut stream_info = [0u8; 34];
        stream_info[0..4].copy_from_slice(&[0x10, 0, 0x10, 0]);
        let format = (44100u64 << 44) | (1u64 << 41) | (15u64 << 36);
        stream_info[10..18].copy_from_slice(&format.to_be_bytes());
        let bytes = [b"fLaC".as_slice(), &[0x80, 0, 0, 34], &stream_info].concat();
        std::fs::write(&path, bytes).unwrap();
        let result = std::panic::catch_unwind(|| {
            let initial = serde_json::from_value(serde_json::json!({
                "path": path.to_string_lossy(), "title":"Título propio", "lyrics":"Letra propia", "genre":"Folk", "track_number":3
            })).unwrap();
            write_audio_tags(initial).unwrap();
            let mut cover = Cursor::new(Vec::new());
            image::DynamicImage::new_rgb8(600, 600)
                .write_to(&mut cover, image::ImageFormat::Jpeg)
                .unwrap();
            let update = serde_json::from_value(serde_json::json!({
                "path":path.to_string_lossy(), "artist":"Intérprete", "album":"Álbum",
                "artwork_base64":format!("data:image/jpeg;base64,{}", STANDARD.encode(cover.into_inner()))
            })).unwrap();
            write_audio_tags(update).unwrap();
            let tags = read_audio_tags(&path, true).unwrap();
            assert_eq!(tags.title.as_deref(), Some("Título propio"));
            assert_eq!(tags.artist.as_deref(), Some("Intérprete"));
            assert_eq!(tags.album.as_deref(), Some("Álbum"));
            assert_eq!(tags.lyrics.as_deref(), Some("Letra propia"));
            assert_eq!(tags.genre.as_deref(), Some("Folk"));
            assert_eq!(tags.track_number, Some(3));
            assert!(tags.has_artwork);
            assert!(
                tags.artwork_data_url
                    .unwrap()
                    .starts_with("data:image/jpeg;base64,")
            );
        });
        let _ = std::fs::remove_file(&path);
        if let Err(error) = result {
            std::panic::resume_unwind(error);
        }
    }

    #[test]
    #[ignore = "Consulta real de catálogos públicos"]
    fn live_catalog_and_hd_cover() {
        let results = search("Daft Punk Get Lucky", false).unwrap();
        assert!(!results.is_empty());
        let cover = download_cover(&results[0].cover_url).unwrap();
        assert!(cover.starts_with("data:image/jpeg;base64,"));
        let results = search("Daft Punk Get Lucky", true).unwrap();
        assert!(!results.is_empty());
    }
}

pub fn search(query: &str, deezer: bool) -> Result<Vec<MetadataCandidate>, String> {
    let query = query.trim();
    if query.chars().count() < 2 || query.len() > 500 {
        return Err("Escribe una búsqueda de 2 a 500 caracteres".into());
    }
    if deezer {
        return search_provider(query, true);
    }
    match search_provider(query, false) {
        Ok(results) if !results.is_empty() => Ok(results),
        first => match search_provider(query, true) {
            Ok(results) if !results.is_empty() => Ok(results),
            Ok(_) => first,
            Err(second) => match first {
                Err(first) => Err(format!("Apple Music: {first}. Deezer: {second}")),
                Ok(_) => Err(format!("Deezer: {second}")),
            },
        },
    }
}

pub fn download_cover(url: &str) -> Result<String, String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    let host = parsed.host_str().unwrap_or("");
    if parsed.scheme() != "https"
        || parsed.port_or_known_default() != Some(443)
        || !(host.ends_with(".mzstatic.com")
            || host == "cdn-images.dzcdn.net"
            || host == "e-cdns-images.dzcdn.net")
    {
        return Err("La carátula debe proceder del catálogo musical".into());
    }
    let bytes = read_limited(
        client()?.get(parsed).send().map_err(|e| e.to_string())?,
        10 * 1024 * 1024,
    )?;
    let reader = image::ImageReader::new(Cursor::new(&bytes))
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let (width, height) = reader.into_dimensions().map_err(|e| e.to_string())?;
    if width != height || width < 500 || width > 2000 {
        return Err("Se necesita una carátula cuadrada de 500 a 2000 px".into());
    }
    let image = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    let mut output = Cursor::new(Vec::new());
    image
        .write_to(&mut output, image::ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;
    Ok(format!(
        "data:image/jpeg;base64,{}",
        STANDARD.encode(output.into_inner())
    ))
}
