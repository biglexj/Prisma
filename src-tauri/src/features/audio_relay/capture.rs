use std::sync::{Arc, Mutex, OnceLock, mpsc::SyncSender};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use crate::infrastructure::media::passthru::PassthruService;

pub struct AudioBlock {
    pub rate: u32,
    pub channels: usize,
    pub samples: Vec<f32>,
    pub captured: Instant,
}
static TAP: OnceLock<Mutex<Option<SyncSender<AudioBlock>>>> = OnceLock::new();
pub fn set_tap(sender: Option<SyncSender<AudioBlock>>) {
    if let Ok(mut tap) = TAP.get_or_init(|| Mutex::new(None)).lock() { *tap = sender; }
}
/// Called after the existing DSP. Never wait for TLS or a full queue on the audio thread.
pub fn publish(rate: u32, channels: usize, samples: &[f32]) {
    if let Ok(tap) = TAP.get_or_init(|| Mutex::new(None)).try_lock() {
        if let Some(sender) = tap.as_ref() {
            let _ = sender.try_send(AudioBlock { rate, channels, samples: samples.to_vec(), captured: Instant::now() });
        }
    }
}

#[cfg(windows)]
pub fn standalone(running: Arc<AtomicBool>, passthru: Arc<PassthruService>, endpoint: Option<String>, error: Arc<Mutex<Option<String>>>) {
    // If the physical bridge is active it publishes the processed signal. Otherwise capture without
    // constructing any render slot: a network speaker must not require physical PC speakers.
    while running.load(Ordering::Relaxed) {
        if passthru.get_status().is_running { *error.lock().unwrap() = None; std::thread::sleep(Duration::from_millis(100)); continue; }
        if unsafe { capture_endpoint(&running, &passthru, endpoint.as_deref(), &error) }.is_err() {
            *error.lock().unwrap() = Some("No se pudo capturar esa salida. Revisa el dispositivo de audio de Windows.".into());
        }
        std::thread::sleep(Duration::from_millis(300));
    }
}

#[cfg(windows)]
unsafe fn capture_endpoint(running: &AtomicBool, passthru: &PassthruService, endpoint: Option<&str>, error: &Mutex<Option<String>>) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Media::Audio::*;
    use windows::Win32::System::Com::*;
    let _com = crate::infrastructure::windows_com::ComApartment::multithreaded().map_err(|e| e.to_string())?;
    let enumerator: IMMDeviceEnumerator = unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }.map_err(|e| e.to_string())?;
    let device = if let Some(id) = endpoint {
        let wide = id.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
        unsafe { enumerator.GetDevice(PCWSTR(wide.as_ptr())) }
    } else { unsafe { enumerator.GetDefaultAudioEndpoint(eRender, eConsole) } }.map_err(|e| e.to_string())?;
    let client: IAudioClient = unsafe { device.Activate(CLSCTX_ALL, None) }.map_err(|e| e.to_string())?;
    let format = unsafe { client.GetMixFormat() }.map_err(|e| e.to_string())?;
    if format.is_null() { return Err("No capture format".into()); }
    let wfx = unsafe { *format };
    let floating = wfx.wFormatTag == 3 || (wfx.wFormatTag == 0xfffe && wfx.cbSize >= 22 && unsafe { std::ptr::read_unaligned(format.cast::<u8>().add(24).cast::<u32>()) } == 3);
    let channels = wfx.nChannels as usize;
    let sample_rate = wfx.nSamplesPerSec;
    let supported = (1..=8).contains(&channels) && (8000..=192000).contains(&sample_rate)
        && ((floating && wfx.wBitsPerSample == 32) || (!floating && matches!(wfx.wBitsPerSample, 16 | 24 | 32)));
    let initialized = if supported { unsafe { client.Initialize(AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, 200_000, 0, format, None) } }
        else { Err(windows::core::Error::from_win32()) };
    unsafe { CoTaskMemFree(Some(format.cast())) };
    initialized.map_err(|e| e.to_string())?;
    let capture: IAudioCaptureClient = unsafe { client.GetService() }.map_err(|e| e.to_string())?;
    unsafe { client.Start() }.map_err(|e| e.to_string())?;
    *error.lock().unwrap() = None;
    let original_id = unsafe { device.GetId() }.map_err(|e| e.to_string())?;
    let original_id_text = unsafe { original_id.to_string() }.map_err(|e| e.to_string());
    unsafe { CoTaskMemFree(Some(original_id.0.cast())) };
    let original_id_text = original_id_text?;
    let mut last_endpoint_check = Instant::now();
    let result = (|| -> Result<(), String> {
        while running.load(Ordering::Relaxed) && !passthru.get_status().is_running {
            // Poll the identity, not the capture client: reopening an unchanged endpoint causes gaps.
            if endpoint.is_none() && last_endpoint_check.elapsed() > Duration::from_secs(1) {
                let current = unsafe { enumerator.GetDefaultAudioEndpoint(eRender, eConsole) }.map_err(|e| e.to_string())?;
                let id = unsafe { current.GetId() }.map_err(|e| e.to_string())?;
                let text = unsafe { id.to_string() }.map_err(|e| e.to_string());
                unsafe { CoTaskMemFree(Some(id.0.cast())) };
                if text? != original_id_text { break; }
                last_endpoint_check = Instant::now();
            }
            if unsafe { capture.GetNextPacketSize() }.map_err(|e| e.to_string())? == 0 {
                std::thread::sleep(Duration::from_millis(3)); continue;
            }
            let mut data = std::ptr::null_mut(); let mut frames = 0; let mut flags = 0;
            unsafe { capture.GetBuffer(&mut data, &mut frames, &mut flags, None, None) }.map_err(|e| e.to_string())?;
            let count = frames as usize * channels;
            let mut samples = vec![0f32; count];
            if flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 == 0 && !data.is_null() {
                let bytes = unsafe { std::slice::from_raw_parts(data, count * (wfx.wBitsPerSample as usize / 8)) };
                for (index, sample) in samples.iter_mut().enumerate() {
                    let offset = index * (wfx.wBitsPerSample as usize / 8);
                    *sample = match wfx.wBitsPerSample {
                        16 => i16::from_le_bytes(bytes[offset..offset + 2].try_into().unwrap()) as f32 / 32768.0,
                        24 => i32::from_le_bytes([bytes[offset], bytes[offset+1], bytes[offset+2], if bytes[offset+2] & 128 != 0 {255} else {0}]) as f32 / 8_388_608.0,
                        _ if floating => f32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap()),
                        _ => i32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap()) as f32 / 2_147_483_648.0,
                    };
                }
            }
            let _ = unsafe { capture.ReleaseBuffer(frames) };
            // Loopback already contains the applications' effects. Applying the DSP again would
            // double-process Prisma's own output; an active global bridge provides its own tap.
            publish(wfx.nSamplesPerSec, channels, &samples);
        }
        Ok(())
    })();
    let _ = unsafe { client.Stop() };
    result
}
