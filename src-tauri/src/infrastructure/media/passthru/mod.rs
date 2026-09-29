pub mod dsp_engine;
pub mod multi_output;
#[cfg(target_os = "windows")]
pub mod render_slot;

#[cfg(target_os = "windows")]
pub mod wasapi_passthru;

use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use dsp_engine::DspParameters;

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioEndpointInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub is_virtual: bool,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalPassthruStatus {
    pub is_running: bool,
    pub has_signal: bool,
    pub volume: f32,
    pub active_capture_device: Option<String>,
    pub active_render_device: Option<String>,
    pub sample_rate: u32,
    pub latency_ms: f32,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiOutputDevice {
    pub id: String,
    pub gain: f32,
    #[serde(default)]
    pub delay_ms: u32,
}

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiOutputConfig {
    pub enabled: bool,
    pub devices: Vec<MultiOutputDevice>,
}

pub struct PassthruService {
    route_restore: Mutex<Option<(String, String)>>,
    route_system_default: AtomicBool,
    multi_output: Mutex<MultiOutputConfig>,
    pub current_params: Arc<Mutex<DspParameters>>,
    #[cfg(target_os = "windows")]
    inner: Arc<Mutex<Option<wasapi_passthru::WasapiBridge>>>,
}

impl PassthruService {
    pub fn new() -> Self {
        Self {
            route_restore: Mutex::new(None),
            route_system_default: AtomicBool::new(true),
            multi_output: Mutex::new(MultiOutputConfig::default()),
            current_params: Arc::new(Mutex::new(DspParameters::default())),
            #[cfg(target_os = "windows")]
            inner: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_dsp_params(&self, params: DspParameters) {
        if let Ok(mut guard) = self.current_params.lock() {
            *guard = params.clone();
        }
        #[cfg(target_os = "windows")]
        {
            if let Ok(guard) = self.inner.lock() {
                if let Some(bridge) = guard.as_ref() {
                    bridge.update_params(params);
                }
            }
        }
    }

    #[allow(dead_code)]
    pub fn set_params(&self, params: DspParameters) {
        self.set_dsp_params(params);
    }

    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            if let Ok(guard) = self.inner.lock() {
                if let Some(bridge) = guard.as_ref() {
                    bridge.set_volume(volume);
                    return Ok(());
                }
            }
        }
        Ok(())
    }

    pub fn get_multi_output(&self) -> MultiOutputConfig {
        self.multi_output.lock().map_or_else(|_| MultiOutputConfig::default(), |config| config.clone())
    }

    pub fn set_multi_output(&self, devices: Vec<MultiOutputDevice>) -> Result<MultiOutputConfig, String> {
        let endpoints = Self::list_endpoints()?;
        let mut seen = std::collections::HashSet::new();
        for device in &devices {
            if !device.gain.is_finite() || !(0.0..=1.0).contains(&device.gain) {
                return Err("La ganancia de cada salida debe estar entre 0 y 1".to_string());
            }
            if device.delay_ms > 2_000 {
                return Err("El retardo de cada salida debe estar entre 0 y 2000 ms".to_string());
            }
            if !seen.insert(device.id.as_str()) || !endpoints.iter().any(|ep| ep.id == device.id && !ep.is_virtual) {
                return Err(format!("Salida duplicada, virtual o desconectada: {}", device.id));
            }
        }
        let mut config = self.multi_output.lock().map_err(|e| e.to_string())?;
        config.devices = devices;
        if config.devices.len() < 2 { config.enabled = false; }
        let result = config.clone();
        drop(config);
        if !result.enabled && !self.route_system_default.load(Ordering::Relaxed) {
            self.stop()?;
        } else {
            self.refresh_running_bridge()?;
        }
        Ok(result)
    }

    pub fn toggle_multi_output(&self, enabled: bool) -> Result<MultiOutputConfig, String> {
        let mut config = self.multi_output.lock().map_err(|e| e.to_string())?;
        if enabled && config.devices.len() < 2 {
            return Err("Selecciona al menos dos salidas físicas".to_string());
        }
        config.enabled = enabled;
        let result = config.clone();
        drop(config);
        if !enabled && !self.route_system_default.load(Ordering::Relaxed) {
            self.stop()?;
        } else {
            self.refresh_running_bridge()?;
        }
        Ok(result)
    }

    pub fn ensure_multi_output_running(&self) -> Result<(), String> {
        if self.is_running() { return Ok(()); }
        let config = self.get_multi_output();
        if !config.enabled { return Ok(()); }
        let primary = config.devices.first().ok_or("No hay una salida principal seleccionada")?.id.clone();
        self.start_with_routing(None, Some(primary), false)
    }

    fn refresh_running_bridge(&self) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            let current = self.inner.lock().map_err(|e| e.to_string())?
                .as_ref().and_then(|bridge| bridge.is_running().then(|| (bridge.capture_id.clone(), bridge.render_id.clone())));
            if let Some((capture, render)) = current {
                self.start_with_routing(capture, render, self.route_system_default.load(Ordering::Relaxed))?;
            }
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub fn is_running(&self) -> bool {
        #[cfg(target_os = "windows")]
        {
            if let Ok(guard) = self.inner.lock() {
                if let Some(bridge) = guard.as_ref() {
                    return bridge.is_running();
                }
            }
        }
        false
    }

    pub fn get_status(&self) -> GlobalPassthruStatus {
        #[cfg(target_os = "windows")]
        {
            if let Ok(guard) = self.inner.lock() {
                if let Some(bridge) = guard.as_ref() {
                    return bridge.get_status();
                }
            }
        }
        GlobalPassthruStatus {
            is_running: false,
            has_signal: false,
            volume: 1.0,
            active_capture_device: None,
            active_render_device: None,
            sample_rate: 48000,
            latency_ms: 0.0,
        }
    }

    pub fn start(&self, capture_device_id: Option<String>, render_device_id: Option<String>) -> Result<(), String> {
        self.start_with_routing(capture_device_id, render_device_id, true)
    }

    pub fn start_with_routing(&self, capture_device_id: Option<String>, render_device_id: Option<String>, route_system_default: bool) -> Result<(), String> {
        self.route_system_default.store(route_system_default, Ordering::Relaxed);
        #[cfg(target_os = "windows")]
        {
            let endpoints = Self::list_endpoints()?;
            if !route_system_default {
                let mut route = self.route_restore.lock().map_err(|e| e.to_string())?;
                if let Some((capture, restore)) = route.as_ref() {
                    if endpoints.iter().any(|ep| ep.id == *capture && ep.is_default) {
                        if let Some(output) = endpoints.iter().find(|ep| ep.id == *restore && !ep.is_virtual) {
                            Self::set_system_default_endpoint(&output.id)?;
                        }
                    }
                }
                *route = None;
            }
            let capture_device_id = Some(endpoints.iter().find(|ep| ep.is_virtual && capture_device_id.as_ref().map_or(true, |id| id == &ep.id))
                .or_else(|| endpoints.iter().find(|ep| ep.is_virtual))
                .ok_or("No se encontró el controlador virtual de Prisma. El modo local sigue disponible.")?.id.clone());
            let primary_id = render_device_id.clone().or_else(|| endpoints.iter().find(|ep| ep.is_default && !ep.is_virtual)
                .or_else(|| endpoints.iter().find(|ep| !ep.is_virtual)).map(|ep| ep.id.clone()))
                .ok_or("No hay una salida física disponible")?;
            let config = self.get_multi_output();
            let mut outputs = vec![MultiOutputDevice { id: primary_id.clone(), gain: 1.0, delay_ms: 0 }];
            if config.enabled {
                for output in config.devices {
                    if output.id == primary_id { outputs[0] = output; }
                    else { outputs.push(output); }
                }
            }
            let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
            if let Some(ref bridge) = *guard {
                if bridge.is_running()
                    && bridge.matches_devices(capture_device_id.as_deref(), render_device_id.as_deref(), &outputs)
                {
                    // Si ya está ejecutándose con exactamente estos endpoints,
                    // actualizamos parámetros en caliente sin detener el hilo ni pausar el audio.
                    let initial_params = self.current_params.lock().map_err(|e| e.to_string())?.clone();
                    bridge.update_params(initial_params);
                    bridge.update_output_gains(outputs);
                    if route_system_default && bridge.get_status().is_running {
                        let capture = capture_device_id.as_ref().unwrap();
                        let restore = endpoints.iter().find(|ep| ep.is_default && !ep.is_virtual)
                            .map(|ep| ep.id.clone()).or_else(|| render_device_id.clone());
                        if let Some(restore) = restore {
                            let mut route = self.route_restore.lock().map_err(|e| e.to_string())?;
                            if !endpoints.iter().any(|ep| ep.id == *capture && ep.is_default) {
                                Self::set_system_default_endpoint(capture)?;
                            }
                            let original = route.as_ref().map(|(_, output)| output.clone()).unwrap_or(restore);
                            *route = Some((capture.clone(), original));
                        }
                    }
                    return Ok(());
                }
            }
            if let Some(mut old) = guard.take() {
                old.stop();
            }
            let initial_params = self.current_params.lock().map_err(|e| e.to_string())?.clone();
            let bridge = wasapi_passthru::WasapiBridge::start(capture_device_id, render_device_id, outputs, initial_params)?;
            *guard = Some(bridge);
            return Ok(());
        }
        #[cfg(not(target_os = "windows"))]
        Err("El Modo DSP Global de Sistema solo está soportado en Windows".to_string())
    }

    pub fn stop(&self) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
            if let Some(mut bridge) = guard.take() { bridge.stop(); }
            let mut route = self.route_restore.lock().map_err(|e| e.to_string())?;
            if let Some((capture, restore)) = route.as_ref() {
                let endpoints = Self::list_endpoints()?;
                if endpoints.iter().any(|ep| ep.id == *capture && ep.is_default) {
                    if let Some(output) = endpoints.iter().find(|ep| ep.id == *restore && !ep.is_virtual).or_else(|| endpoints.iter().find(|ep| !ep.is_virtual)) {
                        Self::set_system_default_endpoint(&output.id)?;
                        *route = None;
                    }
                } else { *route = None; }
            }
            return Ok(());
        }
        #[cfg(not(target_os = "windows"))]
        Ok(())
    }

    pub fn list_endpoints() -> Result<Vec<AudioEndpointInfo>, String> {
        #[cfg(target_os = "windows")]
        {
            return wasapi_passthru::list_audio_endpoints();
        }
        #[cfg(not(target_os = "windows"))]
        Ok(Vec::new())
    }

    pub fn set_system_default_endpoint(device_id: &str) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            wasapi_passthru::set_system_default_audio_endpoint(device_id)
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = device_id;
            Ok(())
        }
    }
}

