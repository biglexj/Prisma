use std::{
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use crate::features::folder_session::{
    classify_path, clean_path, compare_naturally, is_path_excluded,
};

use super::{VisualFolderScan, VisualFolderSource, VisualLibraryItem, VisualMediaKind};

pub fn scan_visual_folder(
    root: &Path,
    kind: VisualMediaKind,
    excluded_paths: &[String],
) -> Result<VisualFolderScan, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("No se pudo abrir la carpeta de {}: {error}", kind.label()))?;

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
        let is_dir_excluded = is_path_excluded(&directory, excluded_paths);

        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(_) if directory != canonical_root => continue,
            Err(error) => {
                return Err(format!(
                    "No se pudo leer la carpeta de {}: {error}",
                    kind.label()
                ));
            }
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
                if !entry.file_name().to_string_lossy().starts_with('.') {
                    pending.push(path);
                }
                continue;
            }
            if !file_type.is_file() || classify_path(&path) != Some(kind.family()) {
                continue;
            }

            let is_excluded = is_dir_excluded || is_path_excluded(&path, excluded_paths);

            let metadata = entry.metadata().ok();
            let modified_at_millis = metadata
                .as_ref()
                .and_then(|metadata| metadata.modified().ok())
                .unwrap_or(SystemTime::UNIX_EPOCH)
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();
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

            items.push(VisualLibraryItem {
                title: path
                    .file_stem()
                    .and_then(|name| name.to_str())
                    .unwrap_or("Archivo sin nombre")
                    .to_owned(),
                path: clean_path(&path),
                source_path: source_path.clone(),
                relative_folder,
                kind,
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

    Ok(VisualFolderScan {
        source: VisualFolderSource {
            path: source_path,
            name: source_name,
            kind,
            item_count: non_excluded_count,
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

    use super::{VisualMediaKind, scan_visual_folder};

    #[test]
    fn separates_images_and_videos_recursively() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("prisma-visual-scan-{nonce}"));
        let nested = root.join("Vacaciones");
        fs::create_dir_all(&nested).unwrap();
        fs::write(root.join("foto 10.JPG"), []).unwrap();
        fs::write(nested.join("foto 2.webp"), []).unwrap();
        fs::write(nested.join("clip.mp4"), []).unwrap();

        let images = scan_visual_folder(&root, VisualMediaKind::Image, &[]).unwrap();
        let videos = scan_visual_folder(&root, VisualMediaKind::Video, &[]).unwrap();

        assert_eq!(images.source.item_count, 2);
        assert_eq!(videos.source.item_count, 1);
        assert!(videos.items[0].path.ends_with("clip.mp4"));

        let excluded_images = scan_visual_folder(&root, VisualMediaKind::Image, &[nested.to_string_lossy().into_owned()]).unwrap();
        assert_eq!(excluded_images.source.item_count, 1);
        assert_eq!(excluded_images.items.len(), 2);
        assert_eq!(excluded_images.items.iter().filter(|it| !it.is_excluded).count(), 1);
        assert_eq!(excluded_images.items.iter().filter(|it| it.is_excluded).count(), 1);

        fs::remove_dir_all(root).unwrap();
    }
}
