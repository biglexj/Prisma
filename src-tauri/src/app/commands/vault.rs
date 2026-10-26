use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

/// Máximo de elementos que caben en la bóveda.
pub const MAX_ITEMS: usize = 5;
pub const MAX_PINNED: usize = 2;

/// Un elemento guardado en la bóveda.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultItem {
    pub id: String,
    pub name: String,
    /// Ruta local, cuando el archivo vino del disco.
    pub path: Option<String>,
    /// Archivo de origen o copia guardada por el usuario. Nunca la caché interna.
    #[serde(default)]
    pub location_path: Option<String>,
    /// Dirección web, cuando el elemento vino de una página.
    pub url: Option<String>,
    /// `image`, `video` o `file`.
    pub kind: String,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub slot: Option<usize>,
    pub size: u64,
    /// Los elementos fijados van primero y no se expulsan automáticamente.
    pub pinned: bool,
    pub added_at: u64,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
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
        let mut inner = std::fs::read_to_string(&file_path)
            .ok()
            .and_then(|raw| serde_json::from_str::<VaultFile>(&raw).ok())
            .unwrap_or_default();
        // Los estados anteriores no conservaban el origen de los archivos
        // importados a caché. Solo inferir ubicaciones externas verificables.
        let cache = file_path.parent().unwrap_or(std::path::Path::new(".")).join("vault-items");
        for item in &mut inner.items {
            if item.location_path.is_none() {
                if let Some(path) = item.path.as_deref().filter(|path| !std::path::Path::new(path).starts_with(&cache)) {
                    item.location_path = Some(path.to_string());
                }
            }
        }
        // Asignación estable de casillas para poder pegar en un hueco concreto.
        let mut used = [false; MAX_ITEMS];
        for item in &mut inner.items {
            let slot = item.slot.filter(|slot| *slot < MAX_ITEMS && !used[*slot])
                .or_else(|| used.iter().position(|occupied| !occupied));
            item.slot = slot;
            if let Some(slot) = slot { used[slot] = true; }
        }
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

    /// Fijados primero; dentro de cada grupo, del más antiguo al más reciente.
    /// Las capturas y los archivos nuevos llenan las casillas de izquierda a derecha.
    pub fn list(&self) -> Vec<VaultItem> {
        let guard = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        let mut items = guard.items.clone();
        items.sort_by(|a, b| {
            b.pinned
                .cmp(&a.pinned)
                .then(a.added_at.cmp(&b.added_at))
        });
        items
    }

    /// Añade un elemento. Si la bóveda está llena se expulsa el más antiguo que
    /// no esté fijado.
    pub fn add(&self, path: Option<String>, url: Option<String>) -> Vec<VaultItem> {
        self.add_with_pin(path, url, false).unwrap_or_else(|_| self.list())
    }

    pub fn add_with_pin(&self, path: Option<String>, url: Option<String>, pinned: bool) -> Result<Vec<VaultItem>, String> {
        let location_path = path.clone();
        self.add_with_location(path, url, pinned, location_path)
    }

    pub fn add_with_location(&self, path: Option<String>, url: Option<String>, pinned: bool, location_path: Option<String>) -> Result<Vec<VaultItem>, String> {
        self.add_at_slot(path, url, pinned, location_path, None, None)
    }

    pub fn add_at_slot(&self, path: Option<String>, url: Option<String>, pinned: bool, location_path: Option<String>, target_slot: Option<usize>, text: Option<String>) -> Result<Vec<VaultItem>, String> {
        let mut guard = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        let existing_id = guard.items.iter().find(|item| {
            path.is_some() && item.path == path || url.is_some() && item.url == url
        }).map(|item| item.id.clone());
        if pinned && guard.items.iter().filter(|item| item.pinned && Some(&item.id) != existing_id.as_ref()).count() >= MAX_PINNED {
            return Err("Puedes fijar hasta dos elementos".into());
        }
        let timestamp = now_millis().max(guard.items.iter().map(|item| item.added_at).max().unwrap_or(0) + 1);

        // Un archivo que ya está en la bóveda pasa al final de su grupo, sin duplicarse.
        if let Some(path) = path.as_deref() {
            if let Some(existing) = guard
                .items
                .iter_mut()
                .find(|item| item.path.as_deref() == Some(path))
            {
                existing.added_at = timestamp;
                existing.pinned |= pinned;
                if location_path.is_some() { existing.location_path = location_path; }
                if text.is_some() {
                    existing.kind = if url.is_some() { "link" } else { "text" }.into();
                    existing.text = text;
                    existing.url = url;
                }
                self.save(&guard);
                drop(guard);
                return Ok(self.list());
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

        let kind = if text.is_some() { if url.is_some() { "link" } else { "text" } } else { kind_for(&name) }.to_string();
        let size = path
            .as_deref()
            .and_then(|value| std::fs::metadata(value).ok())
            .map(|meta| meta.len())
            .unwrap_or(0);

        let target_slot = target_slot.filter(|slot| *slot < MAX_ITEMS);
        let slot = if let Some(slot) = target_slot {
            if guard.items.iter().any(|item| item.slot == Some(slot) && item.pinned) {
                return Err("Esta casilla está fijada. Elige otra para pegar.".into());
            }
            guard.items.retain(|item| item.slot != Some(slot));
            slot
        } else if let Some(slot) = (0..MAX_ITEMS).find(|slot| !guard.items.iter().any(|item| item.slot == Some(*slot))) {
            slot
        } else {
            let victim = guard.items.iter().enumerate().filter(|(_, item)| !item.pinned)
                .min_by_key(|(_, item)| item.added_at).map(|(index, _)| index)
                .ok_or("No hay casillas libres")?;
            guard.items.remove(victim).slot.unwrap_or(0)
        };
        guard.counter += 1;
        let item = VaultItem {
            id: format!("{}-{}", now_millis(), guard.counter),
            name,
            path: path.clone(),
            location_path,
            url: url.clone(),
            kind,
            text,
            slot: Some(slot),
            size,
            pinned,
            added_at: timestamp,
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
                    // Incluso un estado antiguo debe conservar sus fijados.
                    break;
                }
            }
        }

        self.save(&guard);
        drop(guard);
        Ok(self.list())
    }

    /// Actualiza la misma tarjeta después de exportar, sin duplicarla ni alterar
    /// su orden/fijado. Publicar la ubicación solo tras persistirla correctamente.
    pub fn mark_saved(&self, id: &str, location_path: String) -> Result<Vec<VaultItem>, String> {
        let mut guard = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        let mut next = guard.clone();
        let item = next.items.iter_mut().find(|item| item.id == id)
            .ok_or("El elemento ya no está en Synapse")?;
        item.location_path = Some(location_path);
        if let Some(parent) = self.file_path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let body = serde_json::to_string_pretty(&next).map_err(|error| error.to_string())?;
        std::fs::write(&self.file_path, body).map_err(|error| error.to_string())?;
        *guard = next;
        drop(guard);
        Ok(self.list())
    }

    /// Quita un elemento de la bóveda.
    pub fn remove(&self, id: &str) -> Vec<VaultItem> {
        let mut guard = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        guard.items.retain(|item| item.id != id);
        self.save(&guard);
        drop(guard);
        self.list()
    }

    /// Permite hasta dos fijados y conserva los demás espacios para temporales.
    pub fn toggle_pin(&self, id: &str) -> Result<Vec<VaultItem>, String> {
        let mut guard = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        let was_pinned = guard
            .items
            .iter()
            .find(|item| item.id == id)
            .map(|item| item.pinned)
            .unwrap_or(false);
        if !was_pinned && guard.items.iter().filter(|item| item.pinned).count() >= MAX_PINNED {
            return Err("Puedes fijar hasta dos elementos".into());
        }
        if let Some(item) = guard.items.iter_mut().find(|item| item.id == id) {
            item.pinned = !was_pinned;
        }
        self.save(&guard);
        drop(guard);
        Ok(self.list())
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

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pegar_respeta_casilla_huecos_fijados_y_persistencia_del_texto() {
        let (state, file) = vault();
        state.add_at_slot(Some("cache/Texto.txt".into()), None, false, None, Some(3), Some("Canción\nSegunda línea".into())).unwrap();
        let first = state.list()[0].clone();
        assert_eq!(first.slot, Some(3));
        assert_eq!(first.kind, "text");
        state.add(Some("a.png".into()), None);
        assert_eq!(state.list().iter().find(|item| item.name == "a.png").unwrap().slot, Some(0));
        state.toggle_pin(&first.id).unwrap();
        assert!(state.add_at_slot(Some("otro.txt".into()), None, false, None, Some(3), Some("Otro".into())).is_err());
        let restored = VaultState::new(file.clone());
        assert_eq!(restored.list().iter().find(|item| item.id == first.id).unwrap().text.as_deref(), Some("Canción\nSegunda línea"));
        assert_eq!(restored.list().len(), 2);
        let _ = std::fs::remove_file(file);
    }

    #[test]
    fn pegar_sobre_temporal_solo_reemplaza_la_casilla_elegida() {
        let (state, file) = vault();
        state.add(Some("a.png".into()), None);
        state.add(Some("b.png".into()), None);
        let items = state.add_at_slot(Some("texto.txt".into()), None, false, None, Some(0), Some("Contenido".into())).unwrap();
        assert_eq!(items.len(), 2);
        assert!(items.iter().any(|item| item.name == "b.png" && item.slot == Some(1)));
        assert!(items.iter().any(|item| item.kind == "text" && item.slot == Some(0)));
        let _ = std::fs::remove_file(file);
    }

    fn vault() -> (VaultState, PathBuf) {
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let path = std::env::temp_dir().join(format!("prisma-vault-{}-{}.json", now_millis(), NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)));
        (VaultState::new(path.clone()), path)
    }

    #[test]
    fn guardar_conserva_tarjeta_y_persistencia_sin_exponer_la_cache_como_ubicacion() {
        let (state, path) = vault();
        let items = state.add_with_location(Some("cache/Imagen.png".into()), None, true, None).unwrap();
        let original = items[0].clone();
        assert!(original.location_path.is_none());
        let items = state.mark_saved(&original.id, "D:\\Imágenes\\Prisma\\Imagen.png".into()).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, original.id);
        assert_eq!(items[0].path, original.path);
        assert_eq!(items[0].added_at, original.added_at);
        assert!(items[0].pinned);
        let restored = VaultState::new(path.clone()).list();
        assert_eq!(restored[0].location_path.as_deref(), Some("D:\\Imágenes\\Prisma\\Imagen.png"));
        assert!(state.mark_saved("inexistente", "otra.png".into()).is_err());
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn archivos_importados_de_carpetas_distintas_conservan_cada_origen() {
        let (state, path) = vault();
        state.add_with_location(Some("cache/a/Imagen.png".into()), None, false, Some("D:\\A\\Imagen.png".into())).unwrap();
        state.add_with_location(Some("cache/b/Imagen.png".into()), None, false, Some("D:\\B\\Imagen.png".into())).unwrap();
        let restored = VaultState::new(path.clone()).list();
        assert_eq!(restored.len(), 2);
        assert_eq!(restored[0].location_path.as_deref(), Some("D:\\A\\Imagen.png"));
        assert_eq!(restored[1].location_path.as_deref(), Some("D:\\B\\Imagen.png"));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn estado_antiguo_no_presenta_la_cache_como_carpeta_del_usuario() {
        let (state, path) = vault();
        let cache = path.parent().unwrap().join("vault-items").join("cache.png");
        state.add(Some(cache.to_string_lossy().into()), None);
        state.add(Some("D:\\Origen\\foto.png".into()), None);
        let mut json: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        for item in json["items"].as_array_mut().unwrap() { item.as_object_mut().unwrap().remove("locationPath"); }
        std::fs::write(&path, serde_json::to_vec(&json).unwrap()).unwrap();
        let restored = VaultState::new(path.clone()).list();
        assert!(restored[0].location_path.is_none());
        assert_eq!(restored[1].location_path.as_deref(), Some("D:\\Origen\\foto.png"));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn la_boveda_conserva_los_cinco_mas_recientes() {
        let (state, path) = vault();
        for index in 0..9 {
            state.add(Some(format!("C:\\tmp\\archivo{index}.png")), None);
        }
        let items = state.list();
        assert_eq!(items.len(), MAX_ITEMS);
        assert_eq!(items.iter().map(|item| item.name.as_str()).collect::<Vec<_>>(),
            ["archivo4.png", "archivo5.png", "archivo6.png", "archivo7.png", "archivo8.png"]);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn cinco_capturas_llenan_de_izquierda_a_derecha_y_la_sexta_reemplaza_la_primera() {
        let (state, path) = vault();
        for index in 1..=5 {
            let items = state.add(Some(format!("captura{index}.png")), None);
            assert_eq!(items.len(), index);
            assert_eq!(items.last().unwrap().name, format!("captura{index}.png"));
            assert_eq!(items.first().unwrap().name, "captura1.png");
        }
        let items = state.add(Some("captura6.png".into()), None);
        assert_eq!(items.iter().map(|item| item.name.as_str()).collect::<Vec<_>>(),
            ["captura2.png", "captura3.png", "captura4.png", "captura5.png", "captura6.png"]);
        let reloaded = VaultState::new(path.clone());
        assert_eq!(reloaded.list().iter().map(|item| item.name.clone()).collect::<Vec<_>>(),
            items.iter().map(|item| item.name.clone()).collect::<Vec<_>>());
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn archivos_y_capturas_comparten_la_misma_rotacion() {
        let (state, path) = vault();
        for name in ["documento.pdf", "captura1.png", "texto.txt", "captura2.png", "video.mp4"] {
            state.add(Some(name.into()), None);
        }
        let items = state.add(Some("captura3.png".into()), None);
        assert_eq!(items.iter().map(|item| item.name.as_str()).collect::<Vec<_>>(),
            ["captura1.png", "texto.txt", "captura2.png", "video.mp4", "captura3.png"]);
        // Volver a añadir un archivo existente lo actualiza sin expulsar otro.
        let items = state.add(Some("texto.txt".into()), None);
        assert_eq!(items.len(), MAX_ITEMS);
        assert_eq!(items.last().unwrap().name, "texto.txt");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn el_elemento_fijado_no_se_expulsa_y_queda_primero() {
        let (state, path) = vault();
        state.add(Some("C:\\tmp\\uno.png".to_string()), None);
        state.add(Some("C:\\tmp\\dos.png".to_string()), None);
        let pinned = state.list()[0].id.clone();
        state.toggle_pin(&pinned).unwrap();

        state.add(Some("C:\\tmp\\tres.png".to_string()), None);
        state.add(Some("C:\\tmp\\cuatro.png".to_string()), None);
        for index in 0..8 { state.add(Some(format!("C:\\tmp\\nuevo{index}.png")), None); }

        let items = state.list();
        assert_eq!(items.len(), MAX_ITEMS);
        assert_eq!(items[0].id, pinned, "el fijado va siempre primero");
        assert!(items[0].pinned);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn se_pueden_fijar_varios_sin_desfijar_el_anterior() {
        let (state, path) = vault();
        state.add(Some("C:\\tmp\\uno.png".to_string()), None);
        state.add(Some("C:\\tmp\\dos.png".to_string()), None);
        let first = state.list()[0].id.clone();
        let second = state.list()[1].id.clone();

        state.toggle_pin(&first).unwrap();
        state.toggle_pin(&second).unwrap();

        let pinned = state.list().iter().filter(|item| item.pinned).count();
        assert_eq!(pinned, 2);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn dos_fijados_sobreviven_y_el_temporal_mas_antiguo_se_reemplaza() {
        let (state, path) = vault();
        for index in 0..2 {
            state.add_with_pin(Some(format!("fijo{index}.pdf")), None, true).unwrap();
        }
        assert!(state.add_with_pin(Some("tercero.pdf".into()), None, true).is_err());
        state.add(Some("viejo.txt".into()), None);
        let old_id = state.list().iter().find(|item| item.name == "viejo.txt").unwrap().id.clone();
        assert!(state.toggle_pin(&old_id).is_err());
        state.add(Some("intermedio.txt".into()), None);
        state.add(Some("anterior.png".into()), None);
        state.add(Some("nuevo.txt".into()), None);
        assert_eq!(state.list().len(), 5);
        assert_eq!(state.list().iter().filter(|item| item.pinned).count(), 2);
        assert!(state.list().iter().any(|item| item.name == "nuevo.txt"));
        assert!(!state.list().iter().any(|item| item.name == "viejo.txt"));
        assert_eq!(state.list().iter().map(|item| item.name.clone()).collect::<Vec<_>>(),
            ["fijo0.pdf", "fijo1.pdf", "intermedio.txt", "anterior.png", "nuevo.txt"]);
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
