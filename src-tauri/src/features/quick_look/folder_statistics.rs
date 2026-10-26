use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderStatistics {
    files: u64,
    folders: u64,
    bytes: u64,
    images: u64,
    videos: u64,
    documents: u64,
    created_millis: Option<u64>,
    incomplete: bool,
}

fn inspect(path: &Path) -> Result<FolderStatistics, String> {
    let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
    if !metadata.is_dir() { return Err("La ruta no es una carpeta".into()); }
    let mut stats = FolderStatistics {
        created_millis: metadata.created().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64),
        ..Default::default()
    };
    let mut pending = vec![PathBuf::from(path)];
    while let Some(dir) = pending.pop() {
        let entries = match std::fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => { stats.incomplete = true; continue; }
        };
        for entry in entries {
            let entry = match entry { Ok(entry) => entry, Err(_) => { stats.incomplete = true; continue; } };
            let metadata = match std::fs::symlink_metadata(entry.path()) { Ok(m) => m, Err(_) => { stats.incomplete = true; continue; } };
            // No seguir enlaces ni puntos de unión: podrían crear ciclos o salir de la carpeta.
            #[cfg(windows)]
            let is_link = { use std::os::windows::fs::MetadataExt; metadata.file_attributes() & 0x400 != 0 };
            #[cfg(not(windows))]
            let is_link = metadata.file_type().is_symlink();
            if is_link { stats.incomplete = true; continue; }
            if metadata.is_dir() { stats.folders += 1; pending.push(entry.path()); }
            else if metadata.is_file() {
                stats.files += 1;
                stats.bytes = stats.bytes.saturating_add(metadata.len());
                let ext = entry.path().extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
                match ext.as_str() {
                    "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "tif" | "tiff" | "svg" | "avif" | "heic" | "heif" | "ico" | "elx" => stats.images += 1,
                    "mp4" | "mkv" | "mov" | "avi" | "webm" | "wmv" | "m4v" | "mpeg" | "mpg" | "ts" => stats.videos += 1,
                    "txt" | "md" | "markdown" | "pdf" | "doc" | "docx" | "odt" | "rtf" | "epub" | "tex" | "csv" | "xls" | "xlsx" | "ods" | "ppt" | "pptx" | "odp" => stats.documents += 1,
                    _ => {}
                }
            }
        }
    }
    Ok(stats)
}

#[tauri::command]
pub async fn quick_look_folder_statistics(path: String) -> Result<FolderStatistics, String> {
    tauri::async_runtime::spawn_blocking(move || inspect(Path::new(&path)))
        .await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn counts_nested_files_and_types() {
        let root = std::env::temp_dir().join(format!("prisma-folder-stats-{}", std::process::id()));
        std::fs::create_dir_all(root.join("nested")).unwrap();
        std::fs::write(root.join("a.md"), b"123").unwrap();
        std::fs::write(root.join("nested/b.JPG"), b"12345").unwrap();
        std::fs::write(root.join("nested/c.mp4"), b"1").unwrap();
        let stats = inspect(&root).unwrap();
        assert_eq!((stats.files, stats.folders, stats.bytes), (3, 1, 9));
        assert_eq!((stats.images, stats.videos, stats.documents), (1, 1, 1));
        assert!(!stats.incomplete);
        std::fs::remove_dir_all(root).unwrap();
    }
}
