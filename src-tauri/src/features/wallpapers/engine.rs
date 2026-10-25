#[cfg(feature = "mpv")]
use libmpv2::Mpv;

pub struct VideoWallpaperEngine {
    #[cfg(feature = "mpv")]
    mpv: Mpv,
    current_path: Option<String>,
}

impl VideoWallpaperEngine {
    #[cfg(feature = "mpv")]
    pub fn new(wid: i64) -> Result<Self, String> {
        let mpv = Mpv::with_initializer(|initializer| {
            let _ = initializer.set_property("vo", "auto");
            let _ = initializer.set_property("hwdec", "auto-safe");
            // "yes" mantiene el último fotograma congelado en pantalla sin resetear el contexto de swapchain
            let _ = initializer.set_property("keep-open", "yes");
            let _ = initializer.set_property("auto-window-resize", "no");
            let _ = initializer.set_property("wid", wid);
            let _ = initializer.set_property("audio-display", "no");
            let _ = initializer.set_property("mute", "yes");
            let _ = initializer.set_property("volume", 0.0);
            let _ = initializer.set_property("osc", "no");
            let _ = initializer.set_property("osd-level", 0);
            let _ = initializer.set_property("input-default-bindings", "no");
            let _ = initializer.set_property("input-vo-keyboard", "no");
            let _ = initializer.set_property("force-window", "yes");

            // Prefetching masivo de playlist y caché de demuxer para pase fluido sin corte a negro
            let _ = initializer.set_property("prefetch-playlist", "yes");
            let _ = initializer.set_property("cache", "yes");
            let _ = initializer.set_property("demuxer-max-bytes", "400M");
            let _ = initializer.set_property("demuxer-readahead-secs", "20");
            let _ = initializer.set_property("loop-playlist", "inf");
            Ok(())
        })
        .map_err(|e| format!("Error al inicializar sesión libmpv de fondo: {e:?}"))?;

        Ok(Self {
            mpv,
            current_path: None,
        })
    }

    #[cfg(not(feature = "mpv"))]
    pub fn new(_wid: i64) -> Result<Self, String> {
        Err("Soporte libmpv no compilado en esta versión".to_string())
    }

    pub fn load_playlist(&mut self, videos: &[String], start_index: usize, fit: &str) -> Result<(), String> {
        #[cfg(feature = "mpv")]
        {
            if videos.is_empty() {
                return Ok(());
            }

            let panscan = if fit == "contain" { 0.0 } else { 1.0 };
            let _ = self.mpv.set_property("panscan", panscan);

            if videos.len() == 1 {
                let _ = self.mpv.set_property("loop-file", "inf");
                let _ = self.mpv.set_property("loop-playlist", "no");
                let path = videos[0].strip_prefix(r"\\?\").unwrap_or(&videos[0]);
                self.mpv
                    .command("loadfile", &[path, "replace"])
                    .map_err(|e| format!("Error cargando vídeo de fondo: {e:?}"))?;
                self.current_path = Some(path.to_string());
            } else {
                let _ = self.mpv.set_property("loop-file", "no");
                let _ = self.mpv.set_property("loop-playlist", "inf");

                let first = videos[0].strip_prefix(r"\\?\").unwrap_or(&videos[0]);
                self.mpv
                    .command("loadfile", &[first, "replace"])
                    .map_err(|e| format!("Error cargando primer vídeo de lista: {e:?}"))?;

                for vid in &videos[1..] {
                    let path = vid.strip_prefix(r"\\?\").unwrap_or(vid);
                    let _ = self.mpv.command("loadfile", &[path, "append"]);
                }

                if start_index > 0 && start_index < videos.len() {
                    let idx_str = start_index.to_string();
                    let _ = self.mpv.command("playlist-play-index", &[&idx_str]);
                }

                let active_path = videos.get(start_index).unwrap_or(&videos[0]);
                let clean = active_path.strip_prefix(r"\\?\").unwrap_or(active_path);
                self.current_path = Some(clean.to_string());
            }

            let _ = self.mpv.set_property("pause", false);
            Ok(())
        }
        #[cfg(not(feature = "mpv"))]
        {
            let _ = (videos, start_index, fit);
            Err("libmpv desactivado".to_string())
        }
    }

    #[allow(dead_code)]
    pub fn load_video(&mut self, raw_path: &str, loop_single: bool, fit: &str) -> Result<(), String> {
        #[cfg(feature = "mpv")]
        {
            let path = raw_path.strip_prefix(r"\\?\").unwrap_or(raw_path);
            let loop_val = if loop_single { "inf" } else { "no" };
            let _ = self.mpv.set_property("loop-file", loop_val);
            let panscan = if fit == "contain" { 0.0 } else { 1.0 };
            let _ = self.mpv.set_property("panscan", panscan);
            self.mpv
                .command("loadfile", &[path, "replace"])
                .map_err(|e| format!("Error cargando vídeo de fondo: {e:?}"))?;
            let _ = self.mpv.set_property("pause", false);
            self.current_path = Some(path.to_string());
            Ok(())
        }
        #[cfg(not(feature = "mpv"))]
        {
            let _ = (raw_path, loop_single, fit);
            Err("libmpv desactivado".to_string())
        }
    }

    pub fn next(&mut self) -> Result<(), String> {
        #[cfg(feature = "mpv")]
        {
            self.mpv
                .command("playlist-next", &[])
                .map_err(|e| format!("Error avanzando en lista mpv: {e:?}"))?;
            Ok(())
        }
        #[cfg(not(feature = "mpv"))]
        Ok(())
    }

    pub fn prev(&mut self) -> Result<(), String> {
        #[cfg(feature = "mpv")]
        {
            self.mpv
                .command("playlist-prev", &[])
                .map_err(|e| format!("Error retrocediendo en lista mpv: {e:?}"))?;
            Ok(())
        }
        #[cfg(not(feature = "mpv"))]
        Ok(())
    }

    pub fn play_index(&mut self, index: usize) -> Result<(), String> {
        #[cfg(feature = "mpv")]
        {
            let idx_str = index.to_string();
            self.mpv
                .command("playlist-play-index", &[&idx_str])
                .map_err(|e| format!("Error saltando a índice de lista {index}: {e:?}"))?;
            let _ = self.mpv.set_property("pause", false);
            Ok(())
        }
        #[cfg(not(feature = "mpv"))]
        {
            let _ = index;
            Ok(())
        }
    }

    pub fn pause(&mut self) -> Result<(), String> {
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

    pub fn stop(&mut self) -> Result<(), String> {
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
