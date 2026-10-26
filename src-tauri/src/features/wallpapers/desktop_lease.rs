//! Bloqueos por usuario que Windows libera al terminar el proceso.
use std::{fs::{File, OpenOptions}, path::Path};

pub fn acquire(path: &Path) -> Result<Option<File>, String> {
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        match OpenOptions::new().read(true).write(true).create(true).truncate(false).share_mode(0).open(path) {
            Ok(file) => Ok(Some(file)),
            Err(error) if matches!(error.raw_os_error(), Some(32 | 33)) => Ok(None),
            Err(error) => Err(format!("No se pudo coordinar el fondo: {error}")),
        }
    }
    #[cfg(not(windows))]
    { let _ = path; Err("La coordinación de fondos requiere Windows".into()) }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn lease_excludes_peers_and_is_reusable_after_release() {
        let path = std::env::temp_dir().join(format!("prisma-lease-{}.lock", std::process::id()));
        let first = acquire(&path).unwrap().unwrap();
        assert!(acquire(&path).unwrap().is_none());
        drop(first);
        assert!(acquire(&path).unwrap().is_some());
        std::fs::remove_file(path).unwrap();
    }
}
