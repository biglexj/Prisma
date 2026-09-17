pub mod duplicates;
mod model;
mod scanner;
pub mod video_proxy;

pub use duplicates::{scan_duplicates, DuplicateCandidate, DuplicateGroup, DuplicateScanOptions};
pub use model::{VisualFolderScan, VisualFolderSource, VisualLibraryItem, VisualMediaKind};
pub use scanner::scan_visual_folder;
pub use video_proxy::{resolve_video_playback_source, VideoPlaybackSource};
