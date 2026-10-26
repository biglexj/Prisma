#[cfg(feature = "mpv")]
use libmpv2::{events::Event, Mpv};

use super::sources::MediaKind;

/// Salida de vídeo de libmpv usada por los fondos vivos.
/// mpv v0.41 eliminó la salida "auto" (provocaba "Video output auto not found!"
/// y dejaba el escritorio en negro), por lo que hay que nombrar una concreta.
pub const VIDEO_OUTPUT: &str = "gpu";

/// Volumen propio del fondo vivo cuando el sonido está activado.
/// Es de la sesión de libmpv del fondo: no altera el volumen del sistema
/// ni el del reproductor de música de Prisma.
pub const WALLPAPER_VOLUME: f64 = 50.0;

/// Salida de audio de libmpv en Windows.
/// Igual que la salida de vídeo, mpv v0.41 quitó el alias "auto"
/// ("Audio output auto not found! -> no sound"), así que se nombra el driver
/// concreto. Con "null" el fondo no abre ningún dispositivo de audio.
pub const AUDIO_OUTPUT: &str = "wasapi";
pub const AUDIO_OUTPUT_SILENT: &str = "null";

/// Conserva GIF en Imágenes, pero reproduce su secuencia durante toda la duración elegida.
fn is_animated_image(path: &str) -> bool {
    std::path::Path::new(path).extension().is_some_and(|ext| ext.eq_ignore_ascii_case("gif"))
}

/// Motor del fondo vivo: reproduce vídeos e imágenes estáticas en la misma
/// sesión de libmpv (misma ventana del escritorio).
pub struct MediaWallpaperEngine {
    #[cfg(feature = "mpv")]
    mpv: Mpv,
    current_path: Option<String>,
    /// Tipo del medio cargado. Decide cómo termina: un vídeo termina cuando
    /// mpv llega al final del archivo; una imagen termina cuando se cumple
    /// la duración pedida por el usuario.
    current_kind: MediaKind,
    loaded_at: std::time::Instant,
    vo_verified: bool,
    /// Con un único medio en cola no se avanza nunca: el vídeo se repite en
    /// bucle y la imagen se queda fija en pantalla.
    loop_single: bool,
    /// Tiempo que una imagen estática permanece en pantalla.
    image_duration: std::time::Duration,
    /// Preferencia de sonido del usuario. Se recuerda aunque el medio actual
    /// sea una imagen, que nunca debe abrir dispositivo de audio.
    audio_enabled: bool,
    /// Momento en el que se pausó el fondo. El tiempo en pausa no cuenta para
    /// la duración de una imagen: al reanudar, sigue el resto de su tiempo
    /// en pantalla.
    paused_at: Option<std::time::Instant>,
}

impl MediaWallpaperEngine {
    #[cfg(feature = "mpv")]
    pub fn new(wid: i64, audio_enabled: bool) -> Result<Self, String> {
        let mut setup_error: Option<String> = None;
        let mpv = Mpv::with_initializer(|initializer| {
            let settings: Vec<(&str, Result<(), libmpv2::Error>)> = vec![
                // Orden importante: "vo" debe fijarse ANTES que "wid". Si se invierte,
                // mpv levanta la salida de vídeo sin asociarla a la ventana del escritorio
                // y el vídeo se reproduce pero no se pinta (verificado por captura).
                ("vo", initializer.set_property("vo", VIDEO_OUTPUT)),
                ("wid", initializer.set_property("wid", wid)),
                ("hwdec", initializer.set_property("hwdec", "auto-safe")),
                ("keep-open", initializer.set_property("keep-open", "always")),
                ("auto-window-resize", initializer.set_property("auto-window-resize", "no")),
                ("audio-display", initializer.set_property("audio-display", "no")),
                // El fondo usa su propia sesión de audio: nunca toma el dispositivo
                // en modo exclusivo ni el volumen del sistema, de modo que la música
                // que esté sonando en Prisma no se ve afectada.
                ("audio-exclusive", initializer.set_property("audio-exclusive", "no")),
                ("osc", initializer.set_property("osc", "no")),
                ("osd-level", initializer.set_property("osd-level", 0)),
                ("input-default-bindings", initializer.set_property("input-default-bindings", "no")),
                ("input-vo-keyboard", initializer.set_property("input-vo-keyboard", "no")),
                ("force-window", initializer.set_property("force-window", "yes")),
                ("prefetch-playlist", initializer.set_property("prefetch-playlist", "yes")),
                ("video-sync", initializer.set_property("video-sync", "audio")),
                // Filtros de escalado sin pasos de reconstrucción ni interpolación temporal.
                ("scale", initializer.set_property("scale", "spline36")),
                ("dscale", initializer.set_property("dscale", "mitchell")),
            ];
            for (name, result) in settings {
                if let Err(error) = result {
                    setup_error.get_or_insert_with(|| format!("{name}: {error:?}"));
                }
            }
            Ok(())
        })
        .map_err(|e| format!("Error al inicializar sesión libmpv de fondo: {e:?}"))?;

        if let Some(error) = setup_error {
            return Err(format!(
                "No se pudo configurar el motor de fondos (salida de vídeo '{VIDEO_OUTPUT}'): {error}"
            ));
        }

        let mut engine = Self {
            mpv,
            current_path: None,
            current_kind: MediaKind::Video,
            loaded_at: std::time::Instant::now(),
            vo_verified: false,
            loop_single: false,
            image_duration: std::time::Duration::from_secs(
                super::sources::DEFAULT_IMAGE_DURATION_SEC as u64,
            ),
            audio_enabled,
            paused_at: None,
        };
        engine.apply_audio_state(audio_enabled);
        Ok(engine)
    }

    #[cfg(not(feature = "mpv"))]
    pub fn new(_wid: i64, _audio_enabled: bool) -> Result<Self, String> {
        Err("Soporte libmpv no compilado en esta versión".to_string())
    }

    /// Carga un medio (vídeo o imagen) en la sesión de libmpv.
    /// La imagen se pinta en la misma ventana que el vídeo: no hace falta
    /// ningún renderizador aparte, mpv la decodifica con su demuxer de imagen.
    pub fn load_media(&mut self, raw_path: &str, loop_single: bool, fit: &str) -> Result<(), String> {
        #[cfg(feature = "mpv")]
        {
            let path = raw_path.strip_prefix(r"\\?\").unwrap_or(raw_path);
            let kind = MediaKind::from_path(path);
            // Una imagen estática no se repite en bucle: su final lo marca el
            // temporizador de duración, no el reproductor.
            let animated_image = is_animated_image(path);
            let loop_val = if animated_image || (loop_single && kind == MediaKind::Video) {
                "inf"
            } else {
                "no"
            };
            let _ = self.mpv.set_property("loop-file", loop_val);
            self.loop_single = loop_single;
            let panscan = if fit == "contain" { 0.0 } else { 1.0 };
            let _ = self.mpv.set_property("panscan", panscan);
            // El tipo se fija ANTES de tocar el audio: una imagen no tiene
            // pista de sonido y la sesión no debe abrir dispositivo alguno.
            self.current_kind = kind;
            let audio_enabled = self.audio_enabled;
            self.apply_audio_state(audio_enabled);
            self.mpv
                .command("loadfile", &[path, "replace"])
                .map_err(|e| format!("Error cargando medio de fondo: {e:?}"))?;
            let _ = self.mpv.set_property("pause", false);
            self.current_path = Some(path.to_string());
            self.loaded_at = std::time::Instant::now();

            if !self.vo_verified {
                self.ensure_video_output()?;
            }

            Ok(())
        }
        #[cfg(not(feature = "mpv"))]
        {
            let _ = (raw_path, loop_single, fit);
            Err("libmpv desactivado".to_string())
        }
    }

    /// Comprueba que libmpv haya levantado de verdad la salida de vídeo.
    /// Si el nombre de la VO no existe en esta versión de mpv, la reproducción
    /// avanza pero no se pinta nada: hay que detectarlo y avisar.
    #[cfg(feature = "mpv")]
    fn ensure_video_output(&mut self) -> Result<(), String> {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(3);
        while std::time::Instant::now() < deadline {
            if self.mpv.get_property::<bool>("vo-configured").unwrap_or(false) {
                self.vo_verified = true;
                return Ok(());
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }

        let current = self.mpv.get_property::<String>("current-vo").unwrap_or_default();
        Err(format!(
            "libmpv no pudo iniciar la salida de vídeo '{VIDEO_OUTPUT}'. El escritorio quedará sin fondo animado.{}",
            if current.is_empty() {
                String::new()
            } else {
                format!(" (última salida activa: '{current}')")
            }
        ))
    }

    #[allow(dead_code)]
    pub fn queue_next(&mut self, raw_path: &str) -> Result<(), String> {
        #[cfg(feature = "mpv")]
        {
            let path = raw_path.strip_prefix(r"\\?\").unwrap_or(raw_path);
            let _ = self.mpv.command("loadfile", &[path, "append"]);
            Ok(())
        }
        #[cfg(not(feature = "mpv"))]
        {
            let _ = raw_path;
            Ok(())
        }
    }

    /// ¿Ya terminó el medio cargado y toca avanzar en la cola?
    /// La decisión la toma el motor, que es quien sabe qué se ha cargado:
    ///  · un vídeo termina cuando mpv llega al final del archivo;
    ///  · una imagen termina cuando se cumple la duración configurada.
    pub fn is_finished(&self) -> bool {
        #[cfg(feature = "mpv")]
        {
            // Con un solo medio en cola no hay "siguiente": el vídeo se repite
            // en bucle (recargarlo provocaría un parpadeo negro en cada vuelta)
            // y la imagen se queda fija en la pantalla.
            if self.loop_single {
                return false;
            }
            if self.current_kind == MediaKind::Image {
                return self.image_elapsed();
            }
            // Ignorar los primeros 2 segundos tras cargar para que mpv abra el contenedor y decodifique
            if self.elapsed_since_load() < std::time::Duration::from_secs(2) {
                return false;
            }
            self.mpv.get_property::<bool>("eof-reached").unwrap_or(false)
        }
        #[cfg(not(feature = "mpv"))]
        false
    }

    /// Tiempo transcurrido desde la última carga, sin contar la pausa.
    fn elapsed_since_load(&self) -> std::time::Duration {
        std::time::Instant::now()
            .checked_duration_since(self.loaded_at)
            .unwrap_or_default()
    }

    /// ¿Una imagen estática ya ha pasado su tiempo en pantalla?
    /// mpv puede tratar la imagen como un archivo de duración indeterminada
    /// (no hay final de archivo al que esperar), así que la espera la lleva
    /// el propio motor desde que cargó el medio.
    #[cfg(feature = "mpv")]
    fn image_elapsed(&self) -> bool {
        self.elapsed_since_load() >= self.image_duration
    }

    #[cfg(not(feature = "mpv"))]
    fn image_elapsed(&self) -> bool {
        false
    }

    /// Tiempo que una imagen estática permanece en pantalla.
    pub fn set_image_duration(&mut self, seconds: u32) {
        self.image_duration = std::time::Duration::from_secs(seconds as u64);
    }

    pub fn set_parallax(&mut self, x: f32, y: f32, strength: f32) -> Result<(), String> {
        #[cfg(feature = "mpv")]
        {
            let strength = strength.clamp(0.0, 2.0) as f64;
            for (name, value) in [("video-zoom", (1.0 + strength * 0.08).log2()),
                ("video-pan-x", x as f64 * strength * 0.025),
                ("video-pan-y", -y as f64 * strength * 0.025)] {
                self.mpv.set_property(name, value).map_err(|e| format!("Parallax: {e:?}"))?;
            }
        }
        Ok(())
    }

    pub fn pause(&mut self) -> Result<(), String> {
        self.paused_at = Some(std::time::Instant::now());
        #[cfg(feature = "mpv")]
        {
            self.mpv
                .set_property("pause", true)
                .map_err(|e| format!("Error pausando fondo: {e:?}"))
        }
        #[cfg(not(feature = "mpv"))]
        Ok(())
    }

    pub fn resume(&mut self) -> Result<(), String> {
        if let Some(paused_at) = self.paused_at.take() {
            // El tiempo en pausa no cuenta: la imagen sigue el resto de su
            // tiempo en pantalla y el vídeo no adelanta su fin de archivo.
            self.loaded_at += paused_at.elapsed();
        }
        #[cfg(feature = "mpv")]
        {
            self.mpv
                .set_property("pause", false)
                .map_err(|e| format!("Error reanudando fondo: {e:?}"))
        }
        #[cfg(not(feature = "mpv"))]
        Ok(())
    }

    #[allow(dead_code)]
    pub fn is_paused(&self) -> bool {
        #[cfg(feature = "mpv")]
        {
            self.mpv.get_property::<bool>("pause").unwrap_or(false)
        }
        #[cfg(not(feature = "mpv"))]
        false
    }

    #[allow(dead_code)]
    pub fn get_current_path(&self) -> Option<String> {
        #[cfg(feature = "mpv")]
        {
            if let Ok(path) = self.mpv.get_property::<String>("path") {
                if !path.is_empty() {
                    let clean = path.strip_prefix(r"\\?\").unwrap_or(&path);
                    return Some(clean.to_string());
                }
            }
            self.current_path.clone()
        }
        #[cfg(not(feature = "mpv"))]
        None
    }

    pub fn set_fit(&mut self, fit: &str) -> Result<(), String> {
        #[cfg(feature = "mpv")]
        {
            let panscan = if fit == "contain" { 0.0 } else { 1.0 };
            self.mpv
                .set_property("panscan", panscan)
                .map_err(|e| format!("Error ajustando encuadre: {e:?}"))
        }
        #[cfg(not(feature = "mpv"))]
        {
            let _ = fit;
            Ok(())
        }
    }

    #[allow(dead_code)]
    pub fn set_mute(&mut self, mute: bool) -> Result<(), String> {
        #[cfg(feature = "mpv")]
        {
            self.mpv
                .set_property("mute", if mute { "yes" } else { "no" })
                .map_err(|e| format!("Error configurando audio de fondo: {e:?}"))
        }
        #[cfg(not(feature = "mpv"))]
        {
            let _ = mute;
            Ok(())
        }
    }

    /// Activa o desactiva el sonido del fondo vivo.
    /// El ajuste afecta únicamente a esta sesión de libmpv: la música que esté
    /// sonando en el reproductor de Prisma no se silencia ni se modifica.
    pub fn set_audio_enabled(&mut self, enabled: bool) -> Result<(), String> {
        self.apply_audio_state(enabled);
        Ok(())
    }

    /// Estado de audio de la sesión del fondo: (silencio, volumen).
    #[allow(dead_code)]
    pub fn audio_state(&self) -> (bool, f64) {
        #[cfg(feature = "mpv")]
        {
            let muted = self.mpv.get_property::<bool>("mute").unwrap_or(true);
            let volume = self.mpv.get_property::<f64>("volume").unwrap_or(0.0);
            (muted, volume)
        }
        #[cfg(not(feature = "mpv"))]
        {
            (true, 0.0)
        }
    }

    /// Salida de audio en uso: "null" cuando el fondo está en silencio.
    #[allow(dead_code)]
    pub fn audio_output(&self) -> String {
        #[cfg(feature = "mpv")]
        {
            self.mpv.get_property::<String>("ao").unwrap_or_default()
        }
        #[cfg(not(feature = "mpv"))]
        {
            String::new()
        }
    }

    /// Nombre de la salida de audio realmente abierta ("wasapi", "sdl", ...).
    /// Vacío si no hay ninguna salida activa.
    #[allow(dead_code)]
    pub fn current_audio_output(&self) -> String {
        #[cfg(feature = "mpv")]
        {
            self.mpv.get_property::<String>("current-ao").unwrap_or_default()
        }
        #[cfg(not(feature = "mpv"))]
        {
            String::new()
        }
    }

    /// Códec de la pista de audio en curso (vacío si no hay audio).
    #[allow(dead_code)]
    pub fn audio_codec(&self) -> String {
        #[cfg(feature = "mpv")]
        {
            self.mpv.get_property::<String>("audio-codec").unwrap_or_default()
        }
        #[cfg(not(feature = "mpv"))]
        {
            String::new()
        }
    }

    /// Estado de la salida de vídeo de libmpv.
    #[allow(dead_code)]
    pub fn vo_configured(&self) -> bool {
        #[cfg(feature = "mpv")]
        {
            self.mpv.get_property::<bool>("vo-configured").unwrap_or(false)
        }
        #[cfg(not(feature = "mpv"))]
        {
            false
        }
    }

    #[cfg(feature = "mpv")]
    fn apply_audio_state(&mut self, enabled: bool) {
        self.audio_enabled = enabled;
        // El fondo es una sesión de audio independiente:
        //  · con sonido, reproduce por el dispositivo por defecto como cualquier
        //    cliente compartido, sin tomar el dispositivo en exclusiva;
        //  · sin sonido, no abre dispositivo alguno (ao=null), de modo que no
        //    puede interferir con la música que esté sonando en la app.
        // Una imagen estática no tiene pista de audio: aunque el sonido esté
        // activado, mientras se muestra no se abre ningún dispositivo.
        let audible = enabled && self.current_kind == MediaKind::Video;
        let volume = if audible { WALLPAPER_VOLUME } else { 0.0 };
        let _ = self.mpv.set_property("volume", volume);
        let _ = self.mpv.set_property("mute", if audible { "no" } else { "yes" });
        let _ = self.mpv
            .set_property("ao", if audible { AUDIO_OUTPUT } else { AUDIO_OUTPUT_SILENT });
        let _ = self.mpv.set_property("video-sync", if audible { "audio" } else { "display" });
    }

    #[cfg(not(feature = "mpv"))]
    fn apply_audio_state(&mut self, enabled: bool) {
        self.audio_enabled = enabled;
    }

    pub fn stop(&mut self) -> Result<(), String> {
        self.paused_at = None;
        #[cfg(feature = "mpv")]
        {
            self.current_path = None;
            let _ = self.mpv.command("stop", &[]);
            Ok(())
        }
        #[cfg(not(feature = "mpv"))]
        Ok(())
    }

    #[allow(dead_code)]
    pub fn current_path(&self) -> Option<&String> {
        self.current_path.as_ref()
    }
}

/// Cierre ordenado de la sesión de mpv.
///
/// libmpv2 suelta el handle con `mpv_destroy`, que NO espera a que terminen
/// los hilos internos de vídeo y audio. Si el motor se suelta con una
/// reproducción viva, esos hilos siguen escribiendo en memoria que ya no es
/// suya y el proceso revienta con un error de acceso (verificado: la suite de
/// tests terminaba con `STATUS_ACCESS_VIOLATION` al cerrarse).
///
/// Se cierra el core con el comando "quit" y se espera al evento de apagado
/// antes de soltar el handle: es lo que hace internamente
/// `mpv_terminate_destroy`, que sí espera al fin de los hilos.
impl Drop for MediaWallpaperEngine {
    fn drop(&mut self) {
        #[cfg(feature = "mpv")]
        {
            let _ = self.mpv.command("quit", &[]);
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(3);
            while std::time::Instant::now() < deadline {
                match self.mpv.wait_event(0.05) {
                    // El core ya terminó: se puede soltar el handle sin riesgo.
                    Some(Ok(Event::Shutdown)) => break,
                    Some(_) => continue,
                    // Tiempo de espera agotado: se sigue hasta el límite.
                    None => continue,
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::VIDEO_OUTPUT;

    /// mpv v0.41 quitó la salida "auto". Volver a usarla deja el escritorio
    /// en negro sin ningún aviso, así que queda fijada por test.
    #[test]
    fn la_salida_de_video_no_es_auto() {
        assert_ne!(
            VIDEO_OUTPUT, "auto",
            "mpv ya no incluye la salida de vídeo 'auto': el fondo quedaría en negro"
        );
        assert!(
            ["gpu", "gpu-next", "direct3d"].contains(&VIDEO_OUTPUT),
            "la salida de vídeo debe existir en esta versión de mpv"
        );
    }
}

#[cfg(all(test, windows))]
mod audio_tests {
    use super::MediaWallpaperEngine;
    use crate::features::wallpapers::window::DesktopWallpaperWindow;
    use std::time::Duration;

    #[test]
    fn gif_anima_en_bucle_e_imagen_se_decodifica_a_resolucion_original() {
        let _guard=super::super::HOST_WINDOW_LOCK.lock().unwrap_or_else(|e|e.into_inner());
        let root=std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../temp/wallpaper-engine-regression").join(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos().to_string());
        std::fs::create_dir_all(&root).unwrap();
        let gif=root.join("animation.gif");
        std::fs::write(&gif,include_bytes!("../../../../tests/fixtures/wallpaper-animation.gif")).unwrap();
        let win=DesktopWallpaperWindow::create().unwrap();
        let mut engine=MediaWallpaperEngine::new(win.raw_handle(),false).unwrap();
        engine.load_media(gif.to_str().unwrap(),true,"cover").unwrap();
        assert_eq!(engine.mpv.get_property::<String>("loop-file").unwrap(),"inf");
        let mut shots=std::collections::HashSet::new();
        for n in 0..8 {
            std::thread::sleep(Duration::from_millis(160));
            let output=root.join(format!("gif-{n}.png"));
            engine.mpv.command("screenshot-to-file", &[output.to_str().unwrap(),"video"]).unwrap();
            let deadline=std::time::Instant::now()+Duration::from_secs(2);
            while !output.exists() && std::time::Instant::now()<deadline {std::thread::sleep(Duration::from_millis(10));}
            if n>=4 { shots.insert(image::open(&output).unwrap().to_rgba8().into_raw()); }
        }
        assert!(shots.len()>1,"El GIF no continúa animándose después del primer ciclo");
        let original=root.join("original-4k.png");
        image::RgbImage::from_pixel(3840,2160,image::Rgb([20,180,90])).save(&original).unwrap();
        engine.load_media(original.to_str().unwrap(),true,"cover").unwrap();
        std::thread::sleep(Duration::from_millis(400));
        let width=engine.mpv.get_property::<i64>("video-params/w").unwrap();
        let height=engine.mpv.get_property::<i64>("video-params/h").unwrap();
        assert_eq!((width,height),(3840,2160));
        assert_eq!(engine.mpv.get_property::<String>("loop-file").unwrap(),"no");
        assert_eq!(engine.mpv.get_property::<f64>("speed").unwrap(),1.0);
        eprintln!("GIF: {} fotogramas distintos; imagen decodificada {}x{}",shots.len(),width,height);
    }

    /// El sonido del fondo se gobierna por su propia sesión de libmpv:
    /// activarlo o apagarlo no toca la música del reproductor de Prisma.
    /// Con el sonido apagado el fondo ni siquiera abre el dispositivo de audio.
    #[test]
    fn el_sonido_del_fondo_se_gobierna_por_sesion() {
        let _guard = super::super::HOST_WINDOW_LOCK
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let win = DesktopWallpaperWindow::create().expect("ventana de fondo");
        let mut engine = MediaWallpaperEngine::new(win.raw_handle(), false).expect("motor");

        let (muted, volume) = engine.audio_state();
        assert!(muted, "el fondo arranca en silencio");
        assert_eq!(volume, 0.0);
        assert_eq!(
            engine.audio_output(),
            super::AUDIO_OUTPUT_SILENT,
            "en silencio el fondo no debe abrir el dispositivo de audio"
        );

        engine.set_audio_enabled(true).expect("activar sonido");
        let (muted, volume) = engine.audio_state();
        assert!(!muted, "el sonido debe quedar activo");
        assert_eq!(volume, super::WALLPAPER_VOLUME);
        assert_eq!(engine.audio_output(), super::AUDIO_OUTPUT);

        engine.set_audio_enabled(false).expect("apagar sonido");
        let (muted, volume) = engine.audio_state();
        assert!(muted, "al apagar vuelve el silencio");
        assert_eq!(volume, 0.0);
        assert_eq!(engine.audio_output(), super::AUDIO_OUTPUT_SILENT);
    }

    /// Con un vídeo que sí tiene pista de audio, el fondo la decodifica y la
    /// entrega al dispositivo solo cuando el sonido está activado.
    #[test]
    fn el_fondo_reproduce_audio_solo_con_el_sonido_activado() {
        let _guard = super::super::HOST_WINDOW_LOCK
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let clip = r"C:\Users\biglexj\AppData\Local\Temp\prisma-probe\con-audio.mp4";
        if !std::path::Path::new(clip).exists() {
            eprintln!("se omite: falta el clip de prueba");
            return;
        }

        let win = DesktopWallpaperWindow::create().expect("ventana de fondo");
        let mut engine = MediaWallpaperEngine::new(win.raw_handle(), true).expect("motor");
        engine.load_media(clip, true, "cover").expect("cargar");
        std::thread::sleep(Duration::from_millis(1200));

        let salida = engine.audio_output();
        assert_eq!(
            salida,
            super::AUDIO_OUTPUT,
            "con sonido el fondo usa la salida de audio de Windows"
        );
        let activa = engine.current_audio_output();
        assert!(
            !activa.is_empty(),
            "la salida de audio debe estar abierta cuando el sonido está activado"
        );
        assert!(
            !engine.audio_codec().is_empty(),
            "la pista de audio del vídeo debe decodificarse"
        );

        engine.set_audio_enabled(false).expect("apagar");
        std::thread::sleep(Duration::from_millis(400));
        assert_eq!(engine.audio_output(), super::AUDIO_OUTPUT_SILENT);
        assert_eq!(
            engine.current_audio_output(),
            super::AUDIO_OUTPUT_SILENT,
            "apagado el fondo debe pasar al sumidero nulo, sin usar el dispositivo"
        );
    }
}
