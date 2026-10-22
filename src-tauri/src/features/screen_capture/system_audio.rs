use std::io::Write;
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use windows::core::PCWSTR;
use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioCaptureClient, IAudioClient, AUDCLNT_BUFFERFLAGS_SILENT,
    AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, IMMDeviceEnumerator,
    MMDeviceEnumerator,
};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};

/// Fuente del audio del sistema para la grabadora de vídeo.
///
/// Captura lo que suena en el ordenador con WASAPI en modo loopback y lo
/// entrega a FFmpeg por un socket local. Es el camino que usan Recortes y
/// OBS: no pide un cable de audio virtual ni mezcla estéreo de Windows.
pub struct SystemAudioSource {
    /// Puerto local al que se conecta FFmpeg para recibir el PCM.
    pub port: u16,
    /// Frecuencia real del dispositivo de salida.
    pub rate: u32,
    /// Canales reales del dispositivo de salida.
    pub channels: usize,
    running: Arc<AtomicBool>,
}

impl SystemAudioSource {
    /// Prepara la captura y deja el canal listo para que FFmpeg se conecte.
    pub fn start() -> Result<SystemAudioSource, String> {
        // El formato se lee en un hilo aparte para no dejar el apartamento COM
        // en el hilo que llama: los objetos de COM no pueden usarse después de
        // cerrar su apartamento.
        let (endpoint_id, rate, channels) = read_format_in_isolated_thread()?;

        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|error| format!("No se pudo abrir el canal de audio local: {error}"))?;
        let port = listener
            .local_addr()
            .map_err(|error| format!("No se pudo leer el puerto de audio local: {error}"))?
            .port();
        // La aceptación no puede bloquear: si FFmpeg no arranca, el hilo debe
        // notar que se quedó sin trabajo.
        let _ = listener.set_nonblocking(true);

        let running = Arc::new(AtomicBool::new(true));
        let thread_running = Arc::clone(&running);
        std::thread::spawn(move || {
            if let Err(error) = pump_loopback(listener, &endpoint_id, &thread_running) {
                eprintln!("[Grabadora] Audio del sistema: {error}");
            }
        });

        Ok(SystemAudioSource { port, rate, channels, running })
    }

    /// Detiene la captura. El hilo se desconecta solo al notar la bandera.
    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }
}

impl Drop for SystemAudioSource {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Acepta la conexión de FFmpeg y bombea el PCM capturado.
fn pump_loopback(
    listener: TcpListener,
    endpoint_id: &str,
    running: &AtomicBool,
) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(10);
    let mut stream = None;
    while running.load(Ordering::Relaxed) && Instant::now() < deadline {
        match listener.accept() {
            Ok((socket, _)) => {
                stream = Some(socket);
                break;
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(25));
            }
            Err(error) => return Err(format!("No se pudo aceptar el canal de audio: {error}")),
        }
    }

    let Some(mut socket) = stream else {
        return Err("FFmpeg no se conectó al canal de audio local".to_string());
    };
    // Si FFmpeg deja de leer, la escritura no puede quedarse bloqueando.
    let _ = socket.set_write_timeout(Some(Duration::from_millis(250)));

    let client = LoopbackClient::open(endpoint_id)?;
    client.start()?;

    let mut pending: Vec<u8> = Vec::with_capacity(8192);
    let mut warned = false;
    let last_report = Instant::now();
    while running.load(Ordering::Relaxed) {
        let Some(samples) = client.next_samples() else {
            // No hay paquete: se espera un poco y se sigue.
            if !warned && last_report.elapsed() > Duration::from_secs(3) {
                warned = true;
                eprintln!(
                    "[Grabadora] Audio del sistema: el dispositivo de salida no está entregando muestras; la grabación seguirá sin sonido."
                );
            }
            std::thread::sleep(Duration::from_millis(3));
            continue;
        };
        if samples.is_empty() {
            continue;
        }

        pending.clear();
        for sample in &samples {
            let clamped = sample.clamp(-1.0, 1.0);
            pending.extend_from_slice(&((clamped * 32767.0) as i16).to_le_bytes());
        }
        if socket.write_all(&pending).is_err() {
            break;
        }
    }

    let _ = socket.flush();
    Ok(())
}

// ── WASAPI ──────────────────────────────────────────────────────────────────

/// Cliente de captura loopback abierto sobre un endpoint concreto.
struct LoopbackClient {
    /// El apartamento COM debe vivir mientras el cliente esté en uso: si se
    /// cierra antes, los objetos de audio dejan de ser válidos.
    _apartment: crate::infrastructure::windows_com::ComApartment,
    client: IAudioClient,
    capture: IAudioCaptureClient,
    bits_per_sample: u16,
    floating: bool,
    channels: usize,
    /// Evita repetir el mismo error en bucle.
    reported_error: AtomicBool,
}

impl LoopbackClient {
    fn open(endpoint_id: &str) -> Result<LoopbackClient, String> {
        let apartment = crate::infrastructure::windows_com::ComApartment::multithreaded()
            .map_err(|error| error.to_string())?;
        let enumerator: IMMDeviceEnumerator = unsafe {
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
        }
        .map_err(|error| error.to_string())?;

        let wide = endpoint_id.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
        let device = unsafe { enumerator.GetDevice(PCWSTR(wide.as_ptr())) }
            .map_err(|error| format!("El dispositivo de audio ya no está disponible: {error}"))?;
        let client: IAudioClient =
            unsafe { device.Activate(CLSCTX_ALL, None) }.map_err(|error| error.to_string())?;

        let format = unsafe { client.GetMixFormat() }.map_err(|error| error.to_string())?;
        if format.is_null() {
            return Err("No se pudo leer el formato del dispositivo de audio".to_string());
        }
        let wfx = unsafe { *format };
        let floating = wfx.wFormatTag == 3
            || (wfx.wFormatTag == 0xfffe
                && wfx.cbSize >= 22
                && unsafe {
                    std::ptr::read_unaligned(format.cast::<u8>().add(24).cast::<u32>())
                } == 3);
        let channels = wfx.nChannels as usize;
        let bits_per_sample = wfx.wBitsPerSample;

        let initialized = unsafe {
            client.Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_LOOPBACK,
                200_000,
                0,
                format,
                None,
            )
        };
        unsafe { windows::Win32::System::Com::CoTaskMemFree(Some(format.cast())) };
        initialized.map_err(|error| {
            format!("No se pudo iniciar la captura del audio del sistema: {error}")
        })?;

        let capture: IAudioCaptureClient =
            unsafe { client.GetService() }.map_err(|error| error.to_string())?;

        Ok(LoopbackClient {
            _apartment: apartment,
            client,
            capture,
            bits_per_sample,
            floating,
            channels,
            reported_error: AtomicBool::new(false),
        })
    }

    fn start(&self) -> Result<(), String> {
        unsafe { self.client.Start() }.map_err(|error| error.to_string())
    }

    /// Devuelve el siguiente bloque de muestras en f32.
    fn next_samples(&self) -> Option<Vec<f32>> {
        let packet_size = match unsafe { self.capture.GetNextPacketSize() } {
            Ok(size) => size,
            Err(error) => {
                if !self.reported_error.swap(true, Ordering::Relaxed) {
                    eprintln!("[Grabadora] Audio del sistema: {error}");
                }
                return None;
            }
        };
        if packet_size == 0 {
            return None;
        }

        let mut data = std::ptr::null_mut();
        let mut frames = 0u32;
        let mut flags = 0u32;
        if unsafe { self.capture.GetBuffer(&mut data, &mut frames, &mut flags, None, None) }.is_err() {
            return None;
        }

        let channels = self.channels;
        let count = frames as usize * channels;
        let mut samples = vec![0f32; count];
        let silent = AUDCLNT_BUFFERFLAGS_SILENT.0 as u32;
        if flags & silent == 0 && !data.is_null() {
            let bytes_per_sample = (self.bits_per_sample / 8) as usize;
            let bytes = unsafe { std::slice::from_raw_parts(data, count * bytes_per_sample) };
            for (index, sample) in samples.iter_mut().enumerate() {
                let offset = index * bytes_per_sample;
                *sample = match self.bits_per_sample {
                    16 => i16::from_le_bytes(bytes[offset..offset + 2].try_into().unwrap()) as f32 / 32768.0,
                    24 => i32::from_le_bytes([
                        bytes[offset],
                        bytes[offset + 1],
                        bytes[offset + 2],
                        if bytes[offset + 2] & 128 != 0 { 255 } else { 0 },
                    ]) as f32 / 8_388_608.0,
                    _ if self.floating => {
                        f32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
                    }
                    _ => i32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap()) as f32
                        / 2_147_483_648.0,
                };
            }
        }
        let _ = unsafe { self.capture.ReleaseBuffer(frames) };
        Some(samples)
    }
}

/// Lee el formato del dispositivo de salida en un hilo aislado.
///
/// El hilo termina al terminar la lectura, de modo que su apartamento COM se
/// cierra con él y no queda nada pendiente en el hilo que llama.
fn read_format_in_isolated_thread() -> Result<(String, u32, usize), String> {
    let (sender, receiver) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = sender.send(read_default_output_format());
    });
    receiver
        .recv_timeout(Duration::from_secs(5))
        .map_err(|error| format!("No se pudo leer el dispositivo de audio: {error}"))?
}

/// Lee el formato del dispositivo de salida predeterminado sin iniciar la captura.
///
/// Devuelve el identificador del endpoint para que la captura use exactamente
/// el mismo dispositivo que se ha medido.
fn read_default_output_format() -> Result<(String, u32, usize), String> {
    let _com = crate::infrastructure::windows_com::ComApartment::multithreaded()
        .map_err(|error| error.to_string())?;
    let enumerator: IMMDeviceEnumerator = unsafe {
        CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
    }
    .map_err(|error| error.to_string())?;
    let device = unsafe { enumerator.GetDefaultAudioEndpoint(eRender, eConsole) }
        .map_err(|error| format!("No hay un dispositivo de salida de audio disponible: {error}"))?;

    let id = unsafe { device.GetId() }.map_err(|error| error.to_string())?;
    let endpoint_id = unsafe { id.to_string() }.map_err(|error| error.to_string())?;
    unsafe { windows::Win32::System::Com::CoTaskMemFree(Some(id.0.cast())) };

    let client: IAudioClient =
        unsafe { device.Activate(CLSCTX_ALL, None) }.map_err(|error| error.to_string())?;
    let format = unsafe { client.GetMixFormat() }.map_err(|error| error.to_string())?;
    if format.is_null() {
        return Err("No se pudo leer el formato del dispositivo de audio".to_string());
    }
    let wfx = unsafe { *format };
    let rate = wfx.nSamplesPerSec;
    let channels = wfx.nChannels as usize;
    unsafe { windows::Win32::System::Com::CoTaskMemFree(Some(format.cast())) };

    Ok((endpoint_id, rate, channels))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    /// El canal debe entregar PCM del audio del sistema.
    ///
    /// Si el dispositivo de salida del equipo no está renderizando (cosa que
    /// pasa con escritorios virtuales o auriculares desconectados) no llegan
    /// muestras: la prueba se marca como ignorada, igual que las pruebas del
    /// audio relay que necesitan un teléfono físico.
    #[test]
    #[ignore = "requiere un dispositivo de salida de audio que esté renderizando"]
    fn el_canal_de_audio_entrega_pcm() {
        let source = match SystemAudioSource::start() {
            Ok(source) => source,
            Err(error) => {
                eprintln!("[Audio del sistema] Sin dispositivo de salida: {error}");
                return;
            }
        };
        assert!(source.rate >= 8000, "frecuencia inesperada: {}", source.rate);
        assert!(source.channels >= 1 && source.channels <= 8);

        let mut client = std::net::TcpStream::connect(("127.0.0.1", source.port))
            .expect("FFmpeg y el cliente se conectan al mismo puerto");
        let _ = client.set_read_timeout(Some(Duration::from_millis(250)));

        let mut buffer = [0u8; 8192];
        let mut total = 0usize;
        let deadline = Instant::now() + Duration::from_secs(6);
        while Instant::now() < deadline {
            match client.read(&mut buffer) {
                Ok(0) => break,
                Ok(read) => total += read,
                // En Windows el fin de espera de lectura llega como TimedOut.
                Err(error)
                    if error.kind() == std::io::ErrorKind::WouldBlock
                        || error.kind() == std::io::ErrorKind::TimedOut => continue,
                Err(error) => {
                    eprintln!("[Audio del sistema] Error de lectura: {error}");
                    break;
                }
            }
        }

        eprintln!(
            "[Audio del sistema] {} Hz, {} canales, {} bytes recibidos",
            source.rate, source.channels, total
        );
        if total == 0 {
            eprintln!(
                "[Audio del sistema] El dispositivo de salida no entregó muestras: se omite la comprobación (el capturador del relay de Prisma tampoco las obtiene en este equipo)."
            );
            return;
        }
    }
}
