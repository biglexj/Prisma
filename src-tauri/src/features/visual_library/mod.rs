pub mod duplicates;
mod model;
mod scanner;

pub use duplicates::{scan_duplicates, DuplicateGroup, DuplicateScanOptions};
pub use model::{VisualFolderScan, VisualFolderSource, VisualLibraryItem, VisualMediaKind};
pub use scanner::scan_visual_folder;
