use windows::core::PWSTR;
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    IAudioClient, IAudioRenderClient, IMMDeviceEnumerator, AUDCLNT_SHAREMODE_SHARED, WAVEFORMATEX,
};
use windows::Win32::System::Com::{CoTaskMemFree, CLSCTX_ALL};

use super::multi_output::OutputQueue;

pub struct RenderDeviceSlot {
    pub id: String,
    pub client: IAudioClient,
    pub service: IAudioRenderClient,
    pub endpoint_volume: Option<IAudioEndpointVolume>,
    pub buffer_frames: u32,
    pub sample_rate: u32,
    pub channels: usize,
    pub gain: f32,
    pub queue: OutputQueue,
    source_frame: Vec<f32>,
    bits: u16,
    float_format: bool,
}

impl RenderDeviceSlot {
    pub unsafe fn open(
        enumerator: &IMMDeviceEnumerator,
        id: &str,
        source_rate: u32,
        source_channels: usize,
        delay_ms: u32,
    ) -> Result<Self, String> {
        unsafe {
            let wide_id: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();
            let device = enumerator.GetDevice(PWSTR(wide_id.as_ptr() as *mut _))
                .map_err(|e| format!("La salida {id} ya no está disponible: {e}"))?;
            let client: IAudioClient = device.Activate(CLSCTX_ALL, None)
                .map_err(|e| format!("No se pudo abrir la salida {id}: {e}"))?;
            let format_ptr: *mut WAVEFORMATEX = client.GetMixFormat()
                .map_err(|e| format!("No se pudo leer el formato de {id}: {e}"))?;
            if format_ptr.is_null() { return Err(format!("Formato vacío en la salida {id}")); }
            let format = *format_ptr;
            let bits = format.wBitsPerSample;
            let float_format = format.wFormatTag == 3 ||
                (format.wFormatTag == 0xFFFE && format.cbSize >= 22 && *(format_ptr.cast::<u8>().add(24).cast::<u32>()) == 3);
            let supported = (float_format && bits == 32) || (!float_format && matches!(bits, 16 | 24 | 32));
            if !supported || format.nChannels == 0 || format.nSamplesPerSec == 0 {
                CoTaskMemFree(Some(format_ptr.cast()));
                return Err(format!("Formato de audio no compatible en la salida {id}"));
            }
            let initialized = client.Initialize(AUDCLNT_SHAREMODE_SHARED, 0, 400_000, 0, format_ptr, None);
            CoTaskMemFree(Some(format_ptr.cast()));
            initialized.map_err(|e| format!("No se pudo iniciar la salida {id}: {e}"))?;
            let buffer_frames = client.GetBufferSize().map_err(|e| e.to_string())?;
            let service: IAudioRenderClient = client.GetService().map_err(|e| e.to_string())?;
            let endpoint_volume = device.Activate(CLSCTX_ALL, None).ok();
            client.Start().map_err(|e| format!("No se pudo activar la salida {id}: {e}"))?;
            let mut queue = OutputQueue::new(source_channels, source_rate, format.nSamplesPerSec);
            queue.set_delay_ms(delay_ms);
            Ok(Self {
                id: id.to_string(), client, service, endpoint_volume, buffer_frames,
                sample_rate: format.nSamplesPerSec, channels: format.nChannels as usize,
                gain: 1.0, queue,
                source_frame: vec![0.0; source_channels],
                bits, float_format,
            })
        }
    }

    pub unsafe fn write_available(&mut self, source_channels: usize) -> Result<(), String> {
        unsafe {
            let padding = self.client.GetCurrentPadding().map_err(|e| e.to_string())?;
            let frames = self.queue.available_frames()
                .min(self.buffer_frames.saturating_sub(padding) as usize) as u32;
            if frames == 0 {
                self.queue.set_clock_feedback(padding, self.buffer_frames);
                return Ok(());
            }
            let data = self.service.GetBuffer(frames).map_err(|e| e.to_string())?;
            if data.is_null() { return Err("WASAPI devolvió un buffer nulo".to_string()); }
            for frame in 0..frames as usize {
                for sample in &mut self.source_frame { *sample = self.queue.pop_sample(); }
                for channel in 0..self.channels {
                    let value = (self.source_frame[channel % source_channels] * self.gain).clamp(-1.0, 1.0);
                    let index = frame * self.channels + channel;
                    if self.float_format {
                        *(data as *mut f32).add(index) = value;
                    } else if self.bits == 16 {
                        *(data as *mut i16).add(index) = (value * 32767.0) as i16;
                    } else if self.bits == 24 {
                        let bytes = ((value * 8388607.0) as i32).to_le_bytes();
                        std::ptr::copy_nonoverlapping(bytes.as_ptr(), data.add(index * 3), 3);
                    } else {
                        *(data as *mut i32).add(index) = (value * 2147483647.0) as i32;
                    }
                }
            }
            self.service.ReleaseBuffer(frames, 0).map_err(|e| e.to_string())?;
            self.queue.set_clock_feedback(padding + frames, self.buffer_frames);
            Ok(())
        }
    }
}
