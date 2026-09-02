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
                                    if !desc.is_empty() && !desc.starts_with('{') {
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

    // 1. Ganancia Maestro + Refuerzo Dinámico (Upward Loudness Booster)
    // Se calcula la ganancia total combinada en dB y se convierte a factor lineal
    let p_db = config.preamp_db.clamp(-12.0, 12.0);
    let dyn_val = config.effects.dynamic_boost.clamp(0.0, 10.0);
    // Base de ganancia +2.5 dB hasta +6.5 dB al activar el DSP (salto de +30% percibido)
    let dyn_boost_db = 2.0 + (dyn_val * 0.45);
    let total_gain_db = p_db + dyn_boost_db;
    let total_linear = 10f64.powf(total_gain_db / 20.0);

    filters.push(format!("volume={:.3}", total_linear));

    // 2. 10 Bandas de Ecualizador Paramétrico (Q = 1.527) con frecuencia libre
    for band in &config.bands {
        if band.gain_db.abs() > 0.05 {
            filters.push(format!(
                "equalizer=f={:.1}:t=q:w=1.527:g={:.2}",
                band.freq, band.gain_db
            ));
        }
    }

    // 3. Refuerzo de Graves (Bass Boost / HyperBass) - Pegada profunda y contundente
    if config.effects.bass_boost > 0.01 {
        let bass_val = config.effects.bass_boost.clamp(0.0, 10.0);
        let lowshelf_gain = bass_val * 0.95;
        let sub_gain = bass_val * 0.60;
        filters.push(format!("lowshelf=f=120:t=q:w=0.7:g={:.2}", lowshelf_gain));
        filters.push(format!("equalizer=f=60:t=q:w=1.2:g={:.2}", sub_gain));
    }

    // 4. Claridad (Clarity / Harmonic Brilliance) - Nitidez cristalina y presencia vocal
    if config.effects.clarity > 0.01 {
        let clarity_val = config.effects.clarity.clamp(0.0, 10.0);
        let highshelf_gain = clarity_val * 0.90;
        let presence_gain = clarity_val * 0.60;
        filters.push(format!("highshelf=f=6500:t=q:w=0.65:g={:.2}", highshelf_gain));
        filters.push(format!("equalizer=f=3200:t=q:w=1.2:g={:.2}", presence_gain));
    }

    // 5. Sonido Envolvente (Surround Sound) - Expansión estéreo panorámica
    if config.effects.surround > 0.01 {
        let surround_val = config.effects.surround.clamp(0.0, 10.0);
        let stereo_coeff = 1.0 + (surround_val * 0.06);
        filters.push(format!("extrastereo=m={:.2}", stereo_coeff));
    }

    // 6. Ambiente (Ambience) - Espacialidad acústica natural
    if config.effects.ambience > 0.01 {
        let amb_val = config.effects.ambience.clamp(0.0, 10.0);
        let delay_ms = 8.0 + (amb_val * 1.5);
        let feedback_val = (0.05 + (amb_val * 0.02)).clamp(0.0, 0.25);
        let crossfeed_val = (0.05 + (amb_val * 0.02)).clamp(0.0, 0.25);
        filters.push(format!(
            "stereowiden=delay={:.1}:feedback={:.2}:crossfeed={:.2}:drymix=0.94",
            delay_ms, feedback_val, crossfeed_val
        ));
    }

    // 7. Limitador suave transparente con asc=0 (JAMÁS reduce el volumen general de la pista, solo picos)
    filters.push("alimiter=limit=0.99:attack=5:release=50:asc=0".to_string());

    format!("lavfi=[{}]", filters.join(","))
}

fn debug_error(error: impl std::fmt::Debug) -> String {
    format!("Error de libmpv: {error:?}")
}
