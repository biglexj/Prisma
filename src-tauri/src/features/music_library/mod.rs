pub mod duplicates;
mod model;
mod scanner;

pub use duplicates::scan_music_duplicates;
pub use model::{MusicFolderScan, MusicFolderSource, MusicLibraryItem};
pub use scanner::scan_music_folder;

