use std::{fs, path::Path};

use super::{FolderSession, classify_path, natural_sort::compare_naturally};

pub fn build_folder_session(opened_path: &Path) -> Result<FolderSession, String> {
    let family = classify_path(opened_path).ok_or_else(|| {
        "El archivo seleccionado no pertenece a una familia multimedia compatible.".to_owned()
    })?;
    let parent = opened_path
        .parent()
        .ok_or_else(|| "No se pudo determinar la carpeta del archivo.".to_owned())?;

    let entries =
        fs::read_dir(parent).map_err(|error| format!("No se pudo leer la carpeta: {error}"))?;
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

    let opened_name = opened_path.file_name();
    let current_index = items
        .iter()
        .position(|candidate| candidate == opened_path || candidate.file_name() == opened_name)
        .ok_or_else(|| "El archivo abierto no apareció dentro de su propia carpeta.".to_owned())?;

    FolderSession::new(family, items, current_index)
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default()
}
