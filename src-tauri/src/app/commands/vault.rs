use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

/// Máximo de elementos que caben en la bóveda.
pub const MAX_ITEMS: usize = 3;

/// Un elemento guardado en la bóveda.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultItem {
    pub id: String,
    pub name: String,
    /// Ruta local, cuando el archivo vino del disco.
    pub path: Option<String>,
    /// Dirección web, cuando el elemento vino de una página.
    pub url: Option<String>,
    /// `image`, `video` o `file`.
    pub kind: String,
    pub size: u64,
    /// El elemento fijado es el primero y no se expulsa nunca.
    pub pinned: bool,
    pub added_at: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VaultFile {
    items: Vec<VaultItem>,
    counter: u64,
}

/// Estado de la bóveda: vive en el backend para que la ventana flotante y la
/// ventana principal compartan la misma lista y sobreviva a un reinicio.
pub struct VaultState {
    inner: Mutex<VaultFile>,
    file_path: PathBuf,
}

impl VaultState {
    pub fn new(file_path: PathBuf) -> Self {
        let inner = std::fs::read_to_string(&file_path)
            .ok()
            .and_then(|raw| serde_json::from_str::<VaultFile>(&raw).ok())
            .unwrap_or_default();
        Self { inner: Mutex::new(inner), file_path }
    }

    fn save(&self, file: &VaultFile) {
        if let Some(parent) = self.file_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(body) = serde_json::to_string_pretty(file) {
            let _ = std::fs::write(&self.file_path, body);
        }
    }

    /// Elementos ordenados: el fijado primero y después los más recientes.
    pub fn list(&self) -> Vec<VaultItem> {
        let guard = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        let mut items = guard.items.clone();
        items.sort_by(|a, b| {
            b.pinned
                .cmp(&a.pinned)
                .then(b.added_at.cmp(&a.added_at))
        });
        items
    }

    /// Añade un elemento. Si la bóveda está llena se expulsa el más antiguo que
    /// no esté fijado.
    pub fn add(&self, path: Option<String>, url: Option<String>) -> Vec<VaultItem> {
        let mut guard = self.inner.lock().unwrap_or_else(|error| error.into_inner());

        // Un archivo que ya está en la bóveda vuelve a subir, no se duplica.
        if let Some(path) = path.as_deref() {
            if let Some(existing) = guard
                .items
                .iter_mut()
                .find(|item| item.path.as_deref() == Some(path))
            {
                existing.added_at = now_secs();
                self.save(&guard);
                drop(guard);
                return self.list();
            }
        }

        let name = path
            .as_deref()
            .map(|value| {
                value
                    .rsplit(['\\', '/'])
                    .next()
                    .unwrap_or(value)
                    .to_string()
            })
            .or_else(|| {
                url.as_deref()
                    .and_then(|value| value.rsplit('/').next())
                    .map(|value| value.to_string())
            })
            .unwrap_or_else(|| "elemento".to_string());

        let kind = kind_for(&name).to_string();
        let size = path
            .as_deref()
            .and_then(|value| std::fs::metadata(value).ok())
            .map(|meta| meta.len())
            .unwrap_or(0);

        guard.counter += 1;
        let item = VaultItem {
            id: format!("{}-{}", now_millis(), guard.counter),
            name,
            path: path.clone(),
            url: url.clone(),
            kind,
            size,
            pinned: false,
            added_at: now_secs(),
        };
        guard.items.push(item);

        // Expulsión: nunca se expulsa el elemento fijado.
        while guard.items.len() > MAX_ITEMS {
            let victim = guard
                .items
                .iter()
                .enumerate()
                .filter(|(_, item)| !item.pinned)
                .min_by_key(|(_, item)| item.added_at)
                .map(|(index, _)| index);
            match victim {
                Some(index) => {
                    guard.items.remove(index);
                }
                None => {
                    // Todo está fijado: se expulsa el más antiguo igualmente.
                    let index = guard
                        .items
                        .iter()
                        .enumerate()
                        .min_by_key(|(_, item)| item.added_at)
                        .map(|(index, _)| index)
                        .unwrap_or(0);
                    guard.items.remove(index);
                }
            }
        }

        self.save(&guard);
        drop(guard);
        self.list()
    }

    /// Quita un elemento de la bóveda.
    pub fn remove(&self, id: &str) -> Vec<VaultItem> {
        let mut guard = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        guard.items.retain(|item| item.id != id);
        self.save(&guard);
        drop(guard);
        self.list()
    }

    /// Fija o desfija un elemento. Solo puede haber uno fijado.
    pub fn toggle_pin(&self, id: &str) -> Vec<VaultItem> {
        let mut guard = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        let was_pinned = guard
            .items
            .iter()
            .find(|item| item.id == id)
            .map(|item| item.pinned)
            .unwrap_or(false);
        for item in guard.items.iter_mut() {
            item.pinned = !was_pinned && item.id == id;
        }
        self.save(&guard);
        drop(guard);
        self.list()
    }
}

fn kind_for(name: &str) -> &'static str {
    let extension = name
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase();
    match extension.as_str() {
        "jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" | "svg" | "avif" | "heic" => "image",
        "mp4" | "mkv" | "webm" | "avi" | "mov" | "m4v" | "wmv" | "flv" => "video",
        _ => "file",
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vault() -> (VaultState, PathBuf) {
        let path = std::env::temp_dir().join(format!("prisma-vault-{}.json", now_millis()));
        (VaultState::new(path.clone()), path)
    }

    #[test]
    fn la_boveda_guarda_como_maximo_tres() {
        let (state, path) = vault();
        for index in 0..5 {
            state.add(Some(format!("C:\\tmp\\archivo{index}.png")), None);
        }
        let items = state.list();
        assert_eq!(items.len(), MAX_ITEMS);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn el_elemento_fijado_no_se_expulsa_y_queda_primero() {
        let (state, path) = vault();
        state.add(Some("C:\\tmp\\uno.png".to_string()), None);
        state.add(Some("C:\\tmp\\dos.png".to_string()), None);
        let pinned = state.list()[0].id.clone();
        state.toggle_pin(&pinned);

        state.add(Some("C:\\tmp\\tres.png".to_string()), None);
        state.add(Some("C:\\tmp\\cuatro.png".to_string()), None);

        let items = state.list();
        assert_eq!(items.len(), MAX_ITEMS);
        assert_eq!(items[0].id, pinned, "el fijado va siempre primero");
        assert!(items[0].pinned);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn solo_hay_un_elemento_fijado() {
        let (state, path) = vault();
        state.add(Some("C:\\tmp\\uno.png".to_string()), None);
        state.add(Some("C:\\tmp\\dos.png".to_string()), None);
        let first = state.list()[0].id.clone();
        let second = state.list()[1].id.clone();

        state.toggle_pin(&first);
        state.toggle_pin(&second);

        let pinned = state.list().iter().filter(|item| item.pinned).count();
        assert_eq!(pinned, 1, "solo puede haber un elemento fijado");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn la_boveda_sobrevive_a_un_reinicio() {
        let path = std::env::temp_dir().join(format!("prisma-vault-persiste-{}.json", now_millis()));
        {
            let state = VaultState::new(path.clone());
            state.add(Some("C:\\tmp\\persistente.png".to_string()), None);
        }
        let reloaded = VaultState::new(path.clone());
        assert_eq!(reloaded.list().len(), 1);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn se_distingue_el_tipo_de_elemento() {
        assert_eq!(kind_for("foto.png"), "image");
        assert_eq!(kind_for("clip.mp4"), "video");
        assert_eq!(kind_for("documento.pdf"), "file");
    }
}
