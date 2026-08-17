use std::{fs, path::Path};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use lofty::{
    config::{ParseOptions, WriteOptions},
    file::{AudioFile, TaggedFileExt},
    picture::{MimeType, Picture, PictureType},
    probe::Probe,
    tag::{Accessor, ItemKey, ItemValue, Tag, TagItem},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioTagData {
    pub path: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub track_number: Option<u32>,
    pub track_total: Option<u32>,
    pub disc_number: Option<u32>,
    pub disc_total: Option<u32>,
    pub comment: Option<String>,
    pub lyrics: Option<String>,
    pub duration_seconds: Option<f64>,
    pub bitrate_kbps: Option<u32>,
    pub sample_rate_hz: Option<u32>,
    pub channels: Option<u8>,
    pub format_name: Option<String>,
    pub has_artwork: bool,
    pub artwork_mime: Option<String>,
    pub artwork_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAudioTagsRequest {
    pub path: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub track_number: Option<u32>,
    pub track_total: Option<u32>,
    pub disc_number: Option<u32>,
    pub disc_total: Option<u32>,
    pub comment: Option<String>,
    pub lyrics: Option<String>,
    /// Imagen nueva en Base64 (data URL o base64 puro), None si no se cambia, Some("") si se desea eliminar
    pub artwork_base64: Option<String>,
}

/// Lee los tags completos y las propiedades de audio de un archivo local.
pub fn read_audio_tags(audio_path: &Path, include_artwork_data: bool) -> Result<AudioTagData, String> {
    let clean_path = audio_path.to_str().unwrap_or("").trim_start_matches(r"\\?\");
    let probe = Probe::open(audio_path)
        .map_err(|e| format!("No se pudo abrir el archivo de audio: {e}"))?
        .options(ParseOptions::new().read_properties(true))
        .guess_file_type()
        .map_err(|e| format!("Formato de audio no reconocido: {e}"))?;

    let file_type = probe.file_type();
    let tagged_file = probe
        .read()
        .map_err(|e| format!("Error leyendo metadatos de audio: {e}"))?;

    let properties = tagged_file.properties();
    let duration_seconds = Some(properties.duration().as_secs_f64());
    let bitrate_kbps = properties.audio_bitrate();
    let sample_rate_hz = properties.sample_rate();
    let channels = properties.channels();
    let format_name = file_type.map(|ft| format!("{ft:?}"));

    let mut title = None;
    let mut artist = None;
    let mut album = None;
    let mut album_artist = None;
    let mut year = None;
    let mut genre = None;
    let mut track_number = None;
    let mut track_total = None;
    let mut disc_number = None;
    let mut disc_total = None;
    let mut comment = None;
    let mut lyrics = None;
    let mut has_artwork = false;
    let mut artwork_mime = None;
    let mut artwork_data_url = None;

    if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
        title = tag.title().map(|s| s.to_string());
        artist = tag.artist().map(|s| s.to_string());
        album = tag.album().map(|s| s.to_string());
        album_artist = tag.get_string(ItemKey::AlbumArtist).map(|s| s.to_string());
        year = tag
            .get_string(ItemKey::Year)
            .or_else(|| tag.get_string(ItemKey::RecordingDate))
            .and_then(|s| {
                let digits: String = s.chars().filter(|c| c.is_ascii_digit()).take(4).collect();
                digits.parse::<u32>().ok()
            });
        genre = tag.genre().map(|s| s.to_string());
        track_number = tag.track();
        track_total = tag.track_total();
        disc_number = tag.disk();
        disc_total = tag.disk_total();
        comment = tag.comment().map(|s| s.to_string());
        lyrics = tag
            .get_string(ItemKey::Lyrics)
            .or_else(|| tag.get_string(ItemKey::UnsyncLyrics))
            .map(|s| s.to_string());

        if let Some(picture) = tag.pictures().iter().find(|p| p.pic_type() == PictureType::CoverFront).or_else(|| tag.pictures().first()) {
            has_artwork = true;
            artwork_mime = Some(format!("{:?}", picture.mime_type()));
            if include_artwork_data {
                let mime_str = match picture.mime_type() {
                    Some(MimeType::Jpeg) => "image/jpeg",
                    Some(MimeType::Png) => "image/png",
                    Some(MimeType::Bmp) => "image/bmp",
                    Some(MimeType::Gif) => "image/gif",
                    Some(MimeType::Tiff) => "image/tiff",
                    _ => "image/jpeg",
                };
                artwork_data_url = Some(format!("data:{mime_str};base64,{}", STANDARD.encode(picture.data())));
            }
        }
    }

    Ok(AudioTagData {
        path: clean_path.to_string(),
        title,
        artist,
        album,
        album_artist,
        year,
        genre,
        track_number,
        track_total,
        disc_number,
        disc_total,
        comment,
        lyrics,
        duration_seconds,
        bitrate_kbps,
        sample_rate_hz,
        channels,
        format_name,
        has_artwork,
        artwork_mime,
        artwork_data_url,
    })
}

/// Guarda o actualiza los metadatos de audio en el archivo.
pub fn write_audio_tags(req: UpdateAudioTagsRequest) -> Result<(), String> {
    let audio_path = Path::new(&req.path);
    if !audio_path.exists() {
        return Err(format!("El archivo no existe: {}", req.path));
    }

    let mut tagged_file = Probe::open(audio_path)
        .map_err(|e| format!("No se pudo abrir el archivo para escritura: {e}"))?
        .options(ParseOptions::new().read_properties(false))
        .guess_file_type()
        .map_err(|e| format!("Formato de audio no reconocido: {e}"))?
        .read()
        .map_err(|e| format!("Error leyendo metadatos: {e}"))?;

    let tag_type = tagged_file.primary_tag_type();
    let tag = if tagged_file.primary_tag().is_some() {
        tagged_file.primary_tag_mut().unwrap()
    } else if tagged_file.first_tag().is_some() {
        tagged_file.first_tag_mut().unwrap()
    } else {
        tagged_file.insert_tag(Tag::new(tag_type));
        tagged_file.primary_tag_mut().unwrap()
    };

    if let Some(ref t) = req.title {
        if t.trim().is_empty() {
            tag.remove_title();
        } else {
            tag.set_title(t.clone());
        }
    }

    if let Some(ref a) = req.artist {
        if a.trim().is_empty() {
            tag.remove_artist();
        } else {
            tag.set_artist(a.clone());
        }
    }

    if let Some(ref al) = req.album {
        if al.trim().is_empty() {
            tag.remove_album();
        } else {
            tag.set_album(al.clone());
        }
    }

    if let Some(ref aa) = req.album_artist {
        if aa.trim().is_empty() {
            tag.remove_key(ItemKey::AlbumArtist);
        } else {
            tag.insert(TagItem::new(ItemKey::AlbumArtist, ItemValue::Text(aa.clone())));
        }
    }

    if let Some(y) = req.year {
        tag.remove_key(ItemKey::Year);
        tag.remove_key(ItemKey::RecordingDate);
        if y > 0 {
            tag.insert(TagItem::new(ItemKey::Year, ItemValue::Text(y.to_string())));
        }
    }

    if let Some(ref g) = req.genre {
        if g.trim().is_empty() {
            tag.remove_genre();
        } else {
            tag.set_genre(g.clone());
        }
    }

    if let Some(tr) = req.track_number {
        if tr == 0 {
            tag.remove_track();
        } else {
            tag.set_track(tr);
        }
    }

    if let Some(tt) = req.track_total {
        if tt == 0 {
            tag.remove_track_total();
        } else {
            tag.set_track_total(tt);
        }
    }

    if let Some(d) = req.disc_number {
        if d == 0 {
            tag.remove_disk();
        } else {
            tag.set_disk(d);
        }
    }

    if let Some(dt) = req.disc_total {
        if dt == 0 {
            tag.remove_disk_total();
        } else {
            tag.set_disk_total(dt);
        }
    }

    if let Some(ref c) = req.comment {
        if c.trim().is_empty() {
            tag.remove_comment();
        } else {
            tag.set_comment(c.clone());
        }
    }

    if let Some(ref l) = req.lyrics {
        tag.remove_key(ItemKey::Lyrics);
        tag.remove_key(ItemKey::UnsyncLyrics);
        if !l.trim().is_empty() {
            tag.insert(TagItem::new(ItemKey::Lyrics, ItemValue::Text(l.clone())));
            tag.insert(TagItem::new(ItemKey::UnsyncLyrics, ItemValue::Text(l.clone())));
        }
    }

    if let Some(ref art_b64) = req.artwork_base64 {
        tag.remove_picture_type(PictureType::CoverFront);
        if !art_b64.trim().is_empty() {
            let pure_base64 = if let Some(idx) = art_b64.find(',') {
                &art_b64[idx + 1..]
            } else {
                art_b64.as_str()
            };
            if let Ok(bytes) = STANDARD.decode(pure_base64.trim()) {
                let mime = if art_b64.contains("image/png") || bytes.starts_with(b"\x89PNG") {
                    MimeType::Png
                } else {
                    MimeType::Jpeg
                };
                let pic = Picture::unchecked(bytes)
                    .pic_type(PictureType::CoverFront)
                    .mime_type(mime)
                    .build();
                tag.push_picture(pic);
            }
        }
    }

    tagged_file
        .save_to_path(audio_path, WriteOptions::default())
        .map_err(|e| format!("Error guardando tags en archivo: {e}"))?;

    Ok(())
}

/// Guarda letras en un archivo `.lrc` compañero, subtítulos `.srt` y opcionalmente incrustadas en los tags del archivo de audio.
pub fn save_track_lyrics(
    audio_path: &Path,
    lyrics_content: &str,
    srt_content: Option<&str>,
    save_lrc_file: bool,
    save_srt_file: bool,
    embed_in_tag: bool,
) -> Result<(), String> {
    if save_lrc_file {
        let lrc_path = audio_path.with_extension("lrc");
        fs::write(&lrc_path, lyrics_content)
            .map_err(|e| format!("No se pudo escribir el archivo .lrc: {e}"))?;
    }

    if save_srt_file {
        if let Some(srt) = srt_content {
            if !srt.trim().is_empty() {
                let srt_path = audio_path.with_extension("srt");
                fs::write(&srt_path, srt)
                    .map_err(|e| format!("No se pudo escribir el archivo .srt: {e}"))?;
            }
        }
    }

    if embed_in_tag {
        let update_req = UpdateAudioTagsRequest {
            path: audio_path.to_string_lossy().to_string(),
            title: None,
            artist: None,
            album: None,
            album_artist: None,
            year: None,
            genre: None,
            track_number: None,
            track_total: None,
            disc_number: None,
            disc_total: None,
            comment: None,
            lyrics: Some(lyrics_content.to_string()),
            artwork_base64: None,
        };
        let _ = write_audio_tags(update_req);
    }

    Ok(())
}
