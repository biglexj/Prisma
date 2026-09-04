pub mod dsp_engine;

#[cfg(target_os = "windows")]
pub mod wasapi_passthru;

use std::sync::{Arc, Mutex};
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

pub struct PassthruService {
    pub current_params: Arc<Mutex<DspParameters>>,
    #[cfg(target_os = "windows")]
    inner: Arc<Mutex<Option<wasapi_passthru::WasapiBridge>>>,
}

impl PassthruService {
    pub fn new() -> Self {
        Self {
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
        #[cfg(target_os = "windows")]
        {
            let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
            if let Some(ref bridge) = *guard {
                if bridge.is_running()
                    && bridge.matches_devices(capture_device_id.as_deref(), render_device_id.as_deref())
                {
                    // Si ya está ejecutándose con exactamente estos endpoints,
                    // actualizamos parámetros en caliente sin detener el hilo ni pausar el audio.
                    let initial_params = self.current_params.lock().map_err(|e| e.to_string())?.clone();
                    bridge.update_params(initial_params);
                    return Ok(());
                }
            }
            if let Some(mut old) = guard.take() {
                old.stop();
            }
            let initial_params = self.current_params.lock().map_err(|e| e.to_string())?.clone();
            let bridge = wasapi_passthru::WasapiBridge::start(capture_device_id, render_device_id, initial_params)?;
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
            if let Some(mut bridge) = guard.take() {
                bridge.stop();
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

