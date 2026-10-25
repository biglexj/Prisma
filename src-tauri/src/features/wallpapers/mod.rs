pub mod engine;
pub mod sources;
pub mod window;

use engine::VideoWallpaperEngine;
use serde::{Deserialize, Serialize};
use sources::{
    clean_path_str, FolderSource, SourceManager, WallpaperFit, WallpaperMode, WallpaperSettings,
    WallpaperVideoItem,
};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use window::DesktopWallpaperWindow;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperStateSnapshot {
    pub is_active: bool,
    pub is_paused: bool,
    pub current_video: Option<String>,
    pub current_folder: Option<String>,
    pub total_videos: usize,
    pub settings: WallpaperSettings,
    pub videos: Vec<WallpaperVideoItem>,
}

struct InnerState {
    source_manager: SourceManager,
    window: Option<DesktopWallpaperWindow>,
    engine: Option<VideoWallpaperEngine>,
    is_paused: bool,
}

#[derive(Clone)]
pub struct WallpaperController {
    inner: Arc<Mutex<InnerState>>,
    monitor_running: Arc<AtomicBool>,
}

impl WallpaperController {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let source_manager = SourceManager::new(app_data_dir);
        let controller = Self {
            inner: Arc::new(Mutex::new(InnerState {
                source_manager,
                window: None,
                engine: None,
                is_paused: false,
            })),
            monitor_running: Arc::new(AtomicBool::new(false)),
        };

        controller.start_monitor_loop();
        controller
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

        let video_path = inner
            .source_manager
            .current_video()
            .ok_or_else(|| "No hay vídeos válidos en las carpetas activas de Fondos Vivos".to_string())?;

        // 1. Crear ventana nativa en el escritorio de Windows
        let win = DesktopWallpaperWindow::create()?;
        let wid = win.raw_handle();

        // 2. Inicializar motor libmpv apuntando al HWND
        let mut eng = VideoWallpaperEngine::new(wid)?;
        let single = inner.source_manager.total_videos() == 1;
        let fit_str = match inner.source_manager.settings().fit {
            WallpaperFit::Contain => "contain",
            WallpaperFit::Cover => "cover",
        };

        eng.load_video(&video_path, single, fit_str)?;

        inner.window = Some(win);
        inner.engine = Some(eng);
        inner.is_paused = false;
        inner.source_manager.settings_mut().is_active = true;
        let _ = inner.source_manager.save_to_disk();

        Ok(self.build_snapshot(&inner))
    }

    pub fn play_file(&self, path: &str) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let clean = clean_path_str(path);
        inner.source_manager.set_current_video(&clean);

        let single = inner.source_manager.total_videos() == 1;
        let fit_str = match inner.source_manager.settings().fit {
            WallpaperFit::Contain => "contain",
            WallpaperFit::Cover => "cover",
        };

        if inner.engine.is_none() || inner.window.is_none() {
            let win = DesktopWallpaperWindow::create()?;
            let wid = win.raw_handle();
            let mut eng = VideoWallpaperEngine::new(wid)?;
            eng.load_video(&clean, single, fit_str)?;
            inner.window = Some(win);
            inner.engine = Some(eng);
        } else if let Some(engine) = &mut inner.engine {
            engine.load_video(&clean, single, fit_str)?;
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
            inner.is_paused = true;
        }
        Ok(self.build_snapshot(&inner))
    }

    pub fn resume(&self) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(engine) = &mut inner.engine {
            engine.resume()?;
            inner.is_paused = false;
        }
        Ok(self.build_snapshot(&inner))
    }

    pub fn next(&self) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let next_vid = inner.source_manager.advance_next();
        let single = inner.source_manager.total_videos() == 1;
        let fit_str = match inner.source_manager.settings().fit {
            WallpaperFit::Contain => "contain",
            WallpaperFit::Cover => "cover",
        };
        let is_paused = inner.is_paused;

        if let (Some(vid), Some(engine)) = (next_vid, &mut inner.engine) {
            let _ = engine.load_video(&vid, single, fit_str);
            if is_paused {
                let _ = engine.pause();
            }
        }
        Ok(self.build_snapshot(&inner))
    }

    pub fn prev(&self) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let prev_vid = inner.source_manager.advance_prev();
        let single = inner.source_manager.total_videos() == 1;
        let fit_str = match inner.source_manager.settings().fit {
            WallpaperFit::Contain => "contain",
            WallpaperFit::Cover => "cover",
        };
        let is_paused = inner.is_paused;

        if let (Some(vid), Some(engine)) = (prev_vid, &mut inner.engine) {
            let _ = engine.load_video(&vid, single, fit_str);
            if is_paused {
                let _ = engine.pause();
            }
        }
        Ok(self.build_snapshot(&inner))
    }

    pub fn stop(&self) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(mut engine) = inner.engine.take() {
            let _ = engine.stop();
        }
        inner.window = None;
        inner.is_paused = false;
        inner.source_manager.settings_mut().is_active = false;
        let _ = inner.source_manager.save_to_disk();
        Ok(self.build_snapshot(&inner))
    }

    pub fn add_folder(&self, folder_path: &str) -> Result<FolderSource, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let curr = inner.source_manager.current_video();
        let source = inner.source_manager.add_folder(folder_path)?;
        inner.source_manager.rebuild_queue(curr.as_deref());
        Ok(source)
    }

    pub fn remove_folder(&self, id: &str) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let curr = inner.source_manager.current_video();
        inner.source_manager.remove_folder(id);
        inner.source_manager.rebuild_queue(curr.as_deref());
        Ok(self.build_snapshot(&inner))
    }

    pub fn toggle_folder(&self, id: &str, enabled: bool) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let curr = inner.source_manager.current_video();
        inner.source_manager.toggle_folder(id, enabled);
        inner.source_manager.rebuild_queue(curr.as_deref());
        Ok(self.build_snapshot(&inner))
    }

    pub fn refresh_sources(&self) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let curr = inner.source_manager.current_video();
        inner.source_manager.refresh_all_sources();
        inner.source_manager.rebuild_queue(curr.as_deref());
        Ok(self.build_snapshot(&inner))
    }

    pub fn set_mode(&self, mode: WallpaperMode) -> Result<WallpaperStateSnapshot, String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let curr = inner.source_manager.current_video();
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

    pub fn get_state(&self) -> Result<WallpaperStateSnapshot, String> {
        let inner = self.inner.lock().map_err(|e| e.to_string())?;
        Ok(self.build_snapshot(&inner))
    }

    fn build_snapshot(&self, inner: &InnerState) -> WallpaperStateSnapshot {
        let current_vid = inner.source_manager.current_video();
        let current_folder = current_vid.as_ref().and_then(|p| {
            Path::new(p)
                .parent()
                .map(|dir| dir.to_string_lossy().to_string())
        });
        let videos = inner.source_manager.get_all_videos();

        WallpaperStateSnapshot {
            is_active: inner.engine.is_some() && inner.window.is_some(),
            is_paused: inner.is_paused,
            current_video: current_vid,
            current_folder,
            total_videos: inner.source_manager.total_videos(),
            settings: inner.source_manager.settings().clone(),
            videos,
        }
    }

    fn start_monitor_loop(&self) {
        if self.monitor_running.swap(true, Ordering::SeqCst) {
            return;
        }

        let inner_clone = Arc::clone(&self.inner);
        let running_flag = Arc::clone(&self.monitor_running);

        std::thread::spawn(move || {
            while running_flag.load(Ordering::Relaxed) {
                std::thread::sleep(std::time::Duration::from_millis(150));

                if let Ok(mut inner) = inner_clone.lock() {
                    if !inner.is_paused && inner.engine.is_some() {
                        let is_eof = if let Some(engine) = &inner.engine {
                            engine.is_eof()
                        } else {
                            false
                        };

                        if is_eof {
                            let single = inner.source_manager.total_videos() == 1;
                            let fit_str = match inner.source_manager.settings().fit {
                                WallpaperFit::Contain => "contain",
                                WallpaperFit::Cover => "cover",
                            };
                            let next_vid = inner.source_manager.advance_next();
                            if let (Some(next_vid), Some(engine)) = (next_vid, &mut inner.engine) {
                                let _ = engine.load_video(&next_vid, single, fit_str);
                            }
                        }
                    }
                }
            }
        });
    }
}
