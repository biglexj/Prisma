use serde::{Deserialize, Serialize};

use crate::features::folder_session::MediaFamily;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum VisualMediaKind {
    Image,
    Video,
}

impl VisualMediaKind {
    pub fn family(self) -> MediaFamily {
        match self {
            Self::Image => MediaFamily::Image,
            Self::Video => MediaFamily::Video,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Image => "imágenes",
            Self::Video => "vídeos",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualFolderSource {
    pub path: String,
    pub name: String,
    pub kind: VisualMediaKind,
    pub item_count: usize,
    pub available: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualLibraryItem {
    pub path: String,
    pub title: String,
    pub source_path: String,
    pub relative_folder: String,
    pub kind: VisualMediaKind,
    pub modified_at_millis: u128,
    pub size_bytes: u64,
}

#[derive(Clone, Debug)]
pub struct VisualFolderScan {
    pub source: VisualFolderSource,
    pub items: Vec<VisualLibraryItem>,
}
