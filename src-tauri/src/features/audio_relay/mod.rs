pub mod capture;
use std::io::{Read, Write};
use std::net::{IpAddr, Shutdown, SocketAddr, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};
use native_tls::{TlsConnector, TlsStream};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};
use crate::infrastructure::media::passthru::PassthruService;

pub const PORT: u16 = 49288;
pub const CAPABILITY: &str = "audio-receiver-tls-pcm-v1";
const DEFAULT_SHORTCUT: &str = "Ctrl+Shift+Alt+M";

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileAudioDevice { pub id: String, pub name: String, pub address: String, pub fingerprint: String }
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelayStatus {
    pub enabled: bool, pub connection: String, pub device: Option<MobileAudioDevice>, pub volume: f32,
    pub capture_device_id: Option<String>, pub shortcut: String, pub shortcut_error: Option<String>,
    pub error: Option<String>, pub sample_rate: u32,
}
#[derive(Clone, Deserialize, Serialize)]
struct SavedConfig {
    device: Option<MobileAudioDevice>, volume: f32,
    capture_device_id: Option<String>, shortcut: String,
}
impl Default for SavedConfig {
    fn default() -> Self { Self { device: None, volume: 1.0,
        capture_device_id: None, shortcut: DEFAULT_SHORTCUT.into() } }
}
pub struct AudioRelayService {
    config: Mutex<SavedConfig>, status: Mutex<RelayStatus>, path: PathBuf,
    enabled: AtomicBool, quitting: AtomicBool, generation: AtomicU64,
    socket: Mutex<Option<TcpStream>>, app: AppHandle,
    transition: Mutex<()>, saving: Mutex<()>, last_shortcut: Mutex<Option<Instant>>,
}
impl AudioRelayService {
    pub fn start(app: AppHandle, directory: PathBuf) -> Arc<Self> {
        let path = directory.join("mobile-audio.json");
        let mut config: SavedConfig = std::fs::read(&path).ok().and_then(|bytes| serde_json::from_slice(&bytes).ok()).unwrap_or_default();
        config.volume = if config.volume.is_finite() { config.volume.clamp(0.0, 1.0) } else { 1.0 };
        let status = RelayStatus { enabled: false, connection: "off".into(), device: config.device.clone(), volume: config.volume,
            capture_device_id: config.capture_device_id.clone(), shortcut: config.shortcut.clone(), shortcut_error: None,
            error: None, sample_rate: 0 };
        let service = Arc::new(Self { config: Mutex::new(config), status: Mutex::new(status), path,
            enabled: AtomicBool::new(false), quitting: AtomicBool::new(false), generation: AtomicU64::new(0),
            socket: Mutex::new(None), transition: Mutex::new(()), saving: Mutex::new(()), last_shortcut: Mutex::new(None), app });
        service.register_shortcut();
        let worker = service.clone();
        std::thread::spawn(move || worker.run());
        service
    }
    pub fn status(&self) -> RelayStatus { self.status.lock().unwrap().clone() }
    fn emit(&self) { let _ = self.app.emit("prisma://mobile-audio-status", self.status()); }
    fn save(&self) -> Result<(), String> {
        let _saving = self.saving.lock().map_err(|_| "Configuración ocupada")?;
        let bytes = serde_json::to_vec(&*self.config.lock().map_err(|_| "Configuración ocupada")?).map_err(|_| "No se pudo guardar la salida móvil")?;
        std::fs::create_dir_all(self.path.parent().unwrap()).map_err(|_| "No se pudo guardar la salida móvil")?;
        let temporary = self.path.with_extension("tmp");
        std::fs::write(&temporary, bytes).map_err(|_| "No se pudo guardar la salida móvil")?;
        std::fs::rename(temporary, &self.path).map_err(|_| "No se pudo guardar la salida móvil".to_string())
    }
    fn close_socket(&self) { if let Ok(socket) = self.socket.lock() { if let Some(socket) = socket.as_ref() { let _ = socket.shutdown(Shutdown::Both); } } }
    pub fn set_enabled(&self, enabled: bool) -> Result<RelayStatus, String> {
        let _transition = self.transition.lock().unwrap();
        self.change_enabled(enabled)
    }
    fn change_enabled(&self, enabled: bool) -> Result<RelayStatus, String> {
        if enabled && self.config.lock().unwrap().device.is_none() {
            let phones = self.app.state::<crate::features::synapse::SynapseDiscoveryService>().get_devices()
                .into_iter().filter(|d| d.capabilities.iter().any(|c| c == CAPABILITY)).collect::<Vec<_>>();
            if phones.len() > 1 { return Err("Hay varios teléfonos. Elige uno en el Ecualizador.".into()); }
            let phone = phones.first().ok_or("No hay un teléfono disponible. Abre Super Gallery con Synapse activo en la misma red.")?;
            self.remember_synapse(&phone.ip_address)?;
        }
        let was_enabled = self.enabled.swap(enabled, Ordering::SeqCst);
        if was_enabled != enabled { self.generation.fetch_add(1, Ordering::SeqCst); self.close_socket(); }
        if was_enabled == enabled { return Ok(self.status()); }
        { let mut status = self.status.lock().unwrap(); status.enabled = enabled; status.connection = if enabled {"connecting"} else {"off"}.into(); status.error = None; status.sample_rate = 0; }
        self.emit(); Ok(self.status())
    }
    pub fn toggle(&self) -> Result<RelayStatus, String> {
        let _transition = self.transition.lock().unwrap();
        self.change_enabled(!self.enabled.load(Ordering::SeqCst))
    }
    fn shortcut_toggle(&self) -> Result<RelayStatus, String> {
        let mut last = self.last_shortcut.lock().unwrap();
        if last.is_some_and(|time| time.elapsed() < Duration::from_millis(400)) { return Ok(self.status()); }
        *last = Some(Instant::now());
        self.toggle()
    }
    pub fn configure(&self, volume: f32, capture_id: Option<String>) -> Result<RelayStatus, String> {
        let _transition = self.transition.lock().unwrap();
        if !volume.is_finite() { return Err("Volumen inválido".into()); }
        let changed_source;
        { let mut config = self.config.lock().unwrap(); changed_source = config.capture_device_id != capture_id;
            config.volume = volume.clamp(0.0, 1.0); config.capture_device_id = capture_id.clone(); }
        { let mut status = self.status.lock().unwrap(); status.volume = volume.clamp(0.0, 1.0); status.capture_device_id = capture_id; }
        self.save()?;
        if changed_source { self.generation.fetch_add(1, Ordering::SeqCst); self.close_socket(); }
        self.emit(); Ok(self.status())
    }
    fn remember_synapse(&self, address: &str) -> Result<(), String> {
        let device = synapse_phone(address)?;
        self.config.lock().unwrap().device = Some(device.clone());
        self.status.lock().unwrap().device = Some(device);
        self.save()
    }
    pub fn select_phone(&self, address: String) -> Result<RelayStatus, String> {
        let _transition = self.transition.lock().unwrap();
        self.change_enabled(false)?;
        self.remember_synapse(&address)?;
        self.emit(); Ok(self.status())
    }
    pub fn set_shortcut(&self, shortcut: String) -> Result<RelayStatus, String> {
        let _transition = self.transition.lock().unwrap();
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        if !shortcut.is_empty() && (!shortcut.starts_with("Ctrl+Shift+Alt+") || shortcut.len() > 40) {
            return Err("Usa Ctrl+Shift+Alt y una tecla, o desactiva el atajo".into());
        }
        let old = self.config.lock().unwrap().shortcut.clone();
        if old == shortcut { return Ok(self.status()); }
        // Register first; failure preserves the previous working shortcut.
        if !shortcut.is_empty() { register(&self.app, &shortcut)?; }
        if !old.is_empty() { let _ = self.app.global_shortcut().unregister(old.as_str()); }
        self.config.lock().unwrap().shortcut = shortcut.clone();
        { let mut status = self.status.lock().unwrap(); status.shortcut = shortcut; status.shortcut_error = None; }
        self.save()?; self.emit(); Ok(self.status())
    }
    fn register_shortcut(&self) {
        let shortcut = self.config.lock().unwrap().shortcut.clone();
        if !shortcut.is_empty() {
            if register(&self.app, &shortcut).is_err() { self.status.lock().unwrap().shortcut_error = Some("Atajo ocupado. Elige otra combinación en el Ecualizador.".into()); }
        }
    }
    pub fn shutdown(&self) { self.quitting.store(true, Ordering::SeqCst); let _ = self.set_enabled(false); }
    fn phase(&self, generation: u64, connection: &str, error: Option<String>, rate: u32) {
        if generation != self.generation.load(Ordering::SeqCst) || !self.enabled.load(Ordering::SeqCst) { return; }
        { let mut status = self.status.lock().unwrap(); status.connection = connection.into(); status.error = error; status.sample_rate = rate; }
        self.emit();
    }
    fn run(self: Arc<Self>) {
        while !self.quitting.load(Ordering::SeqCst) {
            if !self.enabled.load(Ordering::SeqCst) { std::thread::sleep(Duration::from_millis(100)); continue; }
            let generation = self.generation.load(Ordering::SeqCst);
            let result = self.stream(generation);
            if generation != self.generation.load(Ordering::SeqCst) { continue; }
            match result {
                Err(StreamError::Stopped) => { let _ = self.set_enabled(false); }
                Err(StreamError::Auth) => { let _ = self.set_enabled(false); self.status.lock().unwrap().error = Some("Super Gallery no aceptó el audio. Comprueba que Synapse y el altavoz estén disponibles.".into()); self.emit(); }
                Err(StreamError::Retry(message)) => self.phase(generation, "reconnecting", Some(message), 0),
                Ok(()) => (),
            }
            for _ in 0..10 { if generation != self.generation.load(Ordering::SeqCst) { break; } std::thread::sleep(Duration::from_millis(100)); }
        }
    }
    fn stream(&self, generation: u64) -> Result<(), StreamError> {
        let config = self.config.lock().unwrap().clone();
        let mut device = config.device.ok_or(StreamError::Auth)?;
        // Discovery may change the address, never the pinned identity.
        let mut addresses = vec![device.address.clone()];
        if let Some(discovery) = self.app.try_state::<crate::features::synapse::SynapseDiscoveryService>() {
            for node in discovery.get_devices().iter().filter(|d| d.capabilities.iter().any(|c| c == CAPABILITY)) {
                if !addresses.contains(&node.ip_address) { addresses.push(node.ip_address.clone()); }
            }
        }
        let mut connected = None;
        let mut connection_error = "No se encontró el receptor".to_string();
        for address in addresses.into_iter().take(8) {
            if generation != self.generation.load(Ordering::SeqCst) { return Ok(()); }
            match connect(&address, Some(&device.fingerprint)) {
                Ok(stream) => { device.address = address; connected = Some(stream); break; }
                Err(error) => connection_error = error,
            }
        }
        let mut tls = connected.ok_or(StreamError::Retry(connection_error))?;
        *self.socket.lock().unwrap() = Some(tls.get_ref().try_clone().map_err(|_| StreamError::Retry("No se pudo abrir la conexión".into()))?);
        // Stable across retries of one enabled period, changed only by disable/configuration.
        let stream_id = format!("{:032x}", self.stream_seed() ^ generation as u128);
        write_json(&mut tls, &json!({"op":"start", "streamId":stream_id})).map_err(StreamError::Retry)?;
        let response = read_json(&mut tls).map_err(StreamError::Retry)?;
        if response["stopped"] == true { return Err(StreamError::Stopped); }
        if response["busy"] == true { return Err(StreamError::Retry("El receptor aún está cerrando la sesión anterior".into())); }
        if response["ok"] != true { return Err(StreamError::Auth); }
        // Do not overwrite a new selection with an old connection finishing in the background.
        {
            let _transition = self.transition.lock().unwrap();
            if generation != self.generation.load(Ordering::SeqCst) || !self.enabled.load(Ordering::SeqCst) { return Ok(()); }
            let mut changed_address = false;
            { let mut config = self.config.lock().unwrap();
                if let Some(saved) = config.device.as_mut().filter(|saved| saved.fingerprint == device.fingerprint) {
                    changed_address = saved.address != device.address;
                    saved.address = device.address.clone();
                }
            }
            self.status.lock().unwrap().device = Some(device);
            if changed_address { let _ = self.save(); }
        }
        self.phase(generation, "connected", None, 0);
        let (sender, receiver) = std::sync::mpsc::sync_channel::<capture::AudioBlock>(8);
        capture::set_tap(Some(sender));
        let running = Arc::new(AtomicBool::new(true));
        let capture_running = running.clone();
        let passthru = self.app.state::<Arc<PassthruService>>().inner().clone();
        let endpoint = config.capture_device_id;
        let capture_error = Arc::new(Mutex::new(None));
        let worker_error = capture_error.clone();
        let capture_worker = std::thread::spawn(move || capture::standalone(capture_running, passthru, endpoint, worker_error));
        let mut last_heartbeat = Instant::now() - Duration::from_secs(2);
        let mut current_rate = 0;
        let result = (|| {
            while self.enabled.load(Ordering::SeqCst) && generation == self.generation.load(Ordering::SeqCst) {
                if let Ok(block) = receiver.recv_timeout(Duration::from_millis(30)) {
                    if block.captured.elapsed() < Duration::from_millis(100) {
                        let volume = self.status.lock().unwrap().volume;
                        for chunk in encode_pcm(&block, volume).chunks(16_384) {
                            let mut packet = Vec::with_capacity(chunk.len() + 9);
                            packet.extend_from_slice(&((chunk.len() + 5) as u32).to_be_bytes());
                            packet.push(1); packet.extend_from_slice(&block.rate.to_be_bytes()); packet.extend_from_slice(chunk);
                            tls.write_all(&packet).map_err(|_| StreamError::Retry("Se interrumpió el envío de audio".into()))?;
                        }
                        if current_rate != block.rate { current_rate = block.rate; self.phase(generation, "connected", None, current_rate); }
                    }
                }
                if last_heartbeat.elapsed() >= Duration::from_secs(1) {
                    tls.write_all(&[0,0,0,1,0]).map_err(|_| StreamError::Retry("Teléfono desconectado".into()))?;
                    tls.flush().map_err(|_| StreamError::Retry("Teléfono desconectado".into()))?;
                    let status = read_json(&mut tls).map_err(StreamError::Retry)?;
                    if status["stopped"] == true { return Err(StreamError::Stopped); }
                    if status["ok"] != true { return Err(StreamError::Auth); }
                    self.phase(generation, "connected", capture_error.lock().unwrap().clone(), current_rate);
                    last_heartbeat = Instant::now();
                }
            }
            let _ = tls.write_all(&[0,0,0,1,2]);
            Ok(())
        })();
        running.store(false, Ordering::SeqCst);
        capture::set_tap(None);
        let _ = capture_worker.join();
        *self.socket.lock().unwrap() = None;
        result
    }
    fn stream_seed(&self) -> u128 {
        // Per-process unpredictable value, not a credential. Keep it stable for retry/explicit stop.
        static SEED: std::sync::OnceLock<u128> = std::sync::OnceLock::new();
        *SEED.get_or_init(|| { let mut bytes=[0u8;16];
            #[cfg(windows)] unsafe { let _ = windows::Win32::Security::Cryptography::BCryptGenRandom(None, &mut bytes, windows::Win32::Security::Cryptography::BCRYPT_USE_SYSTEM_PREFERRED_RNG); }
            u128::from_le_bytes(bytes) })
    }
}
enum StreamError { Stopped, Auth, Retry(String) }
fn register(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
    if matches!(shortcut.to_ascii_lowercase().as_str(), "ctrl+shift+alt+p" | "ctrl+shift+alt+o") { return Err("Esa combinación ya está reservada".into()); }
    app.global_shortcut().on_shortcut(shortcut, |app, _, event| {
        if event.state() == ShortcutState::Pressed {
            let app = app.clone();
            std::thread::spawn(move || {
                if let Some(service) = app.try_state::<Arc<AudioRelayService>>() {
                    if let Err(error) = service.shortcut_toggle() { let _ = app.emit("prisma://mobile-audio-error", error); }
                }
            });
        }
    }).map_err(|_| "El atajo global está ocupado o no es válido".into())
}
fn local_tcp(address: &str) -> Result<TcpStream, String> {
    let ip: IpAddr = address.parse().map_err(|_| "Dirección Synapse inválida")?;
    let local = match ip { IpAddr::V4(ip) => ip.is_private() || ip.is_loopback() || ip.is_link_local(), IpAddr::V6(ip) => ip.is_loopback() || ip.is_unique_local() || ip.is_unicast_link_local() };
    if !local { return Err("El teléfono debe estar en la red local".into()); }
    let tcp = TcpStream::connect_timeout(&SocketAddr::new(ip, PORT), Duration::from_secs(2)).map_err(|_| "Super Gallery no está disponible en Synapse".to_string())?;
    tcp.set_nodelay(true).ok(); tcp.set_read_timeout(Some(Duration::from_secs(4))).ok(); tcp.set_write_timeout(Some(Duration::from_secs(4))).ok();
    Ok(tcp)
}
fn http_headers(stream: &mut impl Read) -> Result<String, String> {
    let mut bytes = Vec::new();
    while bytes.len() < 8192 {
        let mut byte=[0]; stream.read_exact(&mut byte).map_err(|_| "Synapse cerró la conexión")?;
        bytes.push(byte[0]);
        if bytes.ends_with(b"\r\n\r\n") { return String::from_utf8(bytes).map_err(|_| "Respuesta Synapse inválida".into()); }
    }
    Err("Cabeceras Synapse demasiado grandes".into())
}
pub fn synapse_phone(address: &str) -> Result<MobileAudioDevice, String> {
    let mut tcp = local_tcp(address)?;
    tcp.write_all(format!("GET /api/v1/synapse/status HTTP/1.1\r\nHost: {address}\r\nConnection: close\r\n\r\n").as_bytes()).map_err(|_| "Synapse no respondió")?;
    let headers = http_headers(&mut tcp)?;
    if !headers.lines().next().is_some_and(|line| line.contains(" 200 ")) { return Err("Synapse está apagado o en pausa".into()); }
    let length = headers.lines().find_map(|line| { let (name,value)=line.split_once(':')?; if name.eq_ignore_ascii_case("content-length") {value.trim().parse::<usize>().ok()} else {None} }).ok_or("Estado Synapse incompleto")?;
    if !(2..=4096).contains(&length) { return Err("Estado Synapse inválido".into()); }
    let mut body=vec![0;length]; tcp.read_exact(&mut body).map_err(|_| "Estado Synapse incompleto")?;
    let value: Value=serde_json::from_slice(&body).map_err(|_| "Estado Synapse inválido")?;
    if value["success"] != true || value["target_app"] != "supergallery" || value["audio_available"] != true || value["audio_protocol"] != 1 {
        return Err("Abre Super Gallery y activa su disponibilidad como altavoz de Synapse".into());
    }
    let fingerprint=value["audio_fingerprint"].as_str().filter(|v|v.len()==64 && v.bytes().all(|b|b.is_ascii_hexdigit())).ok_or("Identidad Synapse incompleta")?.to_ascii_lowercase();
    Ok(MobileAudioDevice { id:fingerprint.clone(), fingerprint, name:value["device_name"].as_str().unwrap_or("Teléfono").chars().take(80).collect(), address:address.into() })
}
fn connect(address: &str, fingerprint: Option<&str>) -> Result<TlsStream<TcpStream>, String> {
    let mut tcp = local_tcp(address)?;
    tcp.write_all(format!("POST /api/v1/synapse/audio HTTP/1.1\r\nHost: {address}\r\nConnection: Upgrade\r\nUpgrade: prisma-audio-tls-pcm-v1\r\nContent-Length: 0\r\n\r\n").as_bytes()).map_err(|_| "Synapse no respondió")?;
    let headers=http_headers(&mut tcp)?;
    if !headers.lines().next().is_some_and(|line|line.contains(" 101 ")) { return Err("El altavoz de Super Gallery está apagado o Synapse está en pausa".into()); }
    // First use inherits Synapse's existing trusted-LAN model. Retain that phone's public identity
    // automatically, and verify it on later TLS connections; there is no second pairing workflow.
    let connector = TlsConnector::builder().min_protocol_version(Some(native_tls::Protocol::Tlsv12))
        .danger_accept_invalid_certs(true).danger_accept_invalid_hostnames(true).build().map_err(|_| "No se pudo preparar TLS")?;
    let stream = connector.connect("supergallery.local", tcp).map_err(|error| {
        #[cfg(test)] eprintln!("TLS handshake diagnostics: {error}");
        let _ = error; "No se pudo establecer una conexión cifrada"
    })?;
    if let Some(expected) = fingerprint { if peer_fingerprint(&stream)? != expected.to_ascii_lowercase() { return Err("Cambió la identidad del teléfono. Vuelve a seleccionarlo en el Ecualizador.".into()); } }
    stream.get_ref().set_write_timeout(Some(Duration::from_millis(300))).ok();
    Ok(stream)
}
fn peer_fingerprint(stream: &TlsStream<TcpStream>) -> Result<String, String> {
    let bytes = stream.peer_certificate().ok().flatten().and_then(|c| c.to_der().ok()).ok_or("Falta identidad TLS")?;
    Ok(Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect())
}
fn write_json(stream: &mut impl Write, value: &Value) -> Result<(), String> {
    let bytes = serde_json::to_vec(value).map_err(|_| "Mensaje inválido")?;
    if bytes.len() > 4096 { return Err("Mensaje demasiado grande".into()); }
    stream.write_all(&(bytes.len() as u32).to_be_bytes()).and_then(|_| stream.write_all(&bytes)).and_then(|_| stream.flush()).map_err(|_| "Conexión interrumpida".into())
}
fn read_json(stream: &mut impl Read) -> Result<Value, String> {
    let mut length = [0;4]; stream.read_exact(&mut length).map_err(|_| "Teléfono desconectado")?;
    let length = u32::from_be_bytes(length) as usize;
    if !(2..=4096).contains(&length) { return Err("Respuesta inválida del receptor".into()); }
    let mut bytes = vec![0;length]; stream.read_exact(&mut bytes).map_err(|_| "Respuesta incompleta")?;
    serde_json::from_slice(&bytes).map_err(|_| "Respuesta inválida del receptor".into())
}
fn encode_pcm(block: &capture::AudioBlock, gain: f32) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(block.samples.len() / block.channels.max(1) * 4);
    for frame in block.samples.chunks_exact(block.channels.max(1)) {
        let mut left = frame[0]; let mut right = *frame.get(1).unwrap_or(&left);
        // WASAPI's common surround order is FL, FR, FC, LFE, BL, BR, SL, SR.
        if frame.len() >= 3 { left += frame[2] * 0.707; right += frame[2] * 0.707; }
        for index in (4..frame.len()).step_by(2) { left += frame[index] * 0.5; right += frame.get(index+1).copied().unwrap_or(0.0) * 0.5; }
        for sample in [left, right] { let sample = if sample.is_finite() { (sample * gain).clamp(-1.0,1.0) } else {0.0}; bytes.extend_from_slice(&((sample * 32767.0) as i16).to_le_bytes()); }
    }
    bytes
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn framing_rejects_unbounded_or_truncated_controls() {
        assert!(read_json(&mut &u32::MAX.to_be_bytes()[..]).is_err());
        assert!(read_json(&mut &[0,0,0,5,b'{'][..]).is_err());
        let mut bytes=Vec::new(); write_json(&mut bytes, &json!({"ok":true})).unwrap();
        assert_eq!(read_json(&mut &bytes[..]).unwrap()["ok"], true);
    }
    #[test] fn pcm_duplicates_mono_and_sanitizes_nonfinite_samples() {
        let block=capture::AudioBlock{rate:48000,channels:1,samples:vec![0.5,f32::NAN],captured:Instant::now()};
        let pcm=encode_pcm(&block,1.0);
        assert_eq!(&pcm[0..2],&pcm[2..4]); assert_eq!(&pcm[4..8],&[0,0,0,0]);
    }
    /// Physical LAN probe. Run only with the Android instrumentation armed on an owned device.
    #[cfg(windows)]
    #[test]
    #[ignore = "requires an available physical Android device on Synapse"]
    fn real_phone_capture_silence_and_reconnect() {
        let address = std::env::var("PRISMA_AUDIO_PROBE_ADDRESS").expect("Set the physical phone address");
        let peer = synapse_phone(&address).expect("Synapse availability check failed");
        let fingerprint = peer.fingerprint;
        let stream_id = format!("{:032x}", SystemTimeForProbe::seed());
        let begin = || {
            let mut tls = connect(&address, Some(&fingerprint)).unwrap();
            write_json(&mut tls, &json!({"op":"start", "streamId":stream_id})).unwrap();
            let response = read_json(&mut tls).unwrap();
            assert!(response["ok"] == true, "Session start rejected");
            tls
        };
        let mut tls = begin();
        let (sender, receiver) = std::sync::mpsc::sync_channel(8);
        capture::set_tap(Some(sender));
        let running = Arc::new(AtomicBool::new(true));
        let worker_running = running.clone();
        let capture_error = Arc::new(Mutex::new(None));
        let worker_error = capture_error.clone();
        let worker = std::thread::spawn(move || capture::standalone(worker_running, Arc::new(PassthruService::new()), None, worker_error));
        let started = Instant::now();
        let mut last_heartbeat = Instant::now();
        let mut frames = 0u64;
        let mut nonzero = 0u64;
        let mut heartbeats = 0u64;
        let mut reconnected = false;
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            while started.elapsed() < Duration::from_secs(90) {
                let seconds = started.elapsed().as_secs();
                // Exercise no incoming PCM for ten seconds without closing the session.
                let silence = (30..40).contains(&seconds);
                if let Ok(block) = receiver.recv_timeout(Duration::from_millis(20)) {
                    if !silence && block.captured.elapsed() < Duration::from_millis(100) {
                        for chunk in encode_pcm(&block, 0.2).chunks(16_384) {
                            let mut packet = Vec::with_capacity(chunk.len()+9);
                            packet.extend_from_slice(&((chunk.len()+5) as u32).to_be_bytes());
                            packet.push(1); packet.extend_from_slice(&block.rate.to_be_bytes()); packet.extend_from_slice(chunk);
                            tls.write_all(&packet).unwrap();
                            frames += chunk.len() as u64 / 4;
                            nonzero += chunk.chunks_exact(2).filter(|sample| i16::from_le_bytes([sample[0],sample[1]]) != 0).count() as u64;
                        }
                    }
                }
                if last_heartbeat.elapsed() >= Duration::from_secs(1) {
                    tls.write_all(&[0,0,0,1,0]).unwrap(); tls.flush().unwrap();
                    let reply = read_json(&mut tls).unwrap();
                    assert!(reply["ok"] == true && reply["stopped"] != true, "Receiver stopped unexpectedly");
                    heartbeats += 1; last_heartbeat = Instant::now();
                }
                if seconds >= 55 && !reconnected {
                    tls.get_ref().shutdown(Shutdown::Both).unwrap();
                    std::thread::sleep(Duration::from_secs(2));
                    tls = begin(); reconnected = true;
                }
            }
            tls.write_all(&[0,0,0,1,2]).unwrap();
            assert!(frames > 48000, "No Windows loopback samples were transmitted");
            assert!(nonzero > 1000, "No actual sound was captured; play the test tone on Windows");
            assert!(heartbeats > 60 && reconnected);
            assert!(capture_error.lock().unwrap().is_none(), "Windows capture failed");
            eprintln!("Physical probe: {frames} stereo frames, {nonzero} nonzero samples, {heartbeats} heartbeats; ten-second silence and reconnect passed.");
        }));
        running.store(false, Ordering::SeqCst); capture::set_tap(None); worker.join().unwrap();
        if let Err(error) = result { std::panic::resume_unwind(error); }
    }
    struct SystemTimeForProbe;
    impl SystemTimeForProbe { fn seed() -> u128 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos() } }
}
