// Verificación temporal del flujo completo del controlador.
#![cfg(all(test, windows))]

use super::WallpaperController;
use std::fs;

#[test]
fn flujo_completo_con_ocultar() {
    let _guard = super::HOST_WINDOW_LOCK
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let root = std::env::temp_dir().join("prisma-wallpapers-controller");
    let _ = fs::remove_dir_all(&root);
    let videos = root.join("videos");
    fs::create_dir_all(&videos).unwrap();
    for name in ["uno.mp4", "dos.mp4"] {
        fs::write(videos.join(name), b"x").unwrap();
    }

    let controller = WallpaperController::new(root.join("config"));

    let source = controller
        .add_folder(videos.to_str().unwrap())
        .expect("añadir carpeta");
    let snapshot = controller.get_state().unwrap();
    assert_eq!(snapshot.total_media, 2, "deben entrar los dos vídeos");
    assert!(!source.hidden);

    // Iniciar el fondo: crea ventana y motor reales.
    let snapshot = controller.start().expect("iniciar fondo");
    assert!(snapshot.is_active, "el fondo debe quedar activo");
    assert_eq!(snapshot.total_media, 2);

    // Reproducir un vídeo concreto.
    let target = videos.join("uno.mp4").to_string_lossy().to_string();
    let snapshot = controller.play_file(&target).expect("reproducir archivo");
    assert_eq!(snapshot.current_media.as_deref(), Some(target.as_str()));

    // Ocultar ese vídeo: sale de la cola y el motor debe seguir sincronizado.
    let snapshot = controller.set_media_hidden(&target, true).expect("ocultar");
    assert_eq!(snapshot.total_media, 1, "el vídeo oculto sale de la cola");
    assert!(
        snapshot.current_media.as_deref() != Some(target.as_str()),
        "el motor no debe seguir en el vídeo oculto"
    );

    // Mostrarlo de nuevo: vuelve a la cola.
    let snapshot = controller.set_media_hidden(&target, false).expect("mostrar");
    assert_eq!(snapshot.total_media, 2, "el vídeo vuelve a la cola");

    // Ocultar la carpeta entera.
    let snapshot = controller
        .set_folder_hidden(&source.id, true)
        .expect("ocultar carpeta");
    assert_eq!(snapshot.total_media, 0, "la carpeta oculta vacía la cola");
    assert!(snapshot.media.is_empty(), "sus medios no se listan");
    assert!(!snapshot.is_active, "una cola vacía libera el host y el motor");
    assert!(!snapshot.compositor_enabled, "sin medio base no queda composición activa");

    let snapshot = controller
        .set_folder_hidden(&source.id, false)
        .expect("mostrar carpeta");
    assert_eq!(snapshot.total_media, 2);

    // Limpieza: parar el fondo y borrar los temporales.
    controller.stop().expect("parar");
    let _ = fs::remove_dir_all(&root);
}

/// El modo de medio filtra la cola y la cuadrícula del controlador.
/// Por defecto solo hay vídeos, aunque la carpeta tenga también imágenes.
#[test]
fn el_modo_de_medio_filtra_la_cola_del_controlador() {
    let _guard = super::HOST_WINDOW_LOCK
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    let root = std::env::temp_dir().join("prisma-wallpapers-controller-modo");
    let _ = fs::remove_dir_all(&root);
    let folder = root.join("mixtos");
    fs::create_dir_all(&folder).unwrap();
    for name in ["uno.mp4", "dos.mp4", "tres.png"] {
        fs::write(folder.join(name), b"x").unwrap();
    }

    let controller = WallpaperController::new(root.join("config"));
    let source = controller
        .add_folder(folder.to_str().unwrap())
        .expect("añadir carpeta");
    assert_eq!(
        source.media_count, 3,
        "la carpeta declara todos sus medios, vídeos e imágenes"
    );

    // Por defecto solo entran los vídeos.
    let snapshot = controller.get_state().unwrap();
    assert_eq!(snapshot.total_media, 2, "el modo por defecto es solo vídeo");
    assert_eq!(snapshot.media.len(), 2);
    assert!(snapshot.media.iter().all(|m| m.kind == super::sources::MediaKind::Video));

    // Modo imagen: solo la imagen.
    let snapshot = controller
        .set_media_kind_mode(super::sources::MediaKindMode::Image)
        .expect("cambiar a modo imagen");
    assert_eq!(snapshot.total_media, 1);
    assert_eq!(snapshot.media.len(), 1);
    assert_eq!(snapshot.media[0].kind, super::sources::MediaKind::Image);
    let imagen = folder.join("tres.png").to_string_lossy().to_string();
    assert_eq!(
        snapshot.current_media.as_deref(),
        Some(imagen.as_str()),
        "en modo imagen el medio en pantalla es la imagen"
    );

    // Modo mixto: los tres. La imagen sigue siendo elegible, así que se conserva.
    let snapshot = controller
        .set_media_kind_mode(super::sources::MediaKindMode::Mixed)
        .expect("cambiar a modo mixto");
    assert_eq!(snapshot.total_media, 3);
    assert_eq!(snapshot.media.len(), 3);
    assert_eq!(
        snapshot.current_media.as_deref(),
        Some(imagen.as_str()),
        "el medio en pantalla se conserva cuando sigue siendo elegible"
    );

    // Volver al modo vídeo: la imagen deja de ser elegible, así que se arranca
    // por el primer vídeo del modo.
    let snapshot = controller
        .set_media_kind_mode(super::sources::MediaKindMode::Video)
        .expect("volver a modo vídeo");
    assert_eq!(snapshot.total_media, 2);
    assert!(
        snapshot.current_media.as_deref() != Some(imagen.as_str()),
        "un medio que no es elegible en el modo nuevo no se conserva"
    );
    assert!(
        snapshot
            .current_media
            .as_deref()
            .map(|p| p.ends_with(".mp4"))
            .unwrap_or(false),
        "se arranca por el primer medio elegible del modo nuevo"
    );

    let _ = fs::remove_dir_all(&root);
}
