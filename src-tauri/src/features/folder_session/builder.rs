use std::{fs, path::Path};

use super::{FolderSession, MediaFamily, classify_path, natural_sort::compare_naturally};

pub fn build_folder_session(opened_path: &Path) -> Result<FolderSession, String> {
    let family = classify_path(opened_path).unwrap_or(MediaFamily::Audio);
    let parent = match opened_path.parent() {
        Some(p) if p.exists() => p,
        _ => {
            return FolderSession::new(family, vec![opened_path.to_path_buf()], 0);
        }
    };

    let entries = match fs::read_dir(parent) {
        Ok(e) => e,
        Err(_) => {
            return FolderSession::new(family, vec![opened_path.to_path_buf()], 0);
        }
    };

    let mut items = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_file() && classify_path(path) == Some(family))
        .collect::<Vec<_>>();

    items.sort_by(|left, right| {
        let left_name = file_name(left);
        let right_name = file_name(right);
        compare_naturally(&left_name, &right_name)
    });

    let opened_name_lower = opened_path
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let current_index = items
        .iter()
        .position(|candidate| {
            candidate == opened_path
                || candidate.file_name().map(|n| n.to_string_lossy().to_lowercase()) == Some(opened_name_lower.clone())
                || candidate.canonicalize().ok() == opened_path.canonicalize().ok()
        })
        .unwrap_or_else(|| {
            items.push(opened_path.to_path_buf());
            items.len() - 1
        });

    FolderSession::new(family, items, current_index)
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default()
}
