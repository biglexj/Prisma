pub mod compositor;
pub mod composition_settings;
pub mod engine;
pub mod sources;
pub mod window;

/// Serializa las pruebas que crean una ventana del escritorio y una sesión de
/// libmpv: dos instancias concurrentes sobre el mismo WorkerW chocan al
/// destruirse y provocan un fallo de acceso al cerrar el proceso de pruebas.
#[cfg(test)]
pub(crate) static HOST_WINDOW_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
#[cfg(test)]
mod sources_tests;
#[cfg(test)]
mod controller_tests;

use engine::MediaWallpaperEngine;
use serde::{Deserialize, Serialize};
use sources::{
    clean_path_str, FolderSource, MediaKindMode, SourceManager, WallpaperFit, WallpaperMediaItem,
    WallpaperMode, WallpaperSettings, MAX_IMAGE_DURATION_SEC, MIN_IMAGE_DURATION_SEC,
};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;
use window::{DesktopWallpaperWindow, ScreenGeometry};

/// Estado del fondo vivo que ve la interfaz.
/// "Medio" es un vídeo o una imagen estática: para el usuario es lo mismo.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperStateSnapshot {
    pub is_active: bool,
    pub is_paused: bool,
    pub base_active: bool,
    /// Ruta del medio que está en pantalla.
    pub current_media: Option<String>,
    /// Carpeta a la que pertenece el medio en pantalla.
    pub current_folder: Option<String>,
    /// Medios elegibles en el modo activo (vídeos, imágenes o ambos).
    pub total_media: usize,
    /// Si la composición de escritorio (capas 2 a 6) está montada.
    pub compositor_enabled: bool,
    pub settings: WallpaperSettings,
    /// Medios elegibles del modo activo, para la cuadrícula.
    pub media: Vec<WallpaperMediaItem>,
}

struct InnerState {
    source_manager: SourceManager,
    window: Option<DesktopWallpaperWindow>,
    engine: Option<MediaWallpaperEngine>,
    is_paused: bool,
    /// Si la superficie web de la composición está montada sobre el escritorio.
    compositor_enabled: bool,
    compositor_config: compositor::CompositorConfig,
    compositor_app: Option<AppHandle>,
    compositor_epoch: u64,
}

impl Drop for InnerState {
    fn drop(&mut self) {
        WallpaperController::close_compositor(self);
        // El motor debe cerrarse ANTES que la ventana: libmpv sigue usando el
        // HWND del escritorio al destruirse y, si la ventana desaparece antes,
        // el cierre de la aplicación termina en un fallo de acceso.
        if let Some(mut engine) = self.engine.take() {
            let _ = engine.stop();
            drop(engine);
        }
        self.window = None;
    }
}

#[derive(Clone)]
pub struct WallpaperController {
    inner: Arc<Mutex<InnerState>>,
    monitor_running: Arc<AtomicBool>,
    compositor_lifecycle: Arc<Mutex<()>>,
    pub composition_transition: Arc<AtomicBool>,
}

impl WallpaperController {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let source_manager = SourceManager::new(app_data_dir);
        let mut compositor_config = source_manager.settings().composition.clone();
        compositor_config.migrate_layers();
        let compositor_config = if compositor_config.validate().is_ok() {
            compositor_config
        } else { compositor::CompositorConfig::default() };
        let controller = Self {
            inner: Arc::new(Mutex::new(InnerState {
                source_manager,
                window: None,
                engine: None,
                is_paused: false,
                compositor_enabled: false,
                compositor_config,
                compositor_app: None,
                compositor_epoch: 0,
            })),
            monitor_running: Arc::new(AtomicBool::new(false)),
            compositor_lifecycle: Arc::new(Mutex::new(())),
            composition_transition: Arc::new(AtomicBool::new(false)),
        };

        controller.start_monitor_loop();
        controller
    }

    pub fn should_auto_start(&self) -> bool {
        if let Ok(inner) = self.inner.lock() {
            let settings = inner.source_manager.settings();
            (settings.auto_start || settings.is_active) && inner.source_manager.total_media() > 0
        } else {
            false
        }
    }

    pub fn start(&self) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;

        // Si ya está activo, reanudar
        if inner.engine.is_some() && inner.window.is_some() {
            if let Some(engine) = &mut inner.engine {
                let _ = engine.resume();
            }
            inner.is_paused = false;
            inner.source_manager.settings_mut().is_active = true;
            let _ = inner.source_manager.save_to_disk();
            return Ok(self.build_snapshot(&inner));
        }

        let media_path = inner
            .source_manager
            .current_media()
            .ok_or_else(|| "No hay medios válidos en las carpetas activas de Fondos Vivos".to_string())?;

        // 1. Crear ventana nativa en el escritorio de Windows
        if inner.window.is_none() { inner.window = Some(DesktopWallpaperWindow::create()?); }
        let wid = inner.window.as_ref().unwrap().raw_handle();

        // 2. Inicializar motor libmpv apuntando al HWND
        let mut eng = MediaWallpaperEngine::new(wid, inner.source_manager.settings().audio_enabled)?;
        eng.set_image_duration(inner.source_manager.settings().image_duration_sec);
        let single = inner.source_manager.total_media() == 1;
        let fit_str = match inner.source_manager.settings().fit {
            WallpaperFit::Contain => "contain",
            WallpaperFit::Cover => "cover",
        };

        eng.load_media(&media_path, single, fit_str)?;

        inner.engine = Some(eng);
        inner.is_paused = false;
        inner.source_manager.settings_mut().is_active = true;
        let _ = inner.source_manager.save_to_disk();

        Ok(self.build_snapshot(&inner))
    }

    pub fn play_file(&self, path: &str) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let clean = clean_path_str(path);
        inner.source_manager.set_current_media(&clean);

        let single = inner.source_manager.total_media() == 1;
        let fit_str = match inner.source_manager.settings().fit {
            WallpaperFit::Contain => "contain",
            WallpaperFit::Cover => "cover",
        };

        if inner.engine.is_none() || inner.window.is_none() {
            if inner.window.is_none() { inner.window = Some(DesktopWallpaperWindow::create()?); }
            let wid = inner.window.as_ref().unwrap().raw_handle();
            let mut eng = MediaWallpaperEngine::new(wid, inner.source_manager.settings().audio_enabled)?;
            eng.set_image_duration(inner.source_manager.settings().image_duration_sec);
            eng.load_media(&clean, single, fit_str)?;
            inner.engine = Some(eng);
        } else if let Some(engine) = &mut inner.engine {
            engine.load_media(&clean, single, fit_str)?;
        }

        inner.is_paused = false;
        inner.source_manager.settings_mut().is_active = true;
        let _ = inner.source_manager.save_to_disk();
        Ok(self.build_snapshot(&inner))
    }

    pub fn pause(&self) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(engine) = &mut inner.engine {
            engine.pause()?;
        }
        if inner.window.is_some() { inner.is_paused = true; }
        Ok(self.build_snapshot(&inner))
    }

    pub fn resume(&self) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(engine) = &mut inner.engine {
            engine.resume()?;
        }
        inner.is_paused = false;
        Ok(self.build_snapshot(&inner))
    }

    pub fn next(&self) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let next_media = inner.source_manager.advance_next();
        let single = inner.source_manager.total_media() == 1;
        let fit_str = match inner.source_manager.settings().fit {
            WallpaperFit::Contain => "contain",
            WallpaperFit::Cover => "cover",
        };
        let is_paused = inner.is_paused;

        if let (Some(media), Some(engine)) = (next_media, &mut inner.engine) {
            let _ = engine.load_media(&media, single, fit_str);
            if is_paused {
                let _ = engine.pause();
            }
        }
        Ok(self.build_snapshot(&inner))
    }

    pub fn prev(&self) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let prev_media = inner.source_manager.advance_prev();
        let single = inner.source_manager.total_media() == 1;
        let fit_str = match inner.source_manager.settings().fit {
            WallpaperFit::Contain => "contain",
            WallpaperFit::Cover => "cover",
        };
        let is_paused = inner.is_paused;

        if let (Some(media), Some(engine)) = (prev_media, &mut inner.engine) {
            let _ = engine.load_media(&media, single, fit_str);
            if is_paused {
                let _ = engine.pause();
            }
        }
        Ok(self.build_snapshot(&inner))
    }

    pub fn stop(&self) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        Self::close_compositor(&mut inner);
        if let Some(mut engine) = inner.engine.take() {
            let _ = engine.stop();
        }
        inner.window = None;
        inner.is_paused = false;
        inner.source_manager.settings_mut().is_active = false;
        let _ = inner.source_manager.save_to_disk();
        Ok(self.build_snapshot(&inner))
    }

    /// Cierre del proceso sin cambiar la intención persistida de restaurar el fondo.
    pub fn shutdown(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            Self::close_compositor(&mut inner);
            if let Some(mut engine) = inner.engine.take() {
                let _ = engine.stop();
            }
            inner.window = None;
        }
    }

    pub fn add_folder(&self, folder_path: &str) -> Result<FolderSource, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let curr = inner.source_manager.current_media();
        let source = inner.source_manager.add_folder(folder_path)?;
        inner.source_manager.rebuild_queue(curr.as_deref());
        Ok(source)
    }

    pub fn remove_folder(&self, id: &str) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let curr = inner.source_manager.current_media();
        inner.source_manager.remove_folder(id);
        inner.source_manager.rebuild_queue(curr.as_deref());
        Ok(self.build_snapshot(&inner))
    }

    pub fn toggle_folder(&self, id: &str, enabled: bool) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let curr = inner.source_manager.current_media();
        inner.source_manager.toggle_folder(id, enabled);
        inner.source_manager.rebuild_queue(curr.as_deref());
        Ok(self.build_snapshot(&inner))
    }

    /// Oculta o muestra una carpeta: sus medios dejan de listarse y de reproducirse.
    pub fn set_folder_hidden(&self, id: &str, hidden: bool) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        if !inner.source_manager.set_folder_hidden(id, hidden) {
            return Err("No se encontró la carpeta indicada.".to_string());
        }
        Self::sync_engine(&mut inner)?;
        Ok(self.build_snapshot(&inner))
    }

    /// Oculta o muestra un medio concreto (vídeo o imagen): deja de listarse
    /// marcado como oculto y sale de la cola de reproducción.
    pub fn set_media_hidden(&self, path: &str, hidden: bool) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        inner.source_manager.set_media_hidden(path, hidden);
        Self::sync_engine(&mut inner)?;
        Ok(self.build_snapshot(&inner))
    }

    /// Cambia el tipo de medio que entra en la cola y en la cuadrícula.
    /// Si el medio en pantalla sigue siendo elegible se conserva; si no, se
    /// arranca por el primer elemento elegible del modo nuevo. Si el modo
    /// nuevo no deja nada elegible, el fondo se detiene con un diagnóstico
    /// claro y el estado queda coherente (cola vacía, fondo parado).
    pub fn set_media_kind_mode(&self, mode: MediaKindMode) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        inner.source_manager.set_media_kind_mode(mode);

        if inner.source_manager.total_media() == 0 {
            if let Some(mut engine) = inner.engine.take() {
                let _ = engine.stop();
            }
            if !inner.compositor_enabled { inner.window = None; }
            inner.source_manager.settings_mut().is_active = false;
            let _ = inner.source_manager.save_to_disk();
            return Err(format!(
                "No hay {} en las carpetas activas de Fondos Vivos. El fondo queda detenido.",
                mode.label()
            ));
        }

        // Si el medio en pantalla dejó de ser elegible, el motor carga el
        // primero del modo nuevo; si sigue siendo elegible, no se toca.
        Self::sync_engine(&mut inner)?;
        Ok(self.build_snapshot(&inner))
    }

    /// Segundos que una imagen estática permanece en pantalla.
    pub fn set_image_duration(&self, seconds: u32) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let clamped = seconds.clamp(MIN_IMAGE_DURATION_SEC, MAX_IMAGE_DURATION_SEC);
        inner.source_manager.set_image_duration(clamped);
        if let Some(engine) = &mut inner.engine {
            engine.set_image_duration(clamped);
        }
        Ok(self.build_snapshot(&inner))
    }

    /// Mantiene el motor alineado con el medio actual de la cola.
    /// Si el medio en reproducción fue ocultado o dejó de ser elegible, se
    /// carga el siguiente disponible.
    fn sync_engine(inner: &mut InnerState) -> Result<(), String> {
        if inner.engine.is_none() || inner.window.is_none() {
            return Ok(());
        }

        let current = inner.source_manager.current_media();
        let Some(current) = current else {
            if let Some(mut engine) = inner.engine.take() {
                let _ = engine.stop();
            }
            if !inner.compositor_enabled { inner.window = None; }
            inner.source_manager.settings_mut().is_active = false;
            inner.source_manager.save_to_disk()?;
            return Ok(());
        };

        let already_loaded = inner
            .engine
            .as_ref()
            .and_then(|engine| engine.current_path().cloned())
            .map(|path| path == current)
            .unwrap_or(false);
        if already_loaded {
            return Ok(());
        }

        let single = inner.source_manager.total_media() == 1;
        let fit_str = match inner.source_manager.settings().fit {
            WallpaperFit::Contain => "contain",
            WallpaperFit::Cover => "cover",
        };
        if let Some(engine) = &mut inner.engine {
            engine.load_media(&current, single, fit_str)?;
        }
        Ok(())
    }

    pub fn refresh_sources(&self) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let curr = inner.source_manager.current_media();
        inner.source_manager.refresh_all_sources();
        inner.source_manager.rebuild_queue(curr.as_deref());
        Ok(self.build_snapshot(&inner))
    }

    pub fn set_mode(&self, mode: WallpaperMode) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let curr = inner.source_manager.current_media();
        inner.source_manager.set_mode(mode);
        inner.source_manager.rebuild_queue(curr.as_deref());
        Ok(self.build_snapshot(&inner))
    }

    pub fn set_fit(&self, fit: WallpaperFit) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        inner.source_manager.set_fit(fit.clone());
        if let Some(engine) = &mut inner.engine {
            let fit_str = match fit {
                WallpaperFit::Contain => "contain",
                WallpaperFit::Cover => "cover",
            };
            let _ = engine.set_fit(fit_str);
        }
        Ok(self.build_snapshot(&inner))
    }

    /// Activa o desactiva el sonido del fondo vivo.
    /// El ajuste es local a la sesión de audio del fondo: la música que esté
    /// sonando en el reproductor de Prisma no se silencia ni cambia de volumen,
    /// y el fondo nunca toma el dispositivo de audio en modo exclusivo.
    pub fn set_audio_enabled(&self, enabled: bool) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        inner.source_manager.settings_mut().audio_enabled = enabled;
        let _ = inner.source_manager.save_to_disk();
        if let Some(engine) = &mut inner.engine {
            engine.set_audio_enabled(enabled)?;
        }
        Ok(self.build_snapshot(&inner))
    }

    pub fn get_state(&self) -> Result<WallpaperStateSnapshot, String> {
        let inner = self.inner.lock().map_err(|e| e.to_string())?;
        Ok(self.build_snapshot(&inner))
    }

    /// Monta o desmonta la composición de escritorio (capas 2 a 6).
    ///
    /// La superficie web se cuelga del contenedor del escritorio, así que
    /// queda por encima de la capa de vídeo y por debajo de la capa de
    /// iconos. Exige que el fondo de escritorio esté activo: sin él no hay
    /// contenedor donde colgarla.
    pub fn set_compositor_enabled(
        &self,
        app: &AppHandle,
        enabled: bool,
    ) -> Result<WallpaperStateSnapshot, String> {
        let _lifecycle = self.compositor_lifecycle.lock().map_err(|e| e.to_string())?;
        let (epoch, parent) = {
            let mut inner = self.inner.lock().map_err(|e|e.to_string())?;
            inner.compositor_epoch += 1;
            (inner.compositor_epoch, inner.window.as_ref().map(|w|w.host_handle()))
        };
        if !enabled {
            let host = {
                let mut inner = self.inner.lock().map_err(|e|e.to_string())?;
                Self::close_compositor(&mut inner);
                if inner.engine.is_none() { inner.is_paused=false; inner.window.take() } else { None }
            };
            app.run_on_main_thread(move||drop(host)).map_err(|e|e.to_string())?;
            return self.get_state();
        }
        let parent = if let Some(parent)=parent { parent } else {
            let host = compositor::create_host(app)?;
            let parent = host.host_handle();
            let mut inner = self.inner.lock().map_err(|e|e.to_string())?;
            if inner.compositor_epoch!=epoch {
                let _=app.run_on_main_thread(move||drop(host));
                return Err("Activación de capas cancelada".into());
            }
            inner.window=Some(host);
            parent
        };
        let geo=ScreenGeometry::current();
        // Nunca mantener el mutex de estado mientras el hilo UI crea una ventana.
        let created=compositor::create(app,parent,geo.width.max(0) as u32,geo.height.max(0) as u32);
        let mut inner=self.inner.lock().map_err(|e|e.to_string())?;
        if inner.compositor_epoch!=epoch || created.is_err() {
            let handle=app.clone();
            let host=if inner.engine.is_none() && inner.window.as_ref().is_some_and(|w|w.host_handle()==parent) { inner.window.take() } else {None};
            let _=app.run_on_main_thread(move||{compositor::destroy(&handle);drop(host);});
            return Err(created.err().unwrap_or_else(||"Activación de capas cancelada".into()));
        }
        inner.compositor_enabled=true;
        inner.compositor_app=Some(app.clone());
        Ok(self.build_snapshot(&inner))
    }

    fn close_compositor(inner: &mut InnerState) {
        inner.compositor_epoch += 1;
        if let Some(app)=inner.compositor_app.take() {
            let handle=app.clone();
            let _=app.run_on_main_thread(move||compositor::destroy(&handle));
        }
        inner.compositor_enabled=false;
    }

    pub fn stop_base(&self) -> Result<WallpaperStateSnapshot,String> {
        let mut inner=self.inner.lock().map_err(|e|e.to_string())?;
        if let Some(mut engine)=inner.engine.take() { let _=engine.stop(); }
        if !inner.compositor_enabled { inner.window=None; }
        inner.source_manager.settings_mut().is_active=false;
        inner.source_manager.save_to_disk()?;
        Ok(self.build_snapshot(&inner))
    }

    pub fn compositor_config(&self) -> Result<compositor::CompositorConfig, String> {
        let inner = self.inner.lock().map_err(|e| e.to_string())?;
        let mut config = inner.compositor_config.clone();
        config.paused = inner.is_paused;
        config.enabled = inner.compositor_enabled && inner.window.is_some();
        // Esta entrega no fabrica un nivel de audio: la capa reactiva sigue pendiente.
        config.audio_level = 0.0;
        Ok(config)
    }

    pub fn update_base_parallax(&self, position: [f32;2]) -> Result<(),String> {
        let mut inner=self.inner.lock().map_err(|e|e.to_string())?;
        if inner.is_paused { return Ok(()); }
        let config=&inner.compositor_config;
        let strength=if config.parallax.enabled && config.parallax.base { config.parallax.strength } else {0.0};
        if let Some(engine)=inner.engine.as_mut() { engine.set_parallax(position[0],position[1],strength)?; }
        Ok(())
    }

    pub fn set_compositor_config(&self, mut config: compositor::CompositorConfig) -> Result<(), String> {
        config.migrate_layers();
        config.validate()?;
        config.enabled = false;
        config.paused = false;
        config.audio_level = 0.0;
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let previous = inner.source_manager.settings().composition.clone();
        inner.source_manager.settings_mut().composition = config.clone();
        if let Err(error) = inner.source_manager.save_to_disk() {
            inner.source_manager.settings_mut().composition = previous;
            return Err(error);
        }
        if !config.parallax.enabled || !config.parallax.base {
            if let Some(engine)=inner.engine.as_mut() { let _=engine.set_parallax(0.0,0.0,0.0); }
        }
        inner.compositor_config = config;
        Ok(())
    }

    fn build_snapshot(&self, inner: &InnerState) -> WallpaperStateSnapshot {
        let current_media = if inner.compositor_enabled && inner.engine.is_none() {
            None
        } else { inner.source_manager.current_media() };
        let current_folder = current_media.as_ref().and_then(|p| {
            Path::new(p)
                .parent()
                .map(|dir| dir.to_string_lossy().to_string())
        });
        let media = inner.source_manager.get_all_media();

        WallpaperStateSnapshot {
            is_active: inner.window.is_some() && (inner.engine.is_some() || inner.compositor_enabled),
            is_paused: inner.is_paused,
            base_active: inner.engine.is_some(),
            current_media,
            current_folder,
            total_media: inner.source_manager.total_media(),
            compositor_enabled: inner.compositor_enabled,
            settings: inner.source_manager.settings().clone(),
            media,
        }
    }

    fn start_monitor_loop(&self) {
        if self.monitor_running.swap(true, Ordering::SeqCst) {
            return;
        }

        // El hilo usa una referencia débil: si el controlador desaparece, el
        // estado (con la sesión de libmpv y la ventana del escritorio) se
        // libera y el hilo termina solo en la siguiente vuelta. Así la
        // aplicación no se cierra con el motor de fondos todavía vivo.
        let inner_weak = Arc::downgrade(&self.inner);
        let running_flag = Arc::clone(&self.monitor_running);

        std::thread::spawn(move || {
            while running_flag.load(Ordering::Relaxed) {
                std::thread::sleep(std::time::Duration::from_millis(150));

                let Some(inner_arc) = inner_weak.upgrade() else {
                    break;
                };

                if let Ok(mut inner) = inner_arc.lock() {
                    if !inner.is_paused && inner.engine.is_some() {
                        // El motor decide si el medio actual ya terminó: un
                        // vídeo cuando mpv llega al final, una imagen cuando se
                        // cumple su duración en pantalla.
                        let finished = if let Some(engine) = &inner.engine {
                            engine.is_finished()
                        } else {
                            false
                        };

                        if finished {
                            let single = inner.source_manager.total_media() == 1;
                            let fit_str = match inner.source_manager.settings().fit {
                                WallpaperFit::Contain => "contain",
                                WallpaperFit::Cover => "cover",
                            };
                            let next_media = inner.source_manager.advance_next();
                            if let (Some(next_media), Some(engine)) = (next_media, &mut inner.engine) {
                                let _ = engine.load_media(&next_media, single, fit_str);
                            }
                        }
                    }
                }
            }
        });
    }
}
