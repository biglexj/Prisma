use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateCandidate {
    pub path: String,
    pub title: String,
    pub relative_folder: String,
    pub size_bytes: u64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub modified_at_millis: u128,
    pub similarity_pct: f64,
    pub is_exact_match: bool,
    #[serde(default)]
    pub is_from_base_folder: bool,
    #[serde(default)]
    pub has_higher_resolution: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub group_id: String,
    pub match_type: String, // "exact" | "perceptual"
    pub original: DuplicateCandidate,
    pub duplicates: Vec<DuplicateCandidate>,
    #[serde(default)]
    pub has_resolution_upgrade: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateScanOptions {
    pub paths: Vec<String>,
    pub min_similarity_pct: f64, // e.g. 85.0 to 100.0
    pub check_visual_similarity: bool,
    pub min_size_bytes: Option<u64>,
    #[serde(default)]
    pub base_folder: Option<String>,
    #[serde(default)]
    pub target_folder: Option<String>,
    #[serde(default)]
    pub prefer_higher_resolution: bool,
}

/// Obtiene rápidamente dimensiones de imagen sin decodificar el raster completo
fn get_image_dims(path: &Path) -> (Option<u32>, Option<u32>) {
    match image::image_dimensions(path) {
        Ok((w, h)) => (Some(w), Some(h)),
        Err(_) => (None, None),
    }
}

/// Computa un hash de 64 bits usando dHash (Difference Hash) en escala de grises.
/// Divide la imagen en una cuadrícula de 9x8 píxeles y evalúa la gradiente horizontal.
fn compute_dhash(path: &Path) -> Option<(u64, u32, u32)> {
    let img = image::open(path).ok()?;
    let (orig_w, orig_h) = (img.width(), img.height());

    // Redimensionar exactamente a 9x8 para 64 comparaciones de gradiente
    let small = img.resize_exact(9, 8, image::imageops::FilterType::Nearest);
    let gray = small.to_luma8();

    let mut hash: u64 = 0;
    for y in 0..8 {
        for x in 0..8 {
            let left = gray.get_pixel(x, y)[0];
            let right = gray.get_pixel(x + 1, y)[0];
            if right > left {
                hash |= 1 << (y * 8 + x);
            }
        }
    }

    Some((hash, orig_w, orig_h))
}

/// Calcula un hash rápido preliminar (primeros 16 KB + tamaño)
fn quick_file_hash(path: &Path) -> Option<u64> {
    let mut file = File::open(path).ok()?;
    let meta = file.metadata().ok()?;
    let len = meta.len();

    let mut buf = [0u8; 16384];
    let read_bytes = file.read(&mut buf).unwrap_or(0);

    use std::collections::hash_map::DefaultHasher;
    use std::hash::Hasher;

    let mut hasher = DefaultHasher::new();
    hasher.write_u64(len);
    hasher.write(&buf[..read_bytes]);
    Some(hasher.finish())
}

/// Calcula un hash completo para archivos con coincidencia previa
fn full_file_hash(path: &Path) -> Option<u64> {
    let mut file = File::open(path).ok()?;
    let mut buf = [0u8; 32768];

    use std::collections::hash_map::DefaultHasher;
    use std::hash::Hasher;

    let mut hasher = DefaultHasher::new();
    loop {
        let read = file.read(&mut buf).unwrap_or(0);
        if read == 0 {
            break;
        }
        hasher.write(&buf[..read]);
    }
    Some(hasher.finish())
}

fn assemble_duplicate_group(
    group_id: String,
    match_type: String,
    mut candidates: Vec<DuplicateCandidate>,
    base_folder: &Option<String>,
    prefer_higher_resolution: bool,
) -> DuplicateGroup {
    if let Some(base) = base_folder {
        let norm_base = base.replace('\\', "/").to_lowercase().trim_end_matches('/').to_string();
        for c in &mut candidates {
            let norm_path = c.path.replace('\\', "/").to_lowercase();
            c.is_from_base_folder = norm_path.starts_with(&norm_base);
        }
    }

    // Ordenar para elegir la referencia (original a conservar):
    // 1. Si hay base_folder, los elementos de base_folder tienen prioridad de conservación.
    // 2. Desempate: fecha de modificación más antigua.
    candidates.sort_by(|a, b| {
        if base_folder.is_some() {
            match (b.is_from_base_folder, a.is_from_base_folder) {
                (true, false) => return std::cmp::Ordering::Greater,
                (false, true) => return std::cmp::Ordering::Less,
                _ => {}
            }
        }
        a.modified_at_millis.cmp(&b.modified_at_millis)
    });

    let original = candidates.remove(0);
    let orig_pixels = (original.width.unwrap_or(0) as u64) * (original.height.unwrap_or(0) as u64);

    let mut has_resolution_upgrade = false;
    for dup in &mut candidates {
        let dup_pixels = (dup.width.unwrap_or(0) as u64) * (dup.height.unwrap_or(0) as u64);
        // Si el duplicado tiene mayor resolución que el original de referencia
        if prefer_higher_resolution && dup_pixels > orig_pixels && dup_pixels > 0 {
            dup.has_higher_resolution = true;
            has_resolution_upgrade = true;
        }
    }

    DuplicateGroup {
        group_id,
        match_type,
        original,
        duplicates: candidates,
        has_resolution_upgrade,
    }
}

pub fn scan_duplicates(
    items: Vec<crate::features::visual_library::VisualLibraryItem>,
    options: DuplicateScanOptions,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Vec<DuplicateGroup> {
    let min_size = options.min_size_bytes.unwrap_or(0);
    let valid_items: Vec<_> = items
        .into_iter()
        .filter(|it| it.size_bytes >= min_size && Path::new(&it.path).is_file())
        .collect();

    let mut groups: Vec<DuplicateGroup> = Vec::new();
    let mut grouped_paths: std::collections::HashSet<String> = std::collections::HashSet::new();

    // ── Nivel 1: Detección Exacta (Tamaño idéntico + Hash) ──
    let mut by_size: HashMap<u64, Vec<&crate::features::visual_library::VisualLibraryItem>> = HashMap::new();
    for it in &valid_items {
        by_size.entry(it.size_bytes).or_default().push(it);
    }

    let mut exact_counter = 0;
    for (size, same_size_items) in by_size {
        if same_size_items.len() < 2 || size == 0 {
            continue;
        }

        if let Some(flag) = &cancel_flag {
            if flag.load(Ordering::SeqCst) {
                return groups;
            }
        }

        // Agrupar por quick hash primero
        let mut by_quick_hash: HashMap<u64, Vec<&crate::features::visual_library::VisualLibraryItem>> = HashMap::new();
        for it in same_size_items {
            let p = Path::new(&it.path);
            if let Some(qh) = quick_file_hash(p) {
                by_quick_hash.entry(qh).or_default().push(it);
            }
        }

        for (_, candidate_cluster) in by_quick_hash {
            if candidate_cluster.len() < 2 {
                continue;
            }

            // Confirmar con full hash
            let mut by_full_hash: HashMap<u64, Vec<&crate::features::visual_library::VisualLibraryItem>> = HashMap::new();
            for it in candidate_cluster {
                let p = Path::new(&it.path);
                if let Some(fh) = full_file_hash(p) {
                    by_full_hash.entry(fh).or_default().push(it);
                }
            }

            for (_, exact_matches) in by_full_hash {
                if exact_matches.len() < 2 {
                    continue;
                }

                exact_counter += 1;
                let mut cluster = Vec::new();
                for &it in &exact_matches {
                    grouped_paths.insert(it.path.clone());
                    let (w, h) = get_image_dims(Path::new(&it.path));
                    cluster.push(DuplicateCandidate {
                        path: it.path.clone(),
                        title: it.title.clone(),
                        relative_folder: it.relative_folder.clone(),
                        size_bytes: it.size_bytes,
                        width: w,
                        height: h,
                        modified_at_millis: it.modified_at_millis,
                        similarity_pct: 100.0,
                        is_exact_match: true,
                        is_from_base_folder: false,
                        has_higher_resolution: false,
                    });
                }

                let grp = assemble_duplicate_group(
                    format!("exact-{}", exact_counter),
                    "exact".into(),
                    cluster,
                    &options.base_folder,
                    options.prefer_higher_resolution,
                );

                // En modo cruzado (base vs depurar), descartar si no hay duplicados para depurar
                if options.base_folder.is_some() && grp.duplicates.is_empty() {
                    continue;
                }

                groups.push(grp);
            }
        }
    }

    // ── Nivel 2: Detección Perceptual Visual (dHash para imágenes restantes) ──
    if options.check_visual_similarity {
        let image_extensions = ["png", "jpg", "jpeg", "webp", "bmp", "avif"];
        let mut image_hashes: Vec<(u64, u32, u32, &crate::features::visual_library::VisualLibraryItem)> = Vec::new();

        for it in &valid_items {
            if grouped_paths.contains(&it.path) {
                continue;
            }

            if let Some(flag) = &cancel_flag {
                if flag.load(Ordering::SeqCst) {
                    return groups;
                }
            }

            let ext = Path::new(&it.path)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            if image_extensions.contains(&ext.as_str()) {
                if let Some((hash, w, h)) = compute_dhash(Path::new(&it.path)) {
                    image_hashes.push((hash, w, h, it));
                }
            }
        }

        let mut perceptual_counter = 0;
        let mut visited_indices = std::collections::HashSet::new();

        for i in 0..image_hashes.len() {
            if visited_indices.contains(&i) {
                continue;
            }

            if let Some(flag) = &cancel_flag {
                if flag.load(Ordering::SeqCst) {
                    return groups;
                }
            }

            let (hash_a, w_a, h_a, item_a) = image_hashes[i];
            let mut matching_dups = Vec::new();

            for j in (i + 1)..image_hashes.len() {
                if visited_indices.contains(&j) {
                    continue;
                }

                let (hash_b, w_b, h_b, item_b) = image_hashes[j];
                let diff_bits = (hash_a ^ hash_b).count_ones();
                let similarity_pct = ((64 - diff_bits) as f64 / 64.0) * 100.0;

                if similarity_pct >= options.min_similarity_pct {
                    visited_indices.insert(j);
                    matching_dups.push(DuplicateCandidate {
                        path: item_b.path.clone(),
                        title: item_b.title.clone(),
                        relative_folder: item_b.relative_folder.clone(),
                        size_bytes: item_b.size_bytes,
                        width: Some(w_b),
                        height: Some(h_b),
                        modified_at_millis: item_b.modified_at_millis,
                        similarity_pct,
                        is_exact_match: false,
                        is_from_base_folder: false,
                        has_higher_resolution: false,
                    });
                }
            }

            if !matching_dups.is_empty() {
                visited_indices.insert(i);
                perceptual_counter += 1;

                let mut cluster = Vec::new();
                cluster.push(DuplicateCandidate {
                    path: item_a.path.clone(),
                    title: item_a.title.clone(),
                    relative_folder: item_a.relative_folder.clone(),
                    size_bytes: item_a.size_bytes,
                    width: Some(w_a),
                    height: Some(h_a),
                    modified_at_millis: item_a.modified_at_millis,
                    similarity_pct: 100.0,
                    is_exact_match: false,
                    is_from_base_folder: false,
                    has_higher_resolution: false,
                });
                cluster.extend(matching_dups);

                let grp = assemble_duplicate_group(
                    format!("perceptual-{}", perceptual_counter),
                    "perceptual".into(),
                    cluster,
                    &options.base_folder,
                    options.prefer_higher_resolution,
                );

                if options.base_folder.is_some() && grp.duplicates.is_empty() {
                    continue;
                }

                groups.push(grp);
            }
        }
    }

    groups
}
