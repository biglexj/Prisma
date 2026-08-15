use std::{fs, path::Path};
use lofty::{
    config::ParseOptions,
    file::TaggedFileExt,
    probe::Probe,
    tag::ItemKey,
};

pub fn load_track_lyrics(audio_path: &Path) -> Option<String> {
    // 1. Búsqueda de archivo .lrc externo en la misma carpeta con el mismo nombre
    if let Some(parent) = audio_path.parent() {
        // Coincidencia directa por extensión
        let lrc_path = audio_path.with_extension("lrc");
        if lrc_path.is_file() {
            if let Ok(content) = fs::read_to_string(&lrc_path) {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_owned());
                }
            }
        }

        let lrc_upper = audio_path.with_extension("LRC");
        if lrc_upper.is_file() {
            if let Ok(content) = fs::read_to_string(&lrc_upper) {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_owned());
                }
            }
        }

        // Búsqueda insensible a mayúsculas/minúsculas en el directorio
        if let Some(file_stem) = audio_path.file_stem().and_then(|s| s.to_str()) {
            if let Ok(entries) = fs::read_dir(parent) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if !path.is_file() {
                        continue;
                    }
                    let is_lrc_or_txt = path
                        .extension()
                        .and_then(|e| e.to_str())
                        .is_some_and(|ext| ext.eq_ignore_ascii_case("lrc") || ext.eq_ignore_ascii_case("txt"));

                    if is_lrc_or_txt {
                        let stem_matches = path
                            .file_stem()
                            .and_then(|s| s.to_str())
                            .is_some_and(|stem| stem.eq_ignore_ascii_case(file_stem));

                        if stem_matches {
                            if let Ok(content) = fs::read_to_string(&path) {
                                let trimmed = content.trim();
                                if !trimmed.is_empty() {
                                    return Some(trimmed.to_owned());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Búsqueda de letras incrustadas en los metadatos del archivo de audio (ID3/Vorbis/FLAC)
    let options = ParseOptions::new().read_properties(false);
    if let Ok(tagged_file) = Probe::open(audio_path)
        .ok()?
        .options(options)
        .guess_file_type()
        .ok()?
        .read()
    {
        for tag in tagged_file.tags() {
            if let Some(lyrics) = tag.get_string(ItemKey::Lyrics) {
                let trimmed = lyrics.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_owned());
                }
            }
            if let Some(lyrics) = tag.get_string(ItemKey::UnsyncLyrics) {
                let trimmed = lyrics.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_owned());
                }
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};
    use super::load_track_lyrics;

    #[test]
    fn loads_matching_lrc_file() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("prisma-lyrics-{nonce}"));
        std::fs::create_dir_all(&root).unwrap();

        let audio_path = root.join("Mi Cancion.mp3");
        let lrc_path = root.join("Mi Cancion.lrc");

        std::fs::write(&audio_path, b"audio").unwrap();
        std::fs::write(&lrc_path, "[00:10.00] Primera linea\n[00:20.00] Segunda linea").unwrap();

        let lyrics = load_track_lyrics(&audio_path).unwrap();
        assert!(lyrics.contains("Primera linea"));

        let _ = std::fs::remove_dir_all(root);
    }
}
