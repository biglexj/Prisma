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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub group_id: String,
    pub match_type: String, // "exact" | "perceptual"
    pub original: DuplicateCandidate,
    pub duplicates: Vec<DuplicateCandidate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateScanOptions {
    pub paths: Vec<String>,
    pub min_similarity_pct: f64, // e.g. 85.0 to 100.0
    pub check_visual_similarity: bool,
    pub min_size_bytes: Option<u64>,
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
                let original_item = exact_matches[0];
                grouped_paths.insert(original_item.path.clone());

                let mut dups = Vec::new();
                for &dup_item in &exact_matches[1..] {
                    grouped_paths.insert(dup_item.path.clone());
                    dups.push(DuplicateCandidate {
                        path: dup_item.path.clone(),
                        title: dup_item.title.clone(),
                        relative_folder: dup_item.relative_folder.clone(),
                        size_bytes: dup_item.size_bytes,
                        width: None,
                        height: None,
                        modified_at_millis: dup_item.modified_at_millis,
                        similarity_pct: 100.0,
                        is_exact_match: true,
                    });
                }

                groups.push(DuplicateGroup {
                    group_id: format!("exact-{}", exact_counter),
                    match_type: "exact".into(),
                    original: DuplicateCandidate {
                        path: original_item.path.clone(),
                        title: original_item.title.clone(),
                        relative_folder: original_item.relative_folder.clone(),
                        size_bytes: original_item.size_bytes,
                        width: None,
                        height: None,
                        modified_at_millis: original_item.modified_at_millis,
                        similarity_pct: 100.0,
                        is_exact_match: true,
                    },
                    duplicates: dups,
                });
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
                    });
                }
            }

            if !matching_dups.is_empty() {
                visited_indices.insert(i);
                perceptual_counter += 1;

                groups.push(DuplicateGroup {
                    group_id: format!("perceptual-{}", perceptual_counter),
                    match_type: "perceptual".into(),
                    original: DuplicateCandidate {
                        path: item_a.path.clone(),
                        title: item_a.title.clone(),
                        relative_folder: item_a.relative_folder.clone(),
                        size_bytes: item_a.size_bytes,
                        width: Some(w_a),
                        height: Some(h_a),
                        modified_at_millis: item_a.modified_at_millis,
                        similarity_pct: 100.0,
                        is_exact_match: false,
                    },
                    duplicates: matching_dups,
                });
            }
        }
    }

    groups
}
