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
            let _ = initializer.set_property("keep-open", "always");
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
            let _ = initializer.set_property("prefetch-playlist", "yes");
            let _ = initializer.set_property("video-sync", "audio");
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

    #[allow(dead_code)]
    pub fn is_eof(&self) -> bool {
        #[cfg(feature = "mpv")]
        {
            let eof = self.mpv.get_property::<bool>("eof-reached").unwrap_or(false);
            let idle = self.mpv.get_property::<bool>("idle-active").unwrap_or(false);
            eof || (idle && self.current_path.is_some())
        }
        #[cfg(not(feature = "mpv"))]
        false
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
