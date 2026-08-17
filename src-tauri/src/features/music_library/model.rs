use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicFolderSource {
    pub path: String,
    pub name: String,
    pub track_count: usize,
    pub available: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicLibraryItem {
    pub path: String,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub source_path: String,
    pub relative_folder: String,
    pub modified_at_millis: u128,
    pub size_bytes: u64,
    pub is_excluded: bool,
}

#[derive(Clone, Debug)]
pub struct MusicFolderScan {
    pub source: MusicFolderSource,
    pub items: Vec<MusicLibraryItem>,
}
