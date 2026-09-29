use super::{AudioEndpointInfo, MultiOutputConfig, MultiOutputDevice};
use std::collections::HashSet;

/// Keep preferences for absent devices; only known virtual endpoints are excluded.
pub fn remember_devices(devices: Vec<MultiOutputDevice>, endpoints: &[AudioEndpointInfo]) -> Result<Vec<MultiOutputDevice>, String> {
    let mut seen = HashSet::new();
    let mut remembered = Vec::new();
    for device in devices {
        if device.id.trim().is_empty() { continue; }
        if !device.gain.is_finite() || !(0.0..=1.0).contains(&device.gain) {
            return Err("La ganancia de cada salida debe estar entre 0 y 1".into());
        }
        if device.delay_ms > 2_000 {
            return Err("El retardo de cada salida debe estar entre 0 y 2000 ms".into());
        }
        if seen.insert(device.id.clone()) && !endpoints.iter().any(|ep| ep.id == device.id && ep.is_virtual) {
            remembered.push(device);
        }
    }
    Ok(remembered)
}

/// Resolve a usable primary and render only connected devices, without changing preferences.
pub fn available_devices(endpoints: &[AudioEndpointInfo], primary: Option<&str>, config: &MultiOutputConfig) -> Vec<MultiOutputDevice> {
    let physical: Vec<_> = endpoints.iter().filter(|ep| !ep.is_virtual).collect();
    let Some(primary) = physical.iter().find(|ep| Some(ep.id.as_str()) == primary)
        .or_else(|| physical.iter().find(|ep| ep.is_default)).or_else(|| physical.first()) else { return Vec::new(); };
    let mut outputs = vec![MultiOutputDevice { id: primary.id.clone(), gain: 1.0, delay_ms: 0 }];
    if config.enabled {
        for device in &config.devices {
            if device.id == primary.id { outputs[0] = device.clone(); }
            else if physical.iter().any(|ep| ep.id == device.id) && !outputs.iter().any(|output| output.id == device.id) {
                outputs.push(device.clone());
            }
        }
    }
    outputs
}

#[cfg(test)]
mod tests {
    use super::*;
    fn ep(id: &str, default: bool, virtual_device: bool) -> AudioEndpointInfo {
        AudioEndpointInfo { id: id.into(), name: id.into(), is_default: default, is_virtual: virtual_device }
    }
    fn output(id: &str) -> MultiOutputDevice { MultiOutputDevice { id: id.into(), gain: 0.4, delay_ms: 170 } }
    #[test]
    fn disconnect_keeps_preferences_and_reconnect_restores_gain_and_delay() {
        let config = MultiOutputConfig { enabled: true, devices: remember_devices(vec![output("usb"), output("bt"), output("bt"), output("virtual")], &[ep("usb", true, false), ep("virtual", false, true)]).unwrap() };
        assert_eq!(config.devices.len(), 2);
        let connected = available_devices(&[ep("usb", true, false)], Some("usb"), &config);
        assert_eq!(connected.len(), 1);
        let restored = available_devices(&[ep("usb", true, false), ep("bt", false, false)], Some("usb"), &config);
        assert_eq!(restored.len(), 2);
        assert_eq!(restored[1].delay_ms, 170);
        assert_eq!(restored[1].gain, 0.4);
    }
    #[test]
    fn missing_primary_falls_back_and_empty_hardware_does_not_erase_intent() {
        let config = MultiOutputConfig { enabled: true, devices: vec![output("unplugged")] };
        let outputs = available_devices(&[ep("virtual", true, true), ep("real", false, false)], Some("unplugged"), &config);
        assert_eq!(outputs[0].id, "real");
        assert!(available_devices(&[], None, &config).is_empty());
        assert!(config.enabled);
        assert_eq!(config.devices[0].delay_ms, 170);
    }
    #[test]
    fn disabled_duplication_uses_only_current_primary() {
        let config = MultiOutputConfig { enabled: false, devices: vec![output("old"), output("main")] };
        let outputs = available_devices(&[ep("old", true, false), ep("main", false, false)], Some("main"), &config);
        assert_eq!(outputs.len(), 1);
        assert_eq!(outputs[0].id, "main");
        assert_eq!(outputs[0].gain, 1.0);
    }
}
