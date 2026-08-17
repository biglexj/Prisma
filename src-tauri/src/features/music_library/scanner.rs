use std::{
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use crate::features::folder_session::{
    MediaFamily, classify_path, clean_path, compare_naturally, is_ignored_directory_name, is_path_excluded,
};

use lofty::{file::TaggedFileExt, tag::Accessor};

use super::{MusicFolderScan, MusicFolderSource, MusicLibraryItem};

pub fn scan_music_folder(
    root: &Path,
    excluded_paths: &[String],
) -> Result<MusicFolderScan, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("No se pudo abrir la carpeta de música: {error}"))?;

    if !canonical_root.is_dir() {
        return Err("La ruta seleccionada no es una carpeta.".to_owned());
    }

    let source_path = clean_path(&canonical_root);
    let source_name = canonical_root
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or(&source_path)
        .to_owned();
    let mut pending = vec![canonical_root.clone()];
    let mut items = Vec::new();

    while let Some(directory) = pending.pop() {
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(_) if directory != canonical_root => continue,
            Err(error) => return Err(format!("No se pudo leer la carpeta de música: {error}")),
        };

        for entry in entries.flatten() {
            let path = entry.path();

            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(_) => continue,
            };

            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                let dir_name = entry.file_name().to_string_lossy().into_owned();
                if !is_ignored_directory_name(&dir_name) {
                    pending.push(path);
                }
                continue;
            }
            if !file_type.is_file() || classify_path(&path) != Some(MediaFamily::Audio) {
                continue;
            }

            let is_excluded = is_path_excluded(&path, excluded_paths);

            let metadata = entry.metadata().ok();
            let modified_at_millis = metadata
                .as_ref()
                .and_then(|metadata| metadata.modified().ok())
                .unwrap_or(SystemTime::UNIX_EPOCH)
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();

            let mut title = path
                .file_stem()
                .and_then(|name| name.to_str())
                .unwrap_or("Pista sin nombre")
                .to_owned();

            let mut artist = None;
            let mut album = None;

            if let Ok(probe) = lofty::probe::Probe::open(&path) {
                if let Ok(tagged_file) = probe
                    .options(lofty::config::ParseOptions::new().read_properties(false))
                    .read()
                {
                    if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
                        if let Some(t) = tag.title().as_deref() {
                            if !t.trim().is_empty() {
                                title = t.trim().to_string();
                            }
                        }
                        if let Some(a) = tag.artist().as_deref() {
                            if !a.trim().is_empty() {
                                artist = Some(a.trim().to_string());
                            }
                        }
                        if let Some(alb) = tag.album().as_deref() {
                            if !alb.trim().is_empty() {
                                album = Some(alb.trim().to_string());
                            }
                        }
                    }
                }
            }

            let relative_folder = path
                .parent()
                .and_then(|parent| parent.strip_prefix(&canonical_root).ok())
                .map(|relative| {
                    if relative.as_os_str().is_empty() {
                        source_name.clone()
                    } else {
                        relative.to_string_lossy().into_owned()
                    }
                })
                .unwrap_or_else(|| source_name.clone());

            items.push(MusicLibraryItem {
                path: clean_path(&path),
                title,
                artist,
                album,
                source_path: source_path.clone(),
                relative_folder,
                modified_at_millis,
                size_bytes: metadata.map_or(0, |metadata| metadata.len()),
                is_excluded,
            });
        }
    }

    items.sort_by(|left, right| {
        right
            .modified_at_millis
            .cmp(&left.modified_at_millis)
            .then_with(|| compare_naturally(&left.path, &right.path))
    });

    let non_excluded_count = items.iter().filter(|it| !it.is_excluded).count();

    Ok(MusicFolderScan {
        source: MusicFolderSource {
            path: source_path,
            name: source_name,
            track_count: non_excluded_count,
            available: true,
        },
        items,
    })
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::scan_music_folder;

    #[test]
    fn scans_audio_recursively_and_ignores_other_media() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("prisma-music-scan-{nonce}"));
        let album = root.join("Álbum 2");
        fs::create_dir_all(&album).unwrap();
        fs::write(root.join("10.mp3"), []).unwrap();
        fs::write(root.join("portada.png"), []).unwrap();
        fs::write(album.join("02.FLAC"), []).unwrap();

        let scan = scan_music_folder(&root, &[]).unwrap();

        assert_eq!(scan.source.track_count, 2);
        assert_eq!(scan.items.len(), 2);

        let excluded_scan = scan_music_folder(&root, &[album.to_string_lossy().into_owned()]).unwrap();
        assert_eq!(excluded_scan.source.track_count, 1);
        assert_eq!(excluded_scan.items.len(), 2);
        assert_eq!(excluded_scan.items.iter().filter(|it| !it.is_excluded).count(), 1);
        assert_eq!(excluded_scan.items.iter().filter(|it| it.is_excluded).count(), 1);

        fs::remove_dir_all(root).unwrap();
    }
}
