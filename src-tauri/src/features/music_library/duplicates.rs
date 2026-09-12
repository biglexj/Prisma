use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::Accessor;

use crate::features::music_library::MusicLibraryItem;
use crate::features::visual_library::{DuplicateCandidate, DuplicateGroup, DuplicateScanOptions};

/// Estructura de audio enriquecida con metadatos leídos por Lofty
#[derive(Debug, Clone)]
struct AudioMetadata {
    path: String,
    title: String,
    artist: String,
    duration_secs: f64,
    bitrate_kbps: u32,
    is_lossless: bool,
    size_bytes: u64,
    modified_at_millis: u128,
}

impl AudioMetadata {
    /// Puntuación de calidad de audio (Lossless > High Bitrate > Low Bitrate)
    fn quality_score(&self) -> u64 {
        let base_score = if self.is_lossless {
            1_000_000
        } else {
            0
        };
        base_score + (self.bitrate_kbps as u64) * 1000 + (self.size_bytes / 1024)
    }
}

/// Extrae metadatos acústicos y de tags usando Lofty
fn extract_audio_info(path: &Path, fallback_title: &str, size_bytes: u64, modified_at_millis: u128) -> AudioMetadata {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    let is_lossless = matches!(ext.as_str(), "flac" | "wav" | "alac" | "aiff");

    let probe = Probe::open(path).and_then(|p| p.read()).ok();

    let (mut title, artist, duration_secs, bitrate_kbps) = if let Some(tagged) = probe {
        let props = tagged.properties();
        let dur = props.duration().as_secs_f64();
        let bitrate = props.audio_bitrate().unwrap_or(0);

        let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
        let (t, a) = if let Some(tag_ref) = tag {
            (
                tag_ref.title().map(|s| s.to_string()),
                tag_ref.artist().map(|s| s.to_string()),
            )
        } else {
            (None, None)
        };

        (
            t.unwrap_or_else(|| fallback_title.to_string()),
            a.unwrap_or_default(),
            dur,
            bitrate,
        )
    } else {
        (fallback_title.to_string(), String::new(), 0.0, 0)
    };

    if title.trim().is_empty() {
        title = fallback_title.to_string();
    }

    AudioMetadata {
        path: path.to_string_lossy().to_string(),
        title,
        artist,
        duration_secs,
        bitrate_kbps,
        is_lossless,
        size_bytes,
        modified_at_millis,
    }
}

/// Normaliza títulos eliminando sufijos comerciales y puntuación
fn normalize_audio_title(raw: &str) -> String {
    let mut s = raw.to_lowercase();

    // Eliminar track number inicial (ej. "01 - ", "01. ", "1. ")
    if let Some(pos) = s.find(|c: char| !c.is_numeric() && c != '.' && c != '-' && c != ' ') {
        if pos < 6 && pos > 0 {
            s = s[pos..].to_string();
        }
    }

    // Limpiar coletillas comunes
    let noise = [
        "(official audio)", "[official audio]", "(official video)", "[official video]",
        "(audio)", "[audio]", "(lyrics)", "[lyrics]", "(lyric video)", "[lyric video]",
        "(remastered)", "[remastered]", "(remaster)", "[remaster]", "(2024 remaster)",
        "(hq)", "[hq]", "(hd)", "[hd]", "(320kbps)", "[320kbps]", "(high quality)",
        "(live)", "[live]", "(bonus track)", "[bonus track]",
    ];

    for n in noise {
        s = s.replace(n, " ");
    }

    // Eliminar "feat. ..." o "ft. ..."
    if let Some(idx) = s.find("feat.") {
        s = s[..idx].to_string();
    } else if let Some(idx) = s.find("ft.") {
        s = s[..idx].to_string();
    }

    // Conservar solo alfanuméricos
    s.chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ')
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Calcula la similitud de Jaro-Winkler simplificada entre dos cadenas
fn string_similarity(s1: &str, s2: &str) -> f64 {
    if s1 == s2 {
        return 100.0;
    }
    if s1.is_empty() || s2.is_empty() {
        return 0.0;
    }

    let s1_chars: Vec<char> = s1.chars().collect();
    let s2_chars: Vec<char> = s2.chars().collect();

    // Coincidencia de prefijo y contención mutua
    if s1.contains(s2) || s2.contains(s1) {
        let min_len = s1_chars.len().min(s2_chars.len()) as f64;
        let max_len = s1_chars.len().max(s2_chars.len()) as f64;
        return (min_len / max_len) * 100.0;
    }

    // Levenshtein simplificado
    let len1 = s1_chars.len();
    let len2 = s2_chars.len();
    let mut matrix = vec![vec![0usize; len2 + 1]; len1 + 1];

    for i in 0..=len1 {
        matrix[i][0] = i;
    }
    for j in 0..=len2 {
        matrix[0][j] = j;
    }

    for i in 1..=len1 {
        for j in 1..=len2 {
            let cost = if s1_chars[i - 1] == s2_chars[j - 1] { 0 } else { 1 };
            matrix[i][j] = (matrix[i - 1][j] + 1)
                .min(matrix[i][j - 1] + 1)
                .min(matrix[i - 1][j - 1] + cost);
        }
    }

    let dist = matrix[len1][len2] as f64;
    let max_len = len1.max(len2) as f64;
    ((1.0 - (dist / max_len)) * 100.0).max(0.0)
}

/// Calcula un hash rápido preliminar (primeros 16 KB + tamaño)
fn quick_file_hash(path: &Path) -> Option<u64> {
    let mut file = File::open(path).ok()?;
    let meta = file.metadata().ok()?;
    let len = meta.len();

    let mut buf = [0u8; 16384];
    let n = file.read(&mut buf).ok()?;

    let mut h: u64 = 0xcbf29ce484222325;
    h ^= len;
    h = h.wrapping_mul(0x100000001b3);
    for b in &buf[..n] {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    Some(h)
}

/// Calcula el hash completo del archivo si los 16 KB coinciden
fn full_file_hash(path: &Path) -> Option<u64> {
    let mut file = File::open(path).ok()?;
    let mut buf = [0u8; 65536];
    let mut h: u64 = 0xcbf29ce484222325;

    while let Ok(n) = file.read(&mut buf) {
        if n == 0 {
            break;
        }
        for b in &buf[..n] {
            h ^= *b as u64;
            h = h.wrapping_mul(0x100000001b3);
        }
    }
    Some(h)
}

fn assemble_music_duplicate_group(
    group_id: String,
    match_type: String,
    mut candidates: Vec<DuplicateCandidate>,
    metadata_map: &HashMap<String, AudioMetadata>,
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

    // Ordenar candidatos para elegir la referencia (original):
    // 1. Si hay base_folder, elementos de base_folder tienen prioridad de conservación.
    // 2. Si se prefiere calidad de audio (Hi-Res), mayor quality_score gana.
    // 3. Desempate por fecha de modificación más antigua.
    candidates.sort_by(|a, b| {
        if base_folder.is_some() {
            match (b.is_from_base_folder, a.is_from_base_folder) {
                (true, false) => return std::cmp::Ordering::Greater,
                (false, true) => return std::cmp::Ordering::Less,
                _ => {}
            }
        }

        if prefer_higher_resolution {
            let score_a = metadata_map.get(&a.path).map(|m| m.quality_score()).unwrap_or(0);
            let score_b = metadata_map.get(&b.path).map(|m| m.quality_score()).unwrap_or(0);
            if score_a != score_b {
                return score_b.cmp(&score_a);
            }
        }

        a.modified_at_millis.cmp(&b.modified_at_millis)
    });

    let original = candidates.remove(0);
    let orig_score = metadata_map.get(&original.path).map(|m| m.quality_score()).unwrap_or(0);

    let mut has_resolution_upgrade = false;
    for dup in &mut candidates {
        let dup_score = metadata_map.get(&dup.path).map(|m| m.quality_score()).unwrap_or(0);
        if prefer_higher_resolution && dup_score > orig_score {
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

pub fn scan_music_duplicates(
    items: Vec<MusicLibraryItem>,
    options: DuplicateScanOptions,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Vec<DuplicateGroup> {
    let min_size = options.min_size_bytes.unwrap_or(0);
    let valid_items: Vec<_> = items
        .into_iter()
        .filter(|it| it.size_bytes >= min_size && Path::new(&it.path).is_file())
        .collect();

    let mut groups: Vec<DuplicateGroup> = Vec::new();
    let mut grouped_paths: HashSet<String> = HashSet::new();
    let mut metadata_map: HashMap<String, AudioMetadata> = HashMap::new();

    // ── Nivel 1: Detección Exacta (Hash Binario) ──
    let mut by_size: HashMap<u64, Vec<&MusicLibraryItem>> = HashMap::new();
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

        let mut by_quick: HashMap<u64, Vec<&MusicLibraryItem>> = HashMap::new();
        for it in same_size_items {
            if let Some(h) = quick_file_hash(Path::new(&it.path)) {
                by_quick.entry(h).or_default().push(it);
            }
        }

        for (_, same_quick) in by_quick {
            if same_quick.len() < 2 {
                continue;
            }

            let mut by_full: HashMap<u64, Vec<&MusicLibraryItem>> = HashMap::new();
            for it in same_quick {
                if let Some(h) = full_file_hash(Path::new(&it.path)) {
                    by_full.entry(h).or_default().push(it);
                }
            }

            for (_, exact_items) in by_full {
                if exact_items.len() >= 2 {
                    exact_counter += 1;
                    let mut cluster: Vec<DuplicateCandidate> = Vec::new();

                    for it in exact_items {
                        grouped_paths.insert(it.path.clone());
                        let meta = extract_audio_info(
                            Path::new(&it.path),
                            &it.title,
                            it.size_bytes,
                            it.modified_at_millis,
                        );
                        metadata_map.insert(it.path.clone(), meta);

                        let rel_folder = Path::new(&it.path)
                            .parent()
                            .and_then(|p| p.file_name())
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_default();

                        cluster.push(DuplicateCandidate {
                            path: it.path.clone(),
                            title: it.title.clone(),
                            relative_folder: rel_folder,
                            size_bytes: it.size_bytes,
                            width: None,
                            height: None,
                            modified_at_millis: it.modified_at_millis,
                            similarity_pct: 100.0,
                            is_exact_match: true,
                            is_from_base_folder: false,
                            has_higher_resolution: false,
                        });
                    }

                    let grp = assemble_music_duplicate_group(
                        format!("E{exact_counter}"),
                        "exact".to_string(),
                        cluster,
                        &metadata_map,
                        &options.base_folder,
                        options.prefer_higher_resolution,
                    );

                    if options.base_folder.is_some() && options.target_folder.is_some() && grp.duplicates.is_empty() {
                        continue;
                    }
                    groups.push(grp);
                }
            }
        }
    }

    // ── Nivel 2: Detección por Metadatos Normalizados & Duración ──
    if options.check_visual_similarity {
        let remaining_items: Vec<_> = valid_items
            .into_iter()
            .filter(|it| !grouped_paths.contains(&it.path))
            .collect();

        // Extraer metadatos de audio para todos los restantes
        let mut audio_list: Vec<AudioMetadata> = Vec::new();
        for it in remaining_items {
            if let Some(flag) = &cancel_flag {
                if flag.load(Ordering::SeqCst) {
                    return groups;
                }
            }

            let meta = extract_audio_info(
                Path::new(&it.path),
                &it.title,
                it.size_bytes,
                it.modified_at_millis,
            );
            metadata_map.insert(it.path.clone(), meta.clone());
            audio_list.push(meta);
        }

        let mut sim_counter = 0;
        let mut sim_grouped: HashSet<String> = HashSet::new();

        for i in 0..audio_list.len() {
            let a = &audio_list[i];
            if sim_grouped.contains(&a.path) {
                continue;
            }

            let norm_title_a = normalize_audio_title(&a.title);
            let mut matching_dups: Vec<DuplicateCandidate> = Vec::new();

            for j in (i + 1)..audio_list.len() {
                let b = &audio_list[j];
                if sim_grouped.contains(&b.path) {
                    continue;
                }

                // 1. Margen de tolerancia de duración temporal (|durA - durB| <= 3.5 segundos)
                if a.duration_secs > 0.0 && b.duration_secs > 0.0 {
                    if (a.duration_secs - b.duration_secs).abs() > 3.5 {
                        continue;
                    }
                }

                // 2. Similitud de título y artista normalizados
                let norm_title_b = normalize_audio_title(&b.title);
                let mut sim = string_similarity(&norm_title_a, &norm_title_b);
                if !a.artist.is_empty() && !b.artist.is_empty() {
                    let artist_sim = string_similarity(&a.artist.to_lowercase(), &b.artist.to_lowercase());
                    sim = (sim * 0.7) + (artist_sim * 0.3);
                }

                if sim >= options.min_similarity_pct {
                    sim_grouped.insert(b.path.clone());

                    let rel_folder = Path::new(&b.path)
                        .parent()
                        .and_then(|p| p.file_name())
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();

                    matching_dups.push(DuplicateCandidate {
                        path: b.path.clone(),
                        title: b.title.clone(),
                        relative_folder: rel_folder,
                        size_bytes: b.size_bytes,
                        width: None,
                        height: None,
                        modified_at_millis: b.modified_at_millis,
                        similarity_pct: (sim * 10.0).round() / 10.0,
                        is_exact_match: false,
                        is_from_base_folder: false,
                        has_higher_resolution: false,
                    });
                }
            }

            if !matching_dups.is_empty() {
                sim_grouped.insert(a.path.clone());
                sim_counter += 1;

                let rel_folder = Path::new(&a.path)
                    .parent()
                    .and_then(|p| p.file_name())
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();

                let mut cluster = vec![DuplicateCandidate {
                    path: a.path.clone(),
                    title: a.title.clone(),
                    relative_folder: rel_folder,
                    size_bytes: a.size_bytes,
                    width: None,
                    height: None,
                    modified_at_millis: a.modified_at_millis,
                    similarity_pct: 100.0,
                    is_exact_match: false,
                    is_from_base_folder: false,
                    has_higher_resolution: false,
                }];
                cluster.extend(matching_dups);

                let grp = assemble_music_duplicate_group(
                    format!("M{sim_counter}"),
                    "perceptual".to_string(),
                    cluster,
                    &metadata_map,
                    &options.base_folder,
                    options.prefer_higher_resolution,
                );

                if options.base_folder.is_some() && options.target_folder.is_some() && grp.duplicates.is_empty() {
                    continue;
                }
                groups.push(grp);
            }
        }
    }

    groups
}
