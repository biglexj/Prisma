use super::{RenameBatchResult, RenameOperation};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameConflict {
    pub old_path: String,
    pub message: String,
}

fn path_key(path: &Path) -> Result<String, String> {
    let parent = path
        .parent()
        .ok_or("La ruta no tiene carpeta contenedora")?;
    let parent = fs::canonicalize(parent)
        .map_err(|e| format!("No se pudo comprobar {}: {e}", parent.display()))?;
    let name = path
        .file_name()
        .ok_or("La ruta no tiene nombre de archivo")?;
    let key = parent.join(name).to_string_lossy().to_string();
    #[cfg(windows)]
    let key = key.to_lowercase();
    Ok(key)
}

pub fn validate(ops: &[RenameOperation]) -> Vec<RenameConflict> {
    validate_inner(ops, false)
}

fn validate_inner(ops: &[RenameOperation], recovery: bool) -> Vec<RenameConflict> {
    let mut errors = Vec::new();
    let mut sources = HashSet::new();
    let mut destinations = HashSet::new();
    for op in ops {
        if op.old_path == op.new_path {
            continue;
        }
        if let Ok(key) = path_key(Path::new(&op.old_path)) {
            sources.insert(key);
        }
    }
    let mut seen_sources = HashSet::new();
    for op in ops {
        if op.old_path == op.new_path {
            continue;
        }
        let src = Path::new(&op.old_path);
        let dst = Path::new(&op.new_path);
        let result = (|| -> Result<(), String> {
            fs::symlink_metadata(src).map_err(|e| format!("No se pudo acceder al origen: {e}"))?;
            let name = dst
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or("Nombre de destino inválido")?;
            if name != op.new_name
                || name.trim().is_empty()
                || name.ends_with([' ', '.'])
                || name
                    .chars()
                    .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
            {
                return Err("Nombre de destino inválido".into());
            }
            let src_key = path_key(src)?;
            let dst_key = path_key(dst)?;
            if !recovery && Path::new(&src_key).parent() != Path::new(&dst_key).parent() {
                return Err("El renombrado debe permanecer en la misma carpeta".into());
            }
            if !seen_sources.insert(src_key.clone()) {
                return Err("Origen repetido en el lote".into());
            }
            if !destinations.insert(dst_key.clone()) {
                return Err("Varios archivos tienen el mismo destino".into());
            }
            match fs::symlink_metadata(dst) {
                Ok(_) if !sources.contains(&dst_key) => {
                    return Err(format!(
                        "Ya existe «{}». No se reemplazará; cambia el nombre o la numeración.",
                        dst.display()
                    ));
                }
                Err(e) if e.kind() != std::io::ErrorKind::NotFound => {
                    return Err(format!("No se pudo comprobar el destino: {e}"));
                }
                _ => {}
            }
            if sources
                .iter()
                .any(|other| other != &src_key && Path::new(&src_key).starts_with(Path::new(other)))
            {
                return Err("Renombra las carpetas y su contenido en lotes separados".into());
            }
            Ok(())
        })();
        if let Err(message) = result {
            errors.push(RenameConflict {
                old_path: op.old_path.clone(),
                message,
            });
        }
    }
    errors
}

/// La comprobación del destino y el movimiento son una única operación del SO.
/// Nunca usar REPLACE_EXISTING, ni siquiera al restaurar tras un error.
#[cfg(windows)]
fn move_no_replace(src: &Path, dst: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::{
        Win32::Storage::FileSystem::{MOVE_FILE_FLAGS, MoveFileExW},
        core::PCWSTR,
    };
    let src: Vec<u16> = src.as_os_str().encode_wide().chain(Some(0)).collect();
    let dst: Vec<u16> = dst.as_os_str().encode_wide().chain(Some(0)).collect();
    unsafe {
        MoveFileExW(
            PCWSTR(src.as_ptr()),
            PCWSTR(dst.as_ptr()),
            MOVE_FILE_FLAGS(0),
        )
    }
    .map_err(|e| e.to_string())
}

#[cfg(not(windows))]
fn move_no_replace(_src: &Path, _dst: &Path) -> Result<(), String> {
    Err("Renombrado protegido solo disponible en Windows".into())
}

struct Entry {
    op: RenameOperation,
    current: PathBuf,
    temporary: PathBuf,
}

pub fn execute(ops: &[RenameOperation]) -> RenameBatchResult {
    execute_with(ops, move_no_replace)
}

fn execute_with(
    ops: &[RenameOperation],
    move_file: impl FnMut(&Path, &Path) -> Result<(), String>,
) -> RenameBatchResult {
    execute_with_recovery(ops, move_file, false)
}

fn execute_with_recovery(
    ops: &[RenameOperation],
    mut move_file: impl FnMut(&Path, &Path) -> Result<(), String>,
    recovery: bool,
) -> RenameBatchResult {
    let conflicts = validate_inner(ops, recovery);
    let mut result = RenameBatchResult {
        renamed_count: 0,
        errors: conflicts.into_iter().map(|c| c.message).collect(),
        can_undo: false,
        operations: Vec::new(),
    };
    if !result.errors.is_empty() {
        return result;
    }
    let mut entries = Vec::new();
    let mut directories = Vec::new();
    for op in ops.iter().filter(|op| op.old_path != op.new_path) {
        let src = PathBuf::from(&op.old_path);
        let parent = src.parent().unwrap(); // Comprobado por validate.
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let dir = parent.join(format!(
            ".__prisma_renamer_{}_{}_{}",
            std::process::id(),
            nonce,
            entries.len()
        ));
        // create_dir reserva el espacio; nunca se reutiliza un temporal existente.
        if let Err(e) = fs::create_dir(&dir) {
            result.errors.push(format!(
                "No se pudo reservar el temporal {}: {e}",
                dir.display()
            ));
            break;
        }
        entries.push(Entry {
            op: op.clone(),
            current: src,
            temporary: dir.join("file"),
        });
        directories.push(dir);
    }
    if result.errors.is_empty() {
        for entry in &mut entries {
            match move_file(&entry.current, &entry.temporary) {
                Ok(()) => entry.current = entry.temporary.clone(),
                Err(e) => {
                    result.errors.push(format!(
                        "No se pudo preparar {}: {e}",
                        entry.current.display()
                    ));
                    break;
                }
            }
        }
    }
    if result.errors.is_empty() {
        for entry in &mut entries {
            let dst = PathBuf::from(&entry.op.new_path);
            match move_file(&entry.current, &dst) {
                Ok(()) => entry.current = dst,
                Err(e) => {
                    result
                        .errors
                        .push(format!("No se pudo renombrar a {}: {e}", dst.display()));
                    break;
                }
            }
        }
    }
    if !result.errors.is_empty() {
        // Apartar primero los destinos ya aplicados para deshacer también ciclos.
        for entry in &mut entries {
            if entry.current == Path::new(&entry.op.new_path) {
                match move_file(&entry.current, &entry.temporary) {
                    Ok(()) => entry.current = entry.temporary.clone(),
                    Err(e) => result
                        .errors
                        .push(format!("Se conserva {}: {e}", entry.current.display())),
                }
            }
        }
        for entry in &mut entries {
            if entry.current == entry.temporary {
                let src = PathBuf::from(&entry.op.old_path);
                match move_file(&entry.current, &src) {
                    Ok(()) => entry.current = src,
                    Err(e) => result.errors.push(format!(
                        "No se pudo restaurar {}; archivo conservado en {}: {e}",
                        src.display(),
                        entry.current.display()
                    )),
                }
            }
        }
    }
    for entry in entries {
        if entry.current != Path::new(&entry.op.old_path) {
            let mut op = entry.op;
            op.new_path = entry.current.to_string_lossy().into_owned();
            op.new_name = entry
                .current
                .file_name()
                .unwrap()
                .to_string_lossy()
                .into_owned();
            result.operations.push(op);
        }
    }
    // Solo eliminar contenedores vacíos; si la restauración falla, preservar el archivo.
    for dir in directories {
        let _ = fs::remove_dir(dir);
    }
    result.renamed_count = result.operations.len();
    result.can_undo = !result.operations.is_empty();
    result
}

pub fn execute_recorded(
    ops: &[RenameOperation],
    history: &mut Vec<RenameOperation>,
) -> RenameBatchResult {
    let mut result = execute(ops);
    if !result.operations.is_empty() {
        *history = result.operations.clone();
    }
    result.can_undo = !history.is_empty();
    result
}

pub fn undo(history: &mut Vec<RenameOperation>) -> RenameBatchResult {
    let inverse: Vec<_> = history
        .iter()
        .map(|op| RenameOperation {
            old_path: op.new_path.clone(),
            new_path: op.old_path.clone(),
            original_name: op.new_name.clone(),
            new_name: op.original_name.clone(),
        })
        .collect();
    let mut result = execute_with_recovery(&inverse, move_no_replace, true);
    for op in &mut *history {
        if let Some(moved) = result.operations.iter().find(|m| m.old_path == op.new_path) {
            op.new_path = moved.new_path.clone();
            op.new_name = moved.new_name.clone();
        }
    }
    history.retain(|op| op.old_path != op.new_path);
    result.can_undo = !history.is_empty();
    result
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let nonce = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "prisma_safe_rename_{}_{}_{}",
                std::process::id(),
                nonce,
                NEXT.fetch_add(1, Ordering::SeqCst)
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn write(&self, name: &str, bytes: &[u8]) {
            fs::write(self.0.join(name), bytes).unwrap();
        }
        fn read(&self, name: &str) -> Vec<u8> {
            fs::read(self.0.join(name)).unwrap()
        }
        fn op(&self, from: &str, to: &str) -> RenameOperation {
            RenameOperation {
                old_path: self.0.join(from).to_string_lossy().into_owned(),
                new_path: self.0.join(to).to_string_lossy().into_owned(),
                original_name: from.into(),
                new_name: to.into(),
            }
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            assert_eq!(self.0.parent(), Some(std::env::temp_dir().as_path()));
            assert!(
                self.0
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("prisma_safe_rename_")
            );
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn smaller_second_batch_preserves_all_fifteen_files() {
        use sha2::{Digest, Sha256};
        let f = Fixture::new();
        let mut original = Vec::new();
        for i in 1..=10 {
            let name = format!("imagen {i}.png");
            f.write(&name, &[i]);
            original.push((name, Sha256::digest([i])));
        }
        let mut ops = Vec::new();
        for i in 1..=5 {
            let name = format!("nueva {i}.png");
            f.write(&name, &[100 + i]);
            original.push((name.clone(), Sha256::digest([100 + i])));
            ops.push(f.op(&name, &format!("imagen {i}.png")));
        }
        let result = execute(&ops);
        assert_eq!(result.renamed_count, 0);
        assert_eq!(result.errors.len(), 5);
        for (name, hash) in original {
            assert_eq!(Sha256::digest(f.read(&name)), hash);
        }
        assert_eq!(fs::read_dir(&f.0).unwrap().count(), 15);
    }

    #[test]
    fn one_conflict_blocks_the_entire_batch() {
        let f = Fixture::new();
        f.write("a", b"a");
        f.write("b", b"b");
        f.write("occupied", b"old");
        let result = execute(&[f.op("a", "free"), f.op("b", "occupied")]);
        assert_eq!(result.renamed_count, 0);
        assert_eq!(f.read("a"), b"a");
        assert_eq!(f.read("occupied"), b"old");
    }

    #[test]
    fn duplicate_destinations_and_alias_sources_are_blocked() {
        let f = Fixture::new();
        f.write("a", b"a");
        f.write("b", b"b");
        assert!(!execute(&[f.op("a", "x"), f.op("b", "X")]).errors.is_empty());
        let mut alias = f.op("a", "y");
        alias.old_path = f.0.join(".\\a").to_string_lossy().into_owned();
        assert!(!execute(&[f.op("a", "x"), alias]).errors.is_empty());
        assert_eq!(f.read("a"), b"a");
    }

    #[test]
    fn cycles_and_case_only_renames_can_be_undone() {
        let f = Fixture::new();
        f.write("a", b"a");
        f.write("b", b"b");
        let mut history = Vec::new();
        assert!(
            execute_recorded(&[f.op("a", "b"), f.op("b", "a")], &mut history)
                .errors
                .is_empty()
        );
        assert_eq!(f.read("a"), b"b");
        assert_eq!(f.read("b"), b"a");
        assert!(undo(&mut history).errors.is_empty());
        assert!(history.is_empty());
        assert_eq!(f.read("a"), b"a");
        assert_eq!(f.read("b"), b"b");
        assert!(
            execute_recorded(&[f.op("a", "A")], &mut history)
                .errors
                .is_empty()
        );
        assert!(
            fs::read_dir(&f.0)
                .unwrap()
                .any(|e| e.unwrap().file_name() == "A")
        );
        assert!(undo(&mut history).errors.is_empty());
    }

    #[test]
    fn failed_batch_and_blocked_undo_keep_history() {
        let f = Fixture::new();
        f.write("a", b"first");
        f.write("b", b"second");
        let mut history = Vec::new();
        execute_recorded(&[f.op("a", "renamed")], &mut history);
        let rejected = execute_recorded(&[f.op("b", "renamed")], &mut history);
        assert!(rejected.can_undo);
        assert_eq!(history[0].old_path, f.op("a", "renamed").old_path);
        f.write("a", b"external");
        let rejected = undo(&mut history);
        assert!(rejected.can_undo);
        assert!(!rejected.errors.is_empty());
        assert_eq!(f.read("a"), b"external");
        assert_eq!(f.read("renamed"), b"first");
        move_no_replace(&f.0.join("a"), &f.0.join("external")).unwrap();
        assert!(undo(&mut history).errors.is_empty());
        assert!(history.is_empty());
        assert_eq!(f.read("a"), b"first");
        assert_eq!(f.read("external"), b"external");
    }

    #[test]
    fn target_created_after_validation_is_never_overwritten() {
        let f = Fixture::new();
        f.write("a", b"original");
        let result = execute_with(&[f.op("a", "target")], |src, dst| {
            if dst == f.0.join("target") {
                f.write("target", b"arrived later");
            }
            move_no_replace(src, dst)
        });
        assert!(!result.errors.is_empty());
        assert_eq!(result.renamed_count, 0);
        assert_eq!(f.read("a"), b"original");
        assert_eq!(f.read("target"), b"arrived later");
    }

    #[test]
    fn staging_failure_restores_previously_staged_sources() {
        let f = Fixture::new();
        f.write("a", b"a");
        f.write("b", b"b");
        let mut calls = 0;
        let result = execute_with(&[f.op("a", "x"), f.op("b", "y")], |src, dst| {
            calls += 1;
            if calls == 2 {
                return Err("injected failure".into());
            }
            move_no_replace(src, dst)
        });
        assert!(!result.errors.is_empty());
        assert_eq!(result.renamed_count, 0);
        assert_eq!(f.read("a"), b"a");
        assert_eq!(f.read("b"), b"b");
        assert_eq!(fs::read_dir(&f.0).unwrap().count(), 2);
    }

    #[test]
    fn commit_failure_rolls_back_a_cycle() {
        let f = Fixture::new();
        f.write("a", b"a");
        f.write("b", b"b");
        let mut calls = 0;
        let result = execute_with(&[f.op("a", "b"), f.op("b", "a")], |src, dst| {
            calls += 1;
            if calls == 4 {
                return Err("injected commit failure".into());
            }
            move_no_replace(src, dst)
        });
        assert!(!result.errors.is_empty());
        assert_eq!(result.renamed_count, 0);
        assert_eq!(f.read("a"), b"a");
        assert_eq!(f.read("b"), b"b");
    }

    #[test]
    fn blocked_rollback_preserves_recovery_file_and_can_retry_undo() {
        let f = Fixture::new();
        f.write("a", b"original");
        let result = execute_with(&[f.op("a", "target")], |src, dst| {
            if dst == f.0.join("target") {
                f.write("a", b"external");
                return Err("injected failure".into());
            }
            move_no_replace(src, dst)
        });
        assert!(!result.errors.is_empty());
        assert!(result.can_undo);
        assert_eq!(f.read("a"), b"external");
        assert_eq!(
            fs::read(&result.operations[0].new_path).unwrap(),
            b"original"
        );
        move_no_replace(&f.0.join("a"), &f.0.join("external")).unwrap();
        let mut history = result.operations;
        // El archivo de recuperación vive en otra carpeta: no aplicar el requisito de
        // misma carpeta a esta recuperación (se comprueba explícitamente abajo).
        let reverted = undo(&mut history);
        assert!(reverted.errors.is_empty(), "{:?}", reverted.errors);
        assert_eq!(f.read("a"), b"original");
    }

    #[test]
    fn folder_swaps_preserve_contents_and_nested_sources_are_rejected() {
        let f = Fixture::new();
        fs::create_dir(f.0.join("one")).unwrap();
        fs::create_dir(f.0.join("two")).unwrap();
        f.write("one/a", b"a");
        f.write("two/b", b"b");
        let mut child = f.op("one/a", "one/c");
        child.new_name = "c".into();
        assert!(!execute(&[f.op("one", "other"), child]).errors.is_empty());
        let mut history = Vec::new();
        assert!(
            execute_recorded(&[f.op("one", "two"), f.op("two", "one")], &mut history)
                .errors
                .is_empty()
        );
        assert_eq!(f.read("two/a"), b"a");
        assert_eq!(f.read("one/b"), b"b");
        assert!(undo(&mut history).errors.is_empty());
        assert_eq!(f.read("one/a"), b"a");
    }
}
