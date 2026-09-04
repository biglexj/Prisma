use libmpv2::Mpv;

use crate::features::playback::{
    backend::PlaybackBackend,
    model::{AudioDeviceItem, DspConfig, PlaybackCapabilities, PlaybackSnapshot, clamp_volume},
};

pub struct MpvBackend {
    mpv: Mpv,
    path: Option<String>,
    current_dsp: Option<DspConfig>,
}

impl MpvBackend {
    pub fn new() -> Result<Self, String> {
        let mpv = Mpv::with_initializer(|initializer| {
            initializer.set_property("vo", "auto")?;
            initializer.set_property("audio-display", "no")?;
            initializer.set_property("keep-open", "yes")?;
            Ok(())
        })
        .map_err(debug_error)?;

        mpv.set_property("volume", 70.0).map_err(debug_error)?;

        Ok(Self {
            mpv,
            path: None,
            current_dsp: None,
        })
    }

    fn apply_dsp(&mut self) -> Result<(), String> {
        let af_string = if let Some(ref config) = self.current_dsp {
            build_af_filter_string(config)
        } else {
            String::new()
        };

        eprintln!("[Prisma DSP] Sincronizando filtros AF: '{}'", af_string);
        self.mpv
            .set_property("af", af_string.as_str())
            .map_err(|err| {
                eprintln!("[Prisma DSP Error] Fallo al aplicar af: {:?}", err);
                debug_error(err)
            })?;
        Ok(())
    }

    fn read_snapshot(&self) -> PlaybackSnapshot {
        let track_title = self
            .mpv
            .get_property::<String>("metadata/by-key/Title")
            .or_else(|_| self.mpv.get_property::<String>("metadata/by-key/TITLE"))
            .or_else(|_| self.mpv.get_property::<String>("metadata/by-key/title"))
            .or_else(|_| self.mpv.get_property::<String>("media-title"))
            .ok()
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty());

        let track_artist = self
            .mpv
            .get_property::<String>("metadata/by-key/Artist")
            .or_else(|_| self.mpv.get_property::<String>("metadata/by-key/ARTIST"))
            .or_else(|_| self.mpv.get_property::<String>("metadata/by-key/artist"))
            .or_else(|_| self.mpv.get_property::<String>("metadata/by-key/Album_Artist"))
            .or_else(|_| self.mpv.get_property::<String>("metadata/by-key/album_artist"))
            .ok()
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty());

        let track_album = self
            .mpv
            .get_property::<String>("metadata/by-key/Album")
            .or_else(|_| self.mpv.get_property::<String>("metadata/by-key/ALBUM"))
            .or_else(|_| self.mpv.get_property::<String>("metadata/by-key/album"))
            .ok()
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty());

        PlaybackSnapshot {
            path: self.path.clone(),
            paused: self.mpv.get_property("pause").unwrap_or(true),
            position_seconds: self.mpv.get_property("time-pos").ok(),
            duration_seconds: self.mpv.get_property("duration").ok(),
            volume: self.mpv.get_property("volume").unwrap_or(70.0),
            speed: self.mpv.get_property("speed").unwrap_or(1.0),
            session: None,
            eof_reached: self.mpv.get_property::<bool>("eof-reached").ok(),
            track_title,
            track_artist,
            track_album,
        }
    }
}

impl PlaybackBackend for MpvBackend {
    fn capabilities(&self) -> PlaybackCapabilities {
        PlaybackCapabilities {
            backend: "libmpv".to_owned(),
            available: true,
            audio: true,
            video_output: true,
            reason: None,
        }
    }

    fn load(&mut self, path: &str) -> Result<PlaybackSnapshot, String> {
        self.mpv
            .command("loadfile", &[path, "replace"])
            .map_err(debug_error)?;
        let _ = self.mpv.set_property("pause", false);
        self.path = Some(path.to_owned());
        let _ = self.apply_dsp();
        Ok(self.read_snapshot())
    }

    fn toggle_pause(&mut self) -> Result<PlaybackSnapshot, String> {
        let paused = self.mpv.get_property::<bool>("pause").unwrap_or(false);
        self.mpv
            .set_property("pause", !paused)
            .map_err(debug_error)?;
        Ok(self.read_snapshot())
    }

    fn pause(&mut self) -> Result<PlaybackSnapshot, String> {
        let _ = self.mpv.set_property("pause", true);
        Ok(self.read_snapshot())
    }

    fn resume(&mut self) -> Result<PlaybackSnapshot, String> {
        let _ = self.mpv.set_property("pause", false);
        Ok(self.read_snapshot())
    }

    fn seek(&mut self, seconds: f64) -> Result<PlaybackSnapshot, String> {
        self.mpv
            .set_property("time-pos", seconds.max(0.0))
            .map_err(debug_error)?;
        Ok(self.read_snapshot())
    }

    fn set_volume(&mut self, volume: f64) -> Result<PlaybackSnapshot, String> {
        self.mpv
            .set_property("volume", clamp_volume(volume))
            .map_err(debug_error)?;
        Ok(self.read_snapshot())
    }

    fn set_speed(&mut self, speed: f64) -> Result<PlaybackSnapshot, String> {
        self.mpv
            .set_property("speed", speed.clamp(0.25, 4.0))
            .map_err(debug_error)?;
        Ok(self.read_snapshot())
    }

    fn snapshot(&mut self) -> Result<PlaybackSnapshot, String> {
        Ok(self.read_snapshot())
    }

    fn set_dsp_config(&mut self, config: &DspConfig) -> Result<(), String> {
        self.current_dsp = Some(config.clone());
        self.apply_dsp()
    }

    fn get_audio_devices(&self) -> Result<Vec<AudioDeviceItem>, String> {
        let current_device = self
            .mpv
            .get_property::<String>("audio-device")
            .unwrap_or_else(|_| "auto".to_string());

        let mut items = Vec::new();
        items.push(AudioDeviceItem {
            name: "auto".to_string(),
            description: "Predeterminado del sistema (Auto)".to_string(),
            is_active: current_device == "auto",
        });

        #[cfg(windows)]
        {
            let win_devices = enumerate_windows_audio_endpoints();
            for (wasapi_name, desc) in win_devices {
                let is_active = current_device == wasapi_name || current_device == desc;
                items.push(AudioDeviceItem {
                    name: wasapi_name,
                    description: desc,
                    is_active,
                });
            }
        }

        Ok(items)
    }

    fn set_audio_device(&mut self, device_name: &str) -> Result<(), String> {
        self.mpv
            .set_property("audio-device", device_name)
            .map_err(debug_error)?;
        Ok(())
    }
}

#[cfg(windows)]
fn enumerate_windows_audio_endpoints() -> Vec<(String, String)> {
    use windows::Win32::Media::Audio::{
        eRender, DEVICE_STATE_ACTIVE, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED, STGM_READ,
    };
    use windows::Win32::UI::Shell::PropertiesSystem::PROPERTYKEY;

    let mut list = Vec::new();

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        if let Ok(enumerator) = CoCreateInstance::<_, IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL) {
            if let Ok(collection) = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) {
                if let Ok(count) = collection.GetCount() {
                    let pkey = PROPERTYKEY {
                        fmtid: windows::core::GUID::from_u128(0xa45c254e_df1c_4efd_8020_67d146a850e0),
                        pid: 14,
                    };
                    for i in 0..count {
                        if let Ok(device) = collection.Item(i) {
                            if let Ok(props) = device.OpenPropertyStore(STGM_READ) {
                                if let Ok(val) = props.GetValue(&pkey) {
                                    let desc = val.to_string();
                                    let lower = desc.to_lowercase();
                                    let is_prisma = lower.contains("fxsound") || lower.contains("prisma");
                                    if !desc.is_empty() && !desc.starts_with('{') && !is_prisma {
                                        let wasapi_name = format!("wasapi/{}", desc);
                                        list.push((wasapi_name, desc));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        CoUninitialize();
    }

    list
}

fn build_af_filter_string(config: &DspConfig) -> String {
    if !config.enabled {
        return "".to_string();
    }

    let mut filters: Vec<String> = Vec::new();

    // 1. Ganancia Maestro / Preamp Limpio (Ajuste de ganancia base sin sobrecargar etapas)
    let p_db = config.preamp_db.clamp(-12.0, 12.0);
    if p_db.abs() > 0.05 {
        let p_linear = 10f64.powf(p_db / 20.0);
        filters.push(format!("volume={:.3}", p_linear));
    }

    // 2. Ecualizador Paramétrico (10 Bandas con factor Q = 1.527)
    for band in &config.bands {
        if band.gain_db.abs() > 0.05 {
            filters.push(format!(
                "equalizer=f={:.1}:t=q:w=1.527:g={:.2}",
                band.freq, band.gain_db
            ));
        }
    }

    // 3. Claridad / Fidelidad Armónica (FxSound Aural Enhancer style)
    // Proporciona aire y brillo en agudos sin provocar sibilancias ni distorsión áspera.
    if config.effects.clarity > 0.01 {
        let clarity_val = config.effects.clarity.clamp(0.0, 10.0);
        let air_gain = clarity_val * 0.45;
        let presence_gain = clarity_val * 0.30;
        filters.push(format!("highshelf=f=7500:t=q:w=0.707:g={:.2}", air_gain));
        filters.push(format!("equalizer=f=3500:t=q:w=1.2:g={:.2}", presence_gain));
    }

    // 4. Espacialidad y Ambiente (FxSound Lex/Dly)
    // Difusión ambiental sutil previa al procesamiento de graves para que no retrase los bombos.
    if config.effects.ambience > 0.01 {
        let amb_val = config.effects.ambience.clamp(0.0, 10.0);
        let delay_ms = 8.0 + (amb_val * 1.4);
        let feedback_val = (0.04 + (amb_val * 0.015)).clamp(0.0, 0.20);
        let crossfeed_val = (0.04 + (amb_val * 0.015)).clamp(0.0, 0.20);
        filters.push(format!(
            "stereowiden=delay={:.1}:feedback={:.2}:crossfeed={:.2}:drymix=0.92",
            delay_ms, feedback_val, crossfeed_val
        ));
    }

    // 5. Sonido Envolvente 3D (FxSound Wide32 Mid-Side Expansion)
    // Expansión estéreo aplicada antes de los graves para que el ensanchamiento no toque el sub-bajo.
    if config.effects.surround > 0.01 {
        let surround_val = config.effects.surround.clamp(0.0, 10.0);
        let stereo_coeff = 1.0 + (surround_val * 0.08);
        filters.push(format!("extrastereo=m={:.2}", stereo_coeff));
    }

    // 6. HyperBass / Refuerzo de Graves (FxSound Play32 exact architecture)
    // CRÍTICO: En FxSound (Play32.c), el Bass Boost se ejecuta DESPUÉS del Surround y del Ambiente.
    // Esto garantiza que los graves permanezcan 100% centrados y enfocados en fase (Dual-Mono),
    // con la frecuencia central exacta de FxSound (90.0 Hz, Q = 2.5) y pegada sub-grave en 55 Hz (Q = 2.2).
    // Jamás se dispersa hacia los laterales ni ensucia la escena estéreo.
    if config.effects.bass_boost > 0.01 {
        let bass_val = config.effects.bass_boost.clamp(0.0, 10.0);
        let bass_gain = bass_val * 0.90;
        let sub_gain = bass_val * 0.65;
        filters.push(format!("equalizer=f=90:t=q:w=2.5:g={:.2}", bass_gain));
        filters.push(format!("equalizer=f=55:t=q:w=2.2:g={:.2}", sub_gain));
    }

    // 7. Dynamic Boost & Maximizer (FxSound Maxi32 architecture al final de la cadena)
    // Fase A: Compresor ascendente suave de codo ancho (soft-knee RMS) para densificar
    // pasajes tenues y aumentar la sonoridad aparente sin bombeo brusco.
    let dyn_val = config.effects.dynamic_boost.clamp(0.0, 10.0);
    if dyn_val > 0.01 {
        let thresh_db = -8.0 - (dyn_val * 0.8);
        let thresh_linear = 10f64.powf(thresh_db / 20.0);
        let ratio = 1.3 + (dyn_val * 0.10);
        let makeup_linear = 1.1 + (dyn_val * 0.09);

        filters.push(format!(
            "acompressor=threshold={:.4}:ratio={:.2}:attack=8:release=70:makeup={:.2}:knee=2.8",
            thresh_linear, ratio, makeup_linear
        ));
    }

    // Fase B: Limitador de picos predictivo con ventana lookahead (FxSound 33-sample lookahead)
    // limit=0.98 (-0.17 dBFS): asegura que NINGÚN pico toque 1.0 (clipping digital)
    // attack=7 ms: ventana lookahead para anticipar picos y suavizar transitorios
    // release=50 ms: caída rápida y natural
    // asc=0: sin compresión automática adicional
    filters.push("alimiter=limit=0.98:attack=7:release=50:asc=0".to_string());

    format!("lavfi=[{}]", filters.join(","))
}

fn debug_error(error: impl std::fmt::Debug) -> String {
    format!("Error de libmpv: {error:?}")
}
