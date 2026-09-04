use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use windows::core::PWSTR;
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    eConsole, eMultimedia, eRender, IAudioCaptureClient, IAudioClient, IAudioRenderClient,
    IMMDevice, IMMDeviceEnumerator, MMDeviceEnumerator, AUDCLNT_BUFFERFLAGS_SILENT,
    AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, DEVICE_STATE_ACTIVE,
    WAVEFORMATEX,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL,
    COINIT_MULTITHREADED,
};
use windows::Win32::System::Threading::{
    GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_TIME_CRITICAL,
};
use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;

use super::dsp_engine::{DspParameters, DspProcessor};
use super::{AudioEndpointInfo, GlobalPassthruStatus};

/// Representa el puente de procesamiento WASAPI en tiempo real entre la captura y la salida.
pub struct WasapiBridge {
    pub capture_id: Option<String>,
    pub render_id: Option<String>,
    running: Arc<AtomicBool>,
    worker_handle: Option<JoinHandle<()>>,
    params_shared: Arc<Mutex<DspParameters>>,
    status: Arc<Mutex<GlobalPassthruStatus>>,
    volume_req: Arc<AtomicI32>,
}

impl WasapiBridge {
    #[allow(dead_code)]
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn matches_devices(&self, req_capture: Option<&str>, req_render: Option<&str>) -> bool {
        let same_capture = match (&self.capture_id, req_capture) {
            (None, None) => true,
            (Some(a), Some(b)) => a == b,
            _ => false,
        };
        let same_render = match (&self.render_id, req_render) {
            (None, None) => true,
            (Some(a), Some(b)) => a == b,
            _ => false,
        };
        same_capture && same_render
    }

    pub fn get_status(&self) -> GlobalPassthruStatus {
        self.status.lock().map_or(
            GlobalPassthruStatus {
                is_running: false,
                has_signal: false,
                volume: 1.0,
                active_capture_device: None,
                active_render_device: None,
                sample_rate: 48000,
                latency_ms: 0.0,
            },
            |s| s.clone(),
        )
    }

    pub fn set_volume(&self, volume: f32) {
        let val = (volume.clamp(0.0, 1.0) * 10000.0) as i32;
        self.volume_req.store(val, Ordering::Relaxed);
    }

    pub fn update_params(&self, params: DspParameters) {
        if let Ok(mut guard) = self.params_shared.lock() {
            *guard = params;
        }
    }

    pub fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.worker_handle.take() {
            let _ = handle.join();
        }
        if let Ok(mut st) = self.status.lock() {
            st.is_running = false;
        }
    }

    pub fn start(
        capture_id: Option<String>,
        render_id: Option<String>,
        initial_params: DspParameters,
    ) -> Result<Self, String> {
        let (capture_device_name, render_device_name) = unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                .map_err(|e| format!("Error al enumerar dispositivos de audio: {}", e))?;

            // 1. Resolver dispositivo de captura
            let capture_device = if let Some(ref id) = capture_id {
                let wide_id: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();
                enumerator.GetDevice(PWSTR(wide_id.as_ptr() as *mut _)).ok()
            } else {
                find_virtual_device(&enumerator)
                    .or_else(|| enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia).ok())
            };

            let capture_name = capture_device.as_ref().and_then(|d| {
                d.OpenPropertyStore(windows::Win32::System::Com::STGM_READ)
                    .ok()
                    .and_then(|s| get_device_friendly_name(&s).ok())
            }).unwrap_or_else(|| "Captura de Sistema (Loopback)".to_string());

            let capture_id_str = capture_device.as_ref().and_then(|d| {
                d.GetId().ok().and_then(|p| {
                    let s = p.to_string().ok();
                    CoTaskMemFree(Some(p.as_ptr() as *const _));
                    s
                })
            });

            // 2. Resolver dispositivo de renderizado físico
            let render_device = if let Some(ref id) = render_id {
                let wide_id: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();
                enumerator.GetDevice(PWSTR(wide_id.as_ptr() as *mut _)).ok()
            } else {
                find_real_render_device(&enumerator, capture_id_str.as_deref())
                    .or_else(|| enumerator.GetDefaultAudioEndpoint(eRender, eConsole).ok())
            };

            let render_name = render_device.as_ref().and_then(|d| {
                d.OpenPropertyStore(windows::Win32::System::Com::STGM_READ)
                    .ok()
                    .and_then(|s| get_device_friendly_name(&s).ok())
            }).unwrap_or_else(|| "Altavoces / Auriculares".to_string());

            CoUninitialize();
            (capture_name, render_name)
        };

        let running = Arc::new(AtomicBool::new(true));
        let params_shared = Arc::new(Mutex::new(initial_params));
        let volume_req = Arc::new(AtomicI32::new(-1));
        let status = Arc::new(Mutex::new(GlobalPassthruStatus {
            is_running: true,
            has_signal: false,
            volume: 1.0,
            active_capture_device: Some(capture_device_name),
            active_render_device: Some(render_device_name),
            sample_rate: 48000,
            latency_ms: 10.0,
        }));

        let thread_running = running.clone();
        let thread_params = params_shared.clone();
        let thread_status = status.clone();
        let thread_volume_req = volume_req.clone();

        let loop_capture_id = capture_id.clone();
        let loop_render_id = render_id.clone();

        let worker_handle = thread::Builder::new()
            .name("prisma-wasapi-passthru".to_string())
            .spawn(move || {
                unsafe {
                    let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
                    let _ = SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
                }

                run_passthru_loop(
                    loop_capture_id,
                    loop_render_id,
                    thread_running,
                    thread_params,
                    thread_status.clone(),
                    thread_volume_req,
                );

                if let Ok(mut st) = thread_status.lock() {
                    st.is_running = false;
                }

                unsafe {
                    CoUninitialize();
                }
            })
            .map_err(|e| format!("No se pudo iniciar el hilo de passthru: {}", e))?;

        Ok(Self {
            capture_id,
            render_id,
            running,
            worker_handle: Some(worker_handle),
            params_shared,
            status,
            volume_req,
        })
    }
}

/// Bucle principal de captura, procesamiento DSP y renderizado.
fn run_passthru_loop(
    capture_id: Option<String>,
    render_id: Option<String>,
    running: Arc<AtomicBool>,
    params_shared: Arc<Mutex<DspParameters>>,
    status: Arc<Mutex<GlobalPassthruStatus>>,
    volume_req: Arc<AtomicI32>,
) {
    unsafe {
        let enumerator: IMMDeviceEnumerator = match CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) {
            Ok(e) => e,
            Err(err) => {
                eprintln!("[Prisma Passthru] CoCreateInstance fallo: {:?}", err);
                return;
            }
        };

        // 1. Obtener dispositivo de captura (Loopback)
        let capture_device: IMMDevice = if let Some(ref id) = capture_id {
            let wide_id: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();
            match enumerator.GetDevice(PWSTR(wide_id.as_ptr() as *mut _)) {
                Ok(d) => d,
                Err(_) => match enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) {
                    Ok(d) => d,
                    Err(e) => {
                        eprintln!("[Prisma Passthru] No se pudo obtener endpoint de captura: {:?}", e);
                        return;
                    }
                },
            }
        } else {
            // Intentar detectar si existe un dispositivo virtual (ej: FxSound Audio Enhancer o VB-Cable)
            match find_virtual_device(&enumerator) {
                Some(d) => d,
                None => match enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) {
                    Ok(d) => d,
                    Err(e) => {
                        eprintln!("[Prisma Passthru] No se pudo obtener endpoint por defecto: {:?}", e);
                        return;
                    }
                },
            }
        };

        let capture_id_str = capture_device.GetId().ok().and_then(|p| {
            let s = p.to_string().ok();
            CoTaskMemFree(Some(p.as_ptr() as *const _));
            s
        });

        // 2. Obtener dispositivo de renderizado físico (Altavoces o Auriculares reales)
        let render_device: IMMDevice = if let Some(ref id) = render_id {
            let wide_id: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();
            match enumerator.GetDevice(PWSTR(wide_id.as_ptr() as *mut _)) {
                Ok(d) => {
                    let is_prisma_capture = capture_id_str.as_deref().map_or(false, |cid| cid == id)
                        || d.OpenPropertyStore(windows::Win32::System::Com::STGM_READ)
                            .ok()
                            .and_then(|s| get_device_friendly_name(&s).ok())
                            .map_or(false, |name| {
                                let lower = name.to_lowercase();
                                lower.contains("prisma audio") || lower.contains("fxsound")
                            });
                    if is_prisma_capture {
                        eprintln!("[Prisma Passthru] Dispositivo solicitado es el canal de captura de Prisma ({}); redirigiendo a salida real.", id);
                        find_real_render_device(&enumerator, capture_id_str.as_deref())
                            .unwrap_or(d)
                    } else {
                        d
                    }
                }
                Err(_) => match find_real_render_device(&enumerator, capture_id_str.as_deref()) {
                    Some(d) => d,
                    None => match enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
                        Ok(d) => d,
                        Err(e) => {
                            eprintln!("[Prisma Passthru] No se encontro endpoint de salida: {:?}", e);
                            return;
                        }
                    },
                },
            }
        } else {
            match find_real_render_device(&enumerator, capture_id_str.as_deref()) {
                Some(d) => d,
                None => match enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
                    Ok(d) => d,
                    Err(e) => {
                        eprintln!("[Prisma Passthru] No se encontro endpoint de render: {:?}", e);
                        return;
                    }
                },
            }
        };

        let capture_name = capture_device.OpenPropertyStore(windows::Win32::System::Com::STGM_READ)
            .ok()
            .and_then(|s| get_device_friendly_name(&s).ok())
            .unwrap_or_else(|| "Captura".to_string());
        let render_name = render_device.OpenPropertyStore(windows::Win32::System::Com::STGM_READ)
            .ok()
            .and_then(|s| get_device_friendly_name(&s).ok())
            .unwrap_or_else(|| "Salida".to_string());
        eprintln!("[Prisma Passthru] 🎙️ Entrada / Captura: {}", capture_name);
        eprintln!("[Prisma Passthru] 🔊 Salida / Auriculares: {}", render_name);

        // 3. Inicializar Audio Client de captura en modo Loopback
        let capture_client: IAudioClient = match capture_device.Activate(CLSCTX_ALL, None) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[Prisma Passthru] Activate capture falló: {:?}", e);
                return;
            }
        };

        let pwfx_capture: *mut WAVEFORMATEX = match capture_client.GetMixFormat() {
            Ok(p) if !p.is_null() => p,
            _ => {
                eprintln!("[Prisma Passthru] GetMixFormat capture falló");
                return;
            }
        };
        let wfx = *pwfx_capture;
        let sample_rate = wfx.nSamplesPerSec as f32;
        let channels = wfx.nChannels as usize;

        // Búfer solicitado de 40 ms para máxima estabilidad (evita underruns en Bluetooth / USB / Alto TS415)
        let requested_duration = 400_000i64; // 40 ms en unidades de 100ns (constante FxSound)
        let init_capture = capture_client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK,
            requested_duration,
            0,
            pwfx_capture,
            None,
        );
        CoTaskMemFree(Some(pwfx_capture as *const _));

        if let Err(e) = init_capture {
            eprintln!("[Prisma Passthru] Initialize capture falló: {:?}", e);
            return;
        }

        let capture_service: IAudioCaptureClient = match capture_client.GetService() {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[Prisma Passthru] GetService capture falló: {:?}", e);
                return;
            }
        };

        // 4. Inicializar Audio Client de Renderizado físico
        let render_client: IAudioClient = match render_device.Activate(CLSCTX_ALL, None) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[Prisma Passthru] Activate render falló: {:?}", e);
                return;
            }
        };

        let pwfx_render: *mut WAVEFORMATEX = match render_client.GetMixFormat() {
            Ok(p) if !p.is_null() => p,
            _ => {
                eprintln!("[Prisma Passthru] GetMixFormat render falló");
                return;
            }
        };
        let render_wfx = *pwfx_render;
        let render_bits = render_wfx.wBitsPerSample;
        let render_channels = render_wfx.nChannels as usize;
        let render_sample_rate = render_wfx.nSamplesPerSec as f32;

        let is_render_float = if render_wfx.wFormatTag == 3 /* WAVE_FORMAT_IEEE_FLOAT */ {
            true
        } else if render_wfx.wFormatTag == 0xFFFE /* WAVE_FORMAT_EXTENSIBLE */ {
            let ext_ptr = pwfx_render as *const u8;
            let subformat_first_u32 = *(ext_ptr.add(24) as *const u32);
            subformat_first_u32 == 3 // KSDATAFORMAT_SUBTYPE_IEEE_FLOAT
        } else {
            render_bits == 32
        };

        let init_render = render_client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            0,
            requested_duration,
            0,
            pwfx_render,
            None,
        );
        CoTaskMemFree(Some(pwfx_render as *const _));

        if let Err(e) = init_render {
            eprintln!("[Prisma Passthru] Initialize render falló: {:?}", e);
            return;
        }

        let render_buf_frames = render_client.GetBufferSize().unwrap_or(0);

        let render_service: IAudioRenderClient = match render_client.GetService() {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[Prisma Passthru] GetService render falló: {:?}", e);
                return;
            }
        };

        // 5. Iniciar ambos streams
        if let Err(e) = capture_client.Start() {
            eprintln!("[Prisma Passthru] capture_client.Start() falló: {:?}", e);
            return;
        }
        if let Err(e) = render_client.Start() {
            eprintln!("[Prisma Passthru] render_client.Start() falló: {:?}", e);
            let _ = capture_client.Stop();
            return;
        }

        eprintln!("[Prisma Passthru] ¡Conectado y transmitiendo en tiempo real!");

        if let Ok(mut st) = status.lock() {
            st.sample_rate = wfx.nSamplesPerSec;
            st.latency_ms = if sample_rate > 0.0 {
                (render_buf_frames as f32 / sample_rate) * 1000.0
            } else {
                10.0
            };
        }

        let capture_vol: Option<IAudioEndpointVolume> = capture_device.Activate(CLSCTX_ALL, None).ok();
        let render_vol: Option<IAudioEndpointVolume> = render_device.Activate(CLSCTX_ALL, None).ok();

        let mut last_capture_vol = -1.0f32;
        let mut last_capture_mute = false;
        let mut vol_check_counter = 0u32;

        if let Some(ref cvol) = capture_vol {
            if let Ok(init_vol) = cvol.GetMasterVolumeLevelScalar() {
                last_capture_vol = init_vol;
                if let Ok(mut st) = status.lock() {
                    st.volume = init_vol;
                }
                if let Some(ref rvol) = render_vol {
                    let _ = rvol.SetMasterVolumeLevelScalar(init_vol, std::ptr::null());
                }
            }
            if let Ok(init_mute) = cvol.GetMute() {
                last_capture_mute = init_mute.as_bool();
                if let Some(ref rvol) = render_vol {
                    let _ = rvol.SetMute(init_mute, std::ptr::null());
                }
            }
        }

        let mut dsp = DspProcessor::new(sample_rate);
        let mut local_interleaved: Vec<f32> = Vec::with_capacity(4096);
        let mut resampled_interleaved: Vec<f32> = Vec::with_capacity(4096);
        let mut had_signal = false;

        // 6. Bucle de procesamiento en tiempo real
        while running.load(Ordering::Relaxed) {
            // Actualizar parámetros si hubo cambios desde el frontend
            if let Ok(guard) = params_shared.try_lock() {
                dsp.update_parameters(guard.clone());
            }

            // Atender peticiones de volumen desde la UI de Prisma
            let req = volume_req.swap(-1, Ordering::Relaxed);
            if req >= 0 {
                let target_vol = (req as f32) / 10000.0;
                last_capture_vol = target_vol;
                if let Some(ref cvol) = capture_vol {
                    let _ = cvol.SetMasterVolumeLevelScalar(target_vol, std::ptr::null());
                }
                if let Some(ref rvol) = render_vol {
                    let _ = rvol.SetMasterVolumeLevelScalar(target_vol, std::ptr::null());
                }
                if let Ok(mut st) = status.lock() {
                    st.volume = target_vol;
                }
            }

            // Sincronizar volumen y mute originados en Windows (teclado multimedia o slider de Windows)
            vol_check_counter += 1;
            if vol_check_counter >= 8 {
                vol_check_counter = 0;
                if let Some(ref cvol) = capture_vol {
                    if let Ok(current_vol) = cvol.GetMasterVolumeLevelScalar() {
                        if (current_vol - last_capture_vol).abs() > 0.005 {
                            last_capture_vol = current_vol;
                            if let Some(ref rvol) = render_vol {
                                let _ = rvol.SetMasterVolumeLevelScalar(current_vol, std::ptr::null());
                            }
                            if let Ok(mut st) = status.lock() {
                                st.volume = current_vol;
                            }
                        }
                    }
                    if let Ok(is_muted) = cvol.GetMute() {
                        let muted = is_muted.as_bool();
                        if muted != last_capture_mute {
                            last_capture_mute = muted;
                            if let Some(ref rvol) = render_vol {
                                let _ = rvol.SetMute(is_muted, std::ptr::null());
                            }
                        }
                    }
                }
            }

            let packet_length = match capture_service.GetNextPacketSize() {
                Ok(s) => s,
                Err(_) => {
                    thread::sleep(Duration::from_millis(2));
                    continue;
                }
            };

            if packet_length == 0 {
                thread::sleep(Duration::from_millis(2));
                continue;
            }

            let mut p_data: *mut u8 = std::ptr::null_mut();
            let mut num_frames_read: u32 = 0;
            let mut flags: u32 = 0;

            if capture_service
                .GetBuffer(&mut p_data, &mut num_frames_read, &mut flags, None, None)
                .is_ok()
            {
                if num_frames_read > 0 && !p_data.is_null() {
                    let total_samples = (num_frames_read as usize) * channels;
                    local_interleaved.clear();

                    let is_silent = (flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32) != 0;
                    if is_silent {
                        local_interleaved.resize(total_samples, 0.0);
                    } else if wfx.wBitsPerSample == 32 {
                        let float_slice = std::slice::from_raw_parts(p_data as *const f32, total_samples);
                        local_interleaved.extend_from_slice(float_slice);
                    } else if wfx.wBitsPerSample == 16 {
                        let i16_slice = std::slice::from_raw_parts(p_data as *const i16, total_samples);
                        for &s in i16_slice {
                            local_interleaved.push(s as f32 / 32768.0);
                        }
                    }

                    if !is_silent {
                        if !had_signal {
                            had_signal = true;
                            if let Ok(mut st) = status.lock() {
                                st.has_signal = true;
                            }
                            eprintln!("[Prisma Passthru] 🎵 ¡Recibiendo y procesando audio en vivo desde {}!", capture_name);
                        }
                    }

                    // Procesar audio a través de la suite DSP de Prisma
                    if channels == 2 {
                        dsp.process_interleaved(&mut local_interleaved);
                    }

                    // Remuestreo en caso de diferencia entre frecuencia de captura y salida (ej. 44.1k vs 48k)
                    let (render_frames_src, render_data_src) = if (sample_rate - render_sample_rate).abs() > 1.0 && num_frames_read > 1 {
                        let ratio = render_sample_rate / sample_rate;
                        let target_frames = ((num_frames_read as f32) * ratio).round() as usize;
                        resampled_interleaved.clear();
                        resampled_interleaved.reserve(target_frames * channels);
                        for j in 0..target_frames {
                            let pos = (j as f32) / ratio;
                            let idx0 = (pos.floor() as usize).min((num_frames_read - 1) as usize);
                            let idx1 = (idx0 + 1).min((num_frames_read - 1) as usize);
                            let frac = pos - (idx0 as f32);
                            for ch in 0..channels {
                                let s0 = local_interleaved[idx0 * channels + ch];
                                let s1 = local_interleaved[idx1 * channels + ch];
                                resampled_interleaved.push(s0 * (1.0 - frac) + s1 * frac);
                            }
                        }
                        (target_frames as u32, &resampled_interleaved[..])
                    } else {
                        (num_frames_read, &local_interleaved[..])
                    };

                    // Enviar al dispositivo de renderizado físico
                    if let Ok(padding) = render_client.GetCurrentPadding() {
                        let available_frames = render_buf_frames.saturating_sub(padding);
                        let frames_to_write = render_frames_src.min(available_frames);

                        if frames_to_write > 0 {
                            if let Ok(p_render_data) = render_service.GetBuffer(frames_to_write) {
                                if !p_render_data.is_null() {
                                    let copy_frames = frames_to_write as usize;
                                    if is_render_float {
                                        let render_float = std::slice::from_raw_parts_mut(
                                            p_render_data as *mut f32,
                                            copy_frames * render_channels,
                                        );
                                        for f in 0..copy_frames {
                                            for ch in 0..render_channels {
                                                let src_idx = f * channels + (ch % channels);
                                                render_float[f * render_channels + ch] = render_data_src[src_idx];
                                            }
                                        }
                                    } else if render_bits == 16 {
                                        let render_i16 = std::slice::from_raw_parts_mut(
                                            p_render_data as *mut i16,
                                            copy_frames * render_channels,
                                        );
                                        for f in 0..copy_frames {
                                            for ch in 0..render_channels {
                                                let src_idx = f * channels + (ch % channels);
                                                let s = render_data_src[src_idx].clamp(-1.0, 1.0);
                                                render_i16[f * render_channels + ch] = (s * 32767.0) as i16;
                                            }
                                        }
                                    } else if render_bits == 24 {
                                        let render_u8 = std::slice::from_raw_parts_mut(
                                            p_render_data as *mut u8,
                                            copy_frames * render_channels * 3,
                                        );
                                        for f in 0..copy_frames {
                                            for ch in 0..render_channels {
                                                let src_idx = f * channels + (ch % channels);
                                                let s = render_data_src[src_idx].clamp(-1.0, 1.0);
                                                let val = (s * 8388607.0) as i32;
                                                let b = val.to_le_bytes();
                                                let offset = (f * render_channels + ch) * 3;
                                                render_u8[offset] = b[0];
                                                render_u8[offset + 1] = b[1];
                                                render_u8[offset + 2] = b[2];
                                            }
                                        }
                                    } else if render_bits == 32 {
                                        let render_i32 = std::slice::from_raw_parts_mut(
                                            p_render_data as *mut i32,
                                            copy_frames * render_channels,
                                        );
                                        for f in 0..copy_frames {
                                            for ch in 0..render_channels {
                                                let src_idx = f * channels + (ch % channels);
                                                let s = render_data_src[src_idx].clamp(-1.0, 1.0);
                                                render_i32[f * render_channels + ch] = (s * 2147483647.0) as i32;
                                            }
                                        }
                                    }
                                    let _ = render_service.ReleaseBuffer(frames_to_write, 0);
                                }
                            }
                        }
                    }
                }
                let _ = capture_service.ReleaseBuffer(num_frames_read);
            }
        }

        let _ = capture_client.Stop();
        let _ = render_client.Stop();
    }
}

pub fn is_prisma_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("fxsound") || lower.contains("prisma")
}

pub fn is_virtual_name(name: &str) -> bool {
    is_prisma_name(name)
}

/// Detecta si hay un dispositivo virtual de captura de Prisma instalado en Windows.
unsafe fn find_virtual_device(enumerator: &IMMDeviceEnumerator) -> Option<IMMDevice> {
    unsafe {
        let collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE).ok()?;
        let count = collection.GetCount().ok()?;

        // Buscar específicamente el endpoint de Prisma Audio Enhancer
        for i in 0..count {
            if let Ok(device) = collection.Item(i) {
                if let Ok(store) = device.OpenPropertyStore(windows::Win32::System::Com::STGM_READ) {
                    if let Ok(name) = get_device_friendly_name(&store) {
                        if is_prisma_name(&name) {
                            return Some(device);
                        }
                    }
                }
            }
        }
        None
    }
}

/// Busca un endpoint de salida de renderizado (auriculares, altavoces, MIXLINE, etc.), excluyendo el canal de captura de Prisma.
unsafe fn find_real_render_device(
    enumerator: &IMMDeviceEnumerator,
    exclude_id: Option<&str>,
) -> Option<IMMDevice> {
    unsafe {
        // 1. Primero intentar el endpoint por defecto de Windows si no está excluido y no es Prisma
        if let Ok(def) = enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
            if let Ok(pwstr) = def.GetId() {
                let id = pwstr.to_string().unwrap_or_default();
                CoTaskMemFree(Some(pwstr.as_ptr() as *const _));
                let is_excluded = exclude_id.map_or(false, |ex| ex == id);
                if !is_excluded {
                    if let Ok(store) = def.OpenPropertyStore(windows::Win32::System::Com::STGM_READ) {
                        if let Ok(name) = get_device_friendly_name(&store) {
                            if !is_prisma_name(&name) {
                                return Some(def);
                            }
                        }
                    }
                }
            }
        }

        // 2. Si el default es Prisma o está excluido, buscar el primer dispositivo que no sea Prisma
        let collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE).ok()?;
        let count = collection.GetCount().ok()?;

        for i in 0..count {
            if let Ok(device) = collection.Item(i) {
                if let Ok(pwstr) = device.GetId() {
                    let id = pwstr.to_string().unwrap_or_default();
                    CoTaskMemFree(Some(pwstr.as_ptr() as *const _));
                    if exclude_id.map_or(false, |ex| ex == id) {
                        continue;
                    }
                    if let Ok(store) = device.OpenPropertyStore(windows::Win32::System::Com::STGM_READ) {
                        if let Ok(name) = get_device_friendly_name(&store) {
                            if !is_prisma_name(&name) {
                                return Some(device);
                            }
                        }
                    }
                }
            }
        }
        None
    }
}

/// Obtiene el nombre descriptivo de un endpoint de audio.
unsafe fn get_device_friendly_name(store: &IPropertyStore) -> Result<String, ()> {
    use windows::Win32::UI::Shell::PropertiesSystem::{PSFormatForDisplayAlloc, PROPDESC_FORMAT_FLAGS, PROPERTYKEY};
    unsafe {
        // PKEY_Device_FriendlyName: {a45c254e-df1c-4efd-8020-67d146a850e0}, 14
        let pkey = PROPERTYKEY {
            fmtid: windows::core::GUID::from_u128(0xa45c254e_df1c_4efd_8020_67d146a850e0),
            pid: 14,
        };
        let val = store.GetValue(&pkey).map_err(|_| ())?;
        let pwstr = PSFormatForDisplayAlloc(&pkey, &val, PROPDESC_FORMAT_FLAGS(0)).map_err(|_| ())?;
        let name = pwstr.to_string().map_err(|_| ());
        CoTaskMemFree(Some(pwstr.as_ptr() as *const _));
        name
    }
}

/// Enumera todos los endpoints de audio activos en Windows.
pub fn list_audio_endpoints() -> Result<Vec<AudioEndpointInfo>, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("CoCreateInstance falló: {}", e))?;

        let default_device = enumerator
            .GetDefaultAudioEndpoint(eRender, eConsole)
            .ok();
        let default_id: Option<String> = default_device.and_then(|d| {
            d.GetId().ok().and_then(|p| {
                let s = p.to_string().ok();
                CoTaskMemFree(Some(p.as_ptr() as *const _));
                s
            })
        });

        let collection = enumerator
            .EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
            .map_err(|e| format!("EnumAudioEndpoints falló: {}", e))?;
        let count = collection
            .GetCount()
            .map_err(|e| format!("GetCount falló: {}", e))?;

        let mut results = Vec::new();

        for i in 0..count {
            if let Ok(device) = collection.Item(i) {
                let id_pwstr = match device.GetId() {
                    Ok(p) => p,
                    Err(_) => continue,
                };
                let id = id_pwstr.to_string().unwrap_or_default();
                CoTaskMemFree(Some(id_pwstr.as_ptr() as *const _));

                let name = match device.OpenPropertyStore(windows::Win32::System::Com::STGM_READ) {
                    Ok(store) => get_device_friendly_name(&store).unwrap_or_else(|_| "Dispositivo de audio".to_string()),
                    Err(_) => "Dispositivo de audio".to_string(),
                };

                let is_virtual = is_virtual_name(&name);

                let is_default = default_id.as_ref().map_or(false, |def| def == &id);

                let display_name = if name.to_lowercase().contains("fxsound") || name.to_lowercase().contains("prisma") {
                    "Prisma Audio Enhancer".to_string()
                } else {
                    name
                };

                results.push(AudioEndpointInfo {
                    id,
                    name: display_name,
                    is_default,
                    is_virtual,
                });
            }
        }

        CoUninitialize();
        Ok(results)
    }
}

/// Cambia el dispositivo de salida de audio predeterminado en todo Windows usando IPolicyConfig.
pub fn set_system_default_audio_endpoint(device_id: &str) -> Result<(), String> {
    use std::ffi::c_void;
    use windows::core::{GUID, HRESULT, PCWSTR};
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};

    #[link(name = "ole32")]
    unsafe extern "system" {
        #[link_name = "CoCreateInstance"]
        fn CoCreateInstanceRaw(
            rclsid: *const GUID,
            punkouter: *mut c_void,
            dwclscontext: u32,
            riid: *const GUID,
            ppv: *mut *mut c_void,
        ) -> HRESULT;
    }

    #[repr(C)]
    struct IPolicyConfigVtbl {
        query_interface: unsafe extern "system" fn(*mut c_void, *const GUID, *mut *mut c_void) -> HRESULT,
        add_ref: unsafe extern "system" fn(*mut c_void) -> u32,
        release: unsafe extern "system" fn(*mut c_void) -> u32,
        _reserved: [unsafe extern "system" fn(); 10],
        set_default_endpoint: unsafe extern "system" fn(*mut c_void, PCWSTR, u32) -> HRESULT,
    }

    #[repr(C)]
    struct IPolicyConfig {
        lp_vtbl: *const IPolicyConfigVtbl,
    }

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let clsid = GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);
        // Win 10/11 IID
        let iid_win10 = GUID::from_u128(0xf8679f50_850a_41cf_9c72_430f290290c8);
        // Win 7/8 IID fallback
        let iid_win7 = GUID::from_u128(0x294f91d3_176b_415a_8bc0_03d563ecfbab);

        let mut policy_config: *mut c_void = std::ptr::null_mut();
        let hr = CoCreateInstanceRaw(
            &clsid,
            std::ptr::null_mut(),
            0x17, // CLSCTX_ALL
            &iid_win10,
            &mut policy_config,
        );

        let policy_config = if hr.is_ok() && !policy_config.is_null() {
            policy_config
        } else {
            let mut fallback: *mut c_void = std::ptr::null_mut();
            let hr2 = CoCreateInstanceRaw(
                &clsid,
                std::ptr::null_mut(),
                0x17,
                &iid_win7,
                &mut fallback,
            );
            if hr2.is_err() || fallback.is_null() {
                CoUninitialize();
                return Err("No se pudo inicializar la interfaz de configuración de audio de Windows".to_string());
            }
            fallback
        };

        let wide_id: Vec<u16> = device_id.encode_utf16().chain(std::iter::once(0)).collect();
        let pcwstr = PCWSTR(wide_id.as_ptr());

        let obj = policy_config as *mut IPolicyConfig;
        let vtbl = &*(*obj).lp_vtbl;

        // 0 = eConsole, 1 = eMultimedia, 2 = eCommunications
        let _ = (vtbl.set_default_endpoint)(policy_config, pcwstr, 0);
        let _ = (vtbl.set_default_endpoint)(policy_config, pcwstr, 1);
        let _ = (vtbl.set_default_endpoint)(policy_config, pcwstr, 2);

        let _ = (vtbl.release)(policy_config);
        CoUninitialize();

        Ok(())
    }
}
