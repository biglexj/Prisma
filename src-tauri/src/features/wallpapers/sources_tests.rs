// Pruebas de regresión del gestor de fuentes de Fondos Vivos.
#![cfg(test)]

use super::sources::{MediaKind, MediaKindMode, SourceManager, WallpaperSettings};
use std::fs;
use std::path::PathBuf;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("prisma-wallpapers-test-{name}"));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("crear carpeta de pruebas");
    dir
}

fn touch(dir: &PathBuf, name: &str) {
    fs::write(dir.join(name), b"x").expect("crear archivo de medio");
}

#[test]
fn ocultar_carpeta_excluye_sus_videos_de_la_cola() {
    let root = temp_dir("carpeta");
    let folder_a = root.join("A");
    let folder_b = root.join("B");
    fs::create_dir_all(&folder_a).unwrap();
    fs::create_dir_all(&folder_b).unwrap();
    touch(&folder_a, "a1.mp4");
    touch(&folder_a, "a2.mp4");
    touch(&folder_b, "b1.mp4");

    let mut manager = SourceManager::new(root.join("config"));
    let source = manager
        .add_folder(folder_a.to_str().unwrap())
        .expect("añadir carpeta A");
    manager.add_folder(folder_b.to_str().unwrap()).unwrap();

    assert_eq!(manager.total_media(), 3);

    assert!(manager.set_folder_hidden(&source.id, true));
    assert_eq!(manager.total_media(), 1, "la carpeta oculta no debe aportar medios");

    let listed = manager.get_all_media();
    assert_eq!(listed.len(), 1);
    assert!(listed[0].name.starts_with('b'));

    assert!(manager.set_folder_hidden(&source.id, false));
    assert_eq!(manager.total_media(), 3, "al mostrar la carpeta vuelven sus medios");
}

#[test]
fn ocultar_video_lo_saca_de_la_cola_pero_lo_conserva_en_el_listado() {
    let root = temp_dir("video");
    let folder = root.join("videos");
    fs::create_dir_all(&folder).unwrap();
    touch(&folder, "uno.mp4");
    touch(&folder, "dos.mp4");

    let mut manager = SourceManager::new(root.join("config"));
    manager.add_folder(folder.to_str().unwrap()).unwrap();
    assert_eq!(manager.total_media(), 2);

    let target = folder.join("uno.mp4").to_string_lossy().to_string();
    assert!(manager.set_media_hidden(&target, true));
    assert_eq!(manager.total_media(), 1);

    let listed = manager.get_all_media();
    assert_eq!(listed.len(), 2, "el vídeo oculto se sigue listando, marcado como oculto");
    let hidden_flag = listed
        .iter()
        .find(|item| item.name == "uno.mp4")
        .map(|item| item.hidden)
        .expect("vídeo presente en el listado");
    assert!(hidden_flag, "el vídeo oculto debe venir marcado");

    assert!(manager.set_media_hidden(&target, false));
    assert_eq!(manager.total_media(), 2);
    let listed = manager.get_all_media();
    assert!(listed
        .iter()
        .all(|item| !item.hidden), "al mostrar el vídeo se limpia la marca");
}

#[test]
fn la_configuracion_oculta_sobrevive_a_reiniciar() {
    let root = temp_dir("persistencia");
    let folder = root.join("videos");
    fs::create_dir_all(&folder).unwrap();
    touch(&folder, "uno.mp4");

    let config_dir = root.join("config");
    let source_id = {
        let mut manager = SourceManager::new(config_dir.clone());
        let source = manager
            .add_folder(folder.to_str().unwrap())
            .expect("añadir carpeta");
        manager.set_folder_hidden(&source.id, true);
        source.id
    };

    let reloaded = SourceManager::new(config_dir);
    let restored = reloaded
        .settings()
        .sources
        .iter()
        .find(|s| s.id == source_id)
        .expect("carpeta persistida");
    assert!(restored.hidden, "el estado oculto debe persistir en disco");
    assert_eq!(reloaded.total_media(), 0);
}

/// El modo de medio decide qué entra en la cola y en la cuadrícula.
/// Por defecto solo hay vídeos: una instalación que solo tenga vídeos no
/// nota ningún cambio.
#[test]
fn el_modo_de_medio_filtra_la_cola_y_conserva_el_medio_en_pantalla() {
    let root = temp_dir("modo");
    let folder = root.join("mixtos");
    fs::create_dir_all(&folder).unwrap();
    touch(&folder, "video.mp4");
    touch(&folder, "imagen.png");

    let mut manager = SourceManager::new(root.join("config"));
    let source = manager
        .add_folder(folder.to_str().unwrap())
        .expect("añadir carpeta");
    assert_eq!(
        source.media_count, 2,
        "la cuenta de la carpeta incluye vídeos e imágenes, sin filtrar"
    );

    // Por defecto: solo vídeos.
    assert_eq!(manager.settings().media_kind_mode, MediaKindMode::Video);
    assert_eq!(manager.total_media(), 1, "en modo vídeo la cola tiene un elemento");
    assert_eq!(manager.get_all_media().len(), 1, "la cuadrícula también se filtra");

    // Modo imagen: solo la imagen.
    manager.set_media_kind_mode(MediaKindMode::Image);
    assert_eq!(manager.total_media(), 1);
    assert!(
        manager.current_media().unwrap().ends_with("imagen.png"),
        "en modo imagen la cola contiene la imagen"
    );

    // Modo mixto: los dos, con el orden natural por nombre.
    manager.set_media_kind_mode(MediaKindMode::Mixed);
    assert_eq!(manager.total_media(), 2, "en modo mixto entran vídeos e imágenes");
    let listed = manager.get_all_media();
    assert_eq!(listed.len(), 2);
    assert_eq!(listed[0].kind, MediaKind::Image);
    assert_eq!(listed[1].kind, MediaKind::Video);

    // Si el medio en pantalla sigue siendo elegible, se conserva.
    let imagen = folder.join("imagen.png").to_string_lossy().to_string();
    manager.set_current_media(&imagen);
    manager.set_media_kind_mode(MediaKindMode::Image);
    assert_eq!(
        manager.current_media().as_deref(),
        Some(imagen.as_str()),
        "el medio en pantalla se conserva cuando sigue siendo elegible"
    );

    // Si deja de ser elegible, la cola arranca por el primero del modo nuevo.
    manager.set_media_kind_mode(MediaKindMode::Video);
    assert!(
        manager.current_media().unwrap().ends_with("video.mp4"),
        "al dejar de ser elegible se arranca por el primer medio del modo"
    );
}

/// El tipo de cada medio se decide por su extensión.
#[test]
fn el_tipo_de_medio_se_decide_por_la_extension() {
    assert_eq!(MediaKind::from_path("casa.mp4"), MediaKind::Video);
    assert_eq!(MediaKind::from_path("casa.MKV"), MediaKind::Video);
    assert_eq!(MediaKind::from_path("casa.png"), MediaKind::Image);
    assert_eq!(MediaKind::from_path("casa.JPG"), MediaKind::Image);
    assert_eq!(MediaKind::from_path("casa.webp"), MediaKind::Image);
    assert_eq!(MediaKind::from_path("casa.avif"), MediaKind::Image);
    assert_eq!(MediaKind::from_path("casa"), MediaKind::Video);
}

/// Las imágenes también se pueden ocultar: el botón de ojo no distingue
/// entre vídeo e imagen.
#[test]
fn ocultar_una_imagen_la_saca_de_la_cola() {
    let root = temp_dir("imagen-oculta");
    let folder = root.join("mixtos");
    fs::create_dir_all(&folder).unwrap();
    touch(&folder, "video.mp4");
    touch(&folder, "imagen.png");

    let mut manager = SourceManager::new(root.join("config"));
    manager.add_folder(folder.to_str().unwrap()).unwrap();
    manager.set_media_kind_mode(MediaKindMode::Mixed);
    assert_eq!(manager.total_media(), 2);

    let imagen = folder.join("imagen.png").to_string_lossy().to_string();
    assert!(manager.set_media_hidden(&imagen, true));
    assert_eq!(manager.total_media(), 1, "la imagen oculta sale de la cola");
    assert!(manager.is_media_hidden(&imagen));

    // El oculto se persiste en "hiddenMedia" y sobrevive a reiniciar.
    let reloaded = SourceManager::new(root.join("config"));
    assert!(
        reloaded.is_media_hidden(&imagen),
        "la imagen oculta debe persistir en disco"
    );
}

/// El contrato con la interfaz: los nombres antiguos se leen, los nuevos se
/// escriben. Un "live_wallpapers.json" viejo sigue funcionando.
#[test]
fn la_configuracion_antigua_se_lee_con_los_nombres_nuevos() {
    let root = temp_dir("config-antigua");
    let folder = root.join("videos");
    fs::create_dir_all(&folder).unwrap();
    touch(&folder, "uno.mp4");
    touch(&folder, "dos.png");

    let legacy = serde_json::json!({
        "version": 1,
        "sources": [{
            "id": "src_legacy",
            "path": folder.to_string_lossy(),
            "name": "videos",
            "enabled": true,
            "videoCount": 2,
            "available": true
        }],
        "mode": "sequential",
        "fit": "cover",
        "autoStart": false,
        "isActive": false,
        "hiddenVideos": [folder.join("uno.mp4").to_string_lossy()]
    });

    let parsed: WallpaperSettings =
        serde_json::from_str(&legacy.to_string()).expect("la configuración antigua debe leerse");
    assert_eq!(
        parsed.sources[0].media_count, 2,
        "'videoCount' es alias de 'mediaCount'"
    );
    assert_eq!(
        parsed.hidden_media.len(),
        1,
        "'hiddenVideos' es alias de 'hiddenMedia'"
    );
    assert_eq!(
        parsed.media_kind_mode,
        MediaKindMode::Video,
        "sin 'mediaKindMode' el modo por defecto es vídeo"
    );
    assert_eq!(
        parsed.image_duration_sec, 20,
        "sin 'imageDurationSec' la duración por defecto es 20 segundos"
    );

    // Y al guardar se escriben los nombres nuevos.
    let json = serde_json::to_value(&parsed).expect("serializar configuración");
    assert_eq!(json["sources"][0]["mediaCount"], 2);
    assert!(json.get("hiddenMedia").is_some());
    assert_eq!(json["imageDurationSec"], 20);
    assert_eq!(json["mediaKindMode"], "video");
}

/// La duración de las imágenes se guarda y se recupera del disco.
#[test]
fn la_duracion_de_las_imagenes_se_persiste() {
    let root = temp_dir("duracion");
    let folder = root.join("imagenes");
    fs::create_dir_all(&folder).unwrap();
    touch(&folder, "una.png");

    let config_dir = root.join("config");
    {
        let mut manager = SourceManager::new(config_dir.clone());
        manager.add_folder(folder.to_str().unwrap()).unwrap();
        manager.set_image_duration(45);
        assert_eq!(manager.settings().image_duration_sec, 45);
    }

    let reloaded = SourceManager::new(config_dir);
    assert_eq!(reloaded.settings().image_duration_sec, 45);
}
