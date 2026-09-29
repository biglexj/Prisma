use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemVolume {
    pub volume: f32,
    pub is_muted: bool,
}

#[derive(Clone, Copy, Debug)]
pub enum VolumeKey {
    Up,
    Down,
    Mute,
}

pub fn next_volume(current: SystemVolume, key: VolumeKey) -> SystemVolume {
    match key {
        VolumeKey::Up => SystemVolume {
            volume: (current.volume + 2.0).min(100.0),
            is_muted: false,
        },
        VolumeKey::Down => SystemVolume {
            volume: (current.volume - 2.0).max(0.0),
            is_muted: current.is_muted,
        },
        VolumeKey::Mute => SystemVolume { is_muted: !current.is_muted, ..current },
    }
}

#[cfg(windows)]
pub mod native {
    use super::*;
    use windows::core::GUID;
    use windows::Win32::Media::Audio::Endpoints::{IAudioEndpointVolume, IAudioMeterInformation};
    use windows::Win32::Media::Audio::{eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};

    // Distinguishes our writes from external changes in the endpoint callback.
    pub const VOLUME_CONTEXT: GUID = GUID::from_u128(0x7c5ce68c_5629_4443_8a27_f6ab459d0c40);

    pub fn default_endpoint() -> windows::core::Result<(String, IAudioEndpointVolume)> {
        unsafe {
            let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
            let raw_id = device.GetId()?;
            let id = raw_id.to_string();
            windows::Win32::System::Com::CoTaskMemFree(Some(raw_id.0.cast()));
            Ok((id?, device.Activate(CLSCTX_ALL, None)?))
        }
    }

    pub fn read() -> Result<SystemVolume, String> {
        let _com = crate::infrastructure::windows_com::ComApartment::multithreaded()
            .map_err(|e| e.to_string())?;
        let (_, endpoint) = default_endpoint().map_err(|e| e.to_string())?;
        unsafe {
            Ok(SystemVolume {
                volume: (endpoint.GetMasterVolumeLevelScalar().map_err(|e| e.to_string())? * 100.0).round(),
                is_muted: endpoint.GetMute().map_err(|e| e.to_string())?.as_bool(),
            })
        }
    }

    pub fn write(volume: f32, muted: Option<bool>) -> Result<SystemVolume, String> {
        if !volume.is_finite() { return Err("Volumen no válido".into()); }
        let _com = crate::infrastructure::windows_com::ComApartment::multithreaded()
            .map_err(|e| e.to_string())?;
        let (_, endpoint) = default_endpoint().map_err(|e| e.to_string())?;
        unsafe {
            endpoint.SetMasterVolumeLevelScalar((volume / 100.0).clamp(0.0, 1.0), &VOLUME_CONTEXT)
                .map_err(|e| e.to_string())?;
            if let Some(muted) = muted {
                endpoint.SetMute(muted, &VOLUME_CONTEXT).map_err(|e| e.to_string())?;
            }
            Ok(SystemVolume {
                volume: (endpoint.GetMasterVolumeLevelScalar().map_err(|e| e.to_string())? * 100.0).round(),
                is_muted: endpoint.GetMute().map_err(|e| e.to_string())?.as_bool(),
            })
        }
    }

    pub fn peak() -> Result<f32, String> {
        let _com = crate::infrastructure::windows_com::ComApartment::multithreaded()
            .map_err(|e| e.to_string())?;
        unsafe {
            let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                .map_err(|e| e.to_string())?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole).map_err(|e| e.to_string())?;
            let meter: IAudioMeterInformation = device.Activate(CLSCTX_ALL, None).map_err(|e| e.to_string())?;
            meter.GetPeakValue().map_err(|e| e.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sequential_keys_advance_once_and_clamp() {
        let start = SystemVolume { volume: 96.0, is_muted: false };
        let first = next_volume(start, VolumeKey::Up);
        let second = next_volume(first, VolumeKey::Up);
        assert_eq!(first.volume, 98.0);
        assert_eq!(next_volume(second, VolumeKey::Up).volume, 100.0);
        assert_eq!(next_volume(SystemVolume { volume: 1.0, ..start }, VolumeKey::Down).volume, 0.0);
    }

    #[test]
    fn mute_retains_master_level_and_up_unmutes() {
        let start = SystemVolume { volume: 54.0, is_muted: false };
        let muted = next_volume(start, VolumeKey::Mute);
        assert!(muted.is_muted);
        assert_eq!(muted.volume, 54.0);
        assert!(!next_volume(muted, VolumeKey::Mute).is_muted);
        assert!(!next_volume(muted, VolumeKey::Up).is_muted);
        assert!(next_volume(muted, VolumeKey::Down).is_muted);
    }
}
