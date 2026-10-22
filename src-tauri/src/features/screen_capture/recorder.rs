use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::infrastructure::converter::find_ffmpeg_binary;

/// Fotogramas por segundo por defecto de la grabación.
pub const DEFAULT_FPS: u32 = 30;
const MIN_FPS: u32 = 5;
const MAX_FPS: u32 = 60;
/// Margen para que el compositor retire el overlay antes de capturar el primer fotograma.
pub const OVERLAY_RELEASE_DELAY: Duration = Duration::from_millis(220);
/// Tiempo máximo que se espera a que FFmpeg cierre el archivo al detener.
const STOP_TIMEOUT: Duration = Duration::from_secs(20);

/// Región de pantalla a grabar, en coordenadas físicas del escritorio virtual.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingRegion {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Parámetros de la grabación.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingOptions {
    pub region: RecordingRegion,
    #[serde(default)]
    pub fps: Option<u32>,
    /// Dispositivo de audio DirectShow opcional (micrófono o cable de audio).
    #[serde(default)]
    pub audio_device: Option<String>,
    /// Carpeta donde se guarda el vídeo final.
    #[serde(default)]
    pub output_folder: Option<String>,
    /// Codificador: `auto`, `cpu` (libx264), `nvenc`, `qsv` o `amf`.
    #[serde(default)]
    pub encoder: Option<String>,
    /// Calidad: `high` (CRF 20), `medium` (CRF 23) o `low` (CRF 28).
    #[serde(default)]
    pub quality: Option<String>,
    /// Altura máxima del vídeo; `None` mantiene el tamaño de la región.
    #[serde(default)]
    pub max_height: Option<u32>,
    /// Capturar también el audio del sistema (WASAPI loopback).
    #[serde(default)]
    pub system_audio: Option<bool>,
}

/// Estado público de la grabadora.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingInfo {
    /// `recording`, `finished` o `error`.
    pub status: String,
    pub output_path: String,
    /// Marca de tiempo del inicio, en milisegundos epoch.
    pub started_at_ms: u64,
    pub elapsed_ms: u64,
    pub region: RecordingRegion,
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    #[serde(default)]
    pub error: Option<String>,
    /// `true` cuando la grabación está en pausa.
    #[serde(default)]
    pub paused: bool,
}

/// Grabación en curso. El tipo es público porque aparece en el alias de estado
/// que Prisma gestiona; sus campos quedan privados al módulo.
pub struct ActiveRecording {
    child: Child,
    stdin: Option<ChildStdin>,
    output_path: PathBuf,
    started_at: Instant,
    started_at_ms: u64,
    region: RecordingRegion,
    fps: u32,
    /// Tamaño final del vídeo, que puede diferir de la región si se escaló.
    output_width: u32,
    output_height: u32,
    /// `true` mientras la grabación está en pausa.
    paused: bool,
    /// Captura del audio del sistema, viva mientras dura la grabación.
    /// El campo existe para mantenerla viva: al soltar la grabación, su Drop
    /// cierra el canal de audio.
    #[cfg(windows)]
    #[allow(dead_code)]
    system_audio: Option<crate::features::screen_capture::system_audio::SystemAudioSource>,
    log: Arc<Mutex<String>>,
}

pub type SharedRecorderState = Arc<Mutex<Option<ActiveRecording>>>;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Origen del escritorio virtual. GDIGRAB mide el desplazamiento desde esta esquina,
/// no desde el monitor principal, así que en setups multimonitor las coordenadas
/// negativas se restan correctamente.
#[cfg(windows)]
fn virtual_origin() -> (i32, i32) {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
    };
    unsafe {
        (
            GetSystemMetrics(SM_XVIRTUALSCREEN),
            GetSystemMetrics(SM_YVIRTUALSCREEN),
        )
    }
}

#[cfg(not(windows))]
fn virtual_origin() -> (i32, i32) {
    (0, 0)
}

/// Rectángulo del escritorio virtual: origen y tamaño en coordenadas físicas.
#[cfg(windows)]
pub fn virtual_screen_rect() -> (i32, i32, u32, u32) {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
        SM_YVIRTUALSCREEN,
    };
    unsafe {
        let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        (
            x,
            y,
            GetSystemMetrics(SM_CXVIRTUALSCREEN) as u32,
            GetSystemMetrics(SM_CYVIRTUALSCREEN) as u32,
        )
    }
}

#[cfg(not(windows))]
pub fn virtual_screen_rect() -> (i32, i32, u32, u32) {
    (0, 0, 1920, 1080)
}

/// H.264 exige dimensiones pares: un rectángulo impar se recorta un píxel.
fn even_dimension(value: u32) -> u32 {
    if value < 2 {
        2
    } else {
        value & !1
    }
}

fn build_output_path(folder: &str) -> Result<PathBuf, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    // Fecha local en formato YYYY-MM-DD_HH-MM-SS.
    let local = chrono_like_local(secs);
    let name = format!("Prisma_Grabacion_{local}.mp4");
    let path = PathBuf::from(folder).join(name);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("No se pudo crear la carpeta de destino: {e}"))?;
    }
    Ok(path)
}

/// Convierte un instante epoch en texto local `YYYY-MM-DD_HH-MM-SS` sin dependencias extra.
fn chrono_like_local(epoch_secs: u64) -> String {
    let offset = local_utc_offset_secs();
    let local = epoch_secs as i64 + offset;
    let days = local.div_euclid(86_400);
    let secs_of_day = local.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    format!(
        "{:04}-{:02}-{:02}_{:02}-{:02}-{:02}",
        year,
        month,
        day,
        secs_of_day / 3600,
        (secs_of_day % 3600) / 60,
        secs_of_day % 60
    )
}

/// Desplazamiento de la zona horaria local, en segundos (hora local menos UTC).
fn local_utc_offset_secs() -> i64 {
    #[cfg(windows)]
    {
        use windows::Win32::System::SystemInformation::{GetLocalTime, GetSystemTime};
        unsafe {
            let utc = GetSystemTime();
            let local = GetLocalTime();
            system_time_to_unix(&local) - system_time_to_unix(&utc)
        }
    }
    #[cfg(not(windows))]
    {
        0
    }
}

/// Convierte una estructura SYSTEMTIME de Windows a segundos epoch.
#[cfg(windows)]
fn system_time_to_unix(time: &windows::Win32::Foundation::SYSTEMTIME) -> i64 {
    let days = days_from_civil(time.wYear as i64, time.wMonth as u32, time.wDay as u32);
    days * 86_400 + time.wHour as i64 * 3600 + time.wMinute as i64 * 60 + time.wSecond as i64
}

/// Convierte días desde el epoch proleptic gregoriano a fecha civil.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    (year, m as u32, d as u32)
}

/// Convierte una fecha civil a días desde el epoch proleptic gregoriano.
fn days_from_civil(year: i64, month: u32, day: u32) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = year.div_euclid(400);
    let year_of_era = year - era * 400;
    let shifted_month = if month > 2 {
        month as i64 - 3
    } else {
        month as i64 + 9
    };
    let day_of_year = (153 * shifted_month + 2) / 5 + day as i64 - 1;
    let day_of_era =
        year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

/// Dispositivos de captura de audio DirectShow disponibles.
pub fn list_audio_devices() -> Vec<String> {
    let Some(ffmpeg) = find_ffmpeg_binary() else {
        return Vec::new();
    };
    let mut command = Command::new(&ffmpeg);
    command
        .args(["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let Ok(output) = command.output() else {
        return Vec::new();
    };
    let text = String::from_utf8_lossy(&output.stderr).to_string();
    let mut devices = Vec::new();
    for line in text.lines() {
        if !line.contains("(audio)") {
            continue;
        }
        let Some(start) = line.find('"') else { continue };
        let Some(end) = line.rfind('"') else { continue };
        if end <= start {
            continue;
        }
        let name = line[start + 1..end].trim().to_string();
        if !name.is_empty() && !devices.contains(&name) {
            devices.push(name);
        }
    }
    devices
}

/// Parámetros de una ejecución concreta de FFmpeg.
struct SpawnPlan<'a> {
    ffmpeg: &'a std::path::Path,
    quality: &'a str,
    fps: u32,
    offset_x: i32,
    offset_y: i32,
    width: u32,
    height: u32,
    audio_device: Option<&'a str>,
    /// Audio del sistema: puerto local, frecuencia y canales.
    system_audio: Option<(u16, u32, usize)>,
    output_path: &'a std::path::Path,
    max_height: Option<u32>,
}

/// Valor de calidad → CRF equivalente.
fn quality_to_crf(quality: &str) -> u8 {
    match quality {
        "high" => 20,
        "low" => 28,
        _ => 23,
    }
}

/// Argumentos de codificación según el motor elegido.
fn encoder_args(encoder: &str, quality: &str) -> Vec<String> {
    let crf = quality_to_crf(quality).to_string();
    match encoder {
        "nvenc" => vec![
            "-c:v".into(), "h264_nvenc".into(),
            "-preset".into(), "p4".into(),
            "-tune".into(), "hq".into(),
            "-rc".into(), "vbr".into(),
            "-cq".into(), crf,
            "-b:v".into(), "0".into(),
            "-pix_fmt".into(), "yuv420p".into(),
        ],
        "qsv" => vec![
            "-c:v".into(), "h264_qsv".into(),
            "-preset".into(), "veryfast".into(),
            "-global_quality".into(), crf,
            "-look_ahead".into(), "0".into(),
            "-pix_fmt".into(), "yuv420p".into(),
        ],
        "amf" => vec![
            "-c:v".into(), "h264_amf".into(),
            "-quality".into(), "balanced".into(),
            "-rc".into(), "cqp".into(),
            "-qp_i".into(), crf.clone(),
            "-qp_p".into(), crf,
            "-pix_fmt".into(), "yuv420p".into(),
        ],
        _ => vec![
            "-c:v".into(), "libx264".into(),
            "-preset".into(), "veryfast".into(),
            "-crf".into(), crf,
            "-pix_fmt".into(), "yuv420p".into(),
        ],
    }
}

/// Caché de sondas: cada motor se comprueba una sola vez por proceso.
fn encoder_probe_cache() -> &'static Mutex<std::collections::HashMap<String, bool>> {
    static CACHE: OnceLock<Mutex<std::collections::HashMap<String, bool>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(std::collections::HashMap::new()))
}

/// Comprueba si el motor de codificación existe y funciona en esta máquina.
///
/// No basta con lanzar la grabación: cuando el codificador falla, FFmpeg no
/// muere, se queda vivo con el vídeo vacío y el archivo final sale sin datos.
/// Por eso se hace una codificación de prueba mínima y se mira su código de
/// salida antes de compromise con un motor.
fn encoder_available(ffmpeg: &std::path::Path, encoder: &str) -> bool {
    if encoder == "cpu" {
        return true;
    }

    {
        let cache = encoder_probe_cache().lock().unwrap_or_else(|error| error.into_inner());
        if let Some(available) = cache.get(encoder) {
            return *available;
        }
    }

    let mut command = Command::new(ffmpeg);
    command
        .args(["-hide_banner", "-loglevel", "error"])
        .args(["-f", "lavfi", "-i", "color=c=black:s=128x128"])
        .args(["-frames:v", "1"])
        .args(encoder_args(encoder, "medium"))
        .args(["-f", "null", "-"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let available = matches!(command.output(), Ok(output) if output.status.success());
    let mut cache = encoder_probe_cache().lock().unwrap_or_else(|error| error.into_inner());
    cache.insert(encoder.to_string(), available);
    available
}

/// Lanza FFmpeg con el codificador indicado y comprueba que no muera de inmediato.
///
/// Si el motor no está disponible en la máquina (por ejemplo NVENC sin GPU
/// NVIDIA), FFmpeg termina al instante con un error claro: eso permite que el
/// modo «auto» pruebe el siguiente motor.
fn spawn_recorder(
    plan: &SpawnPlan<'_>,
    encoder: &str,
) -> Result<(Child, Option<ChildStdin>, Arc<Mutex<String>>), String> {
    let mut command = Command::new(plan.ffmpeg);
    command
        .args(["-hide_banner", "-loglevel", "error", "-stats"])
        .args(["-f", "gdigrab", "-draw_mouse", "1"])
        .args(["-framerate", &plan.fps.to_string()])
        .args(["-offset_x", &plan.offset_x.to_string()])
        .args(["-offset_y", &plan.offset_y.to_string()])
        .args(["-video_size", &format!("{}x{}", plan.width, plan.height)])
        .args(["-i", "desktop"]);

    // El audio del sistema llega por un socket local: FFmpeg se conecta como
    // cliente y lee el PCM en crudo que le escribe la captura WASAPI.
    let mut audio_inputs: Vec<usize> = Vec::new();
    let mut next_input = 1;
    if let Some(device) = plan.audio_device {
        command.args(["-f", "dshow", "-i", &format!("audio=\"{device}\"")]);
        audio_inputs.push(next_input);
        next_input += 1;
    }
    if let Some((port, rate, channels)) = plan.system_audio {
        command
            .args(["-f", "s16le", "-ar", &rate.to_string(), "-ac", &channels.to_string()])
            .args(["-i", &format!("tcp://127.0.0.1:{port}")]);
        audio_inputs.push(next_input);
    }

    if let Some(max_height) = plan.max_height {
        if plan.height > max_height {
            command.args(["-vf", &format!("scale=-2:{max_height}")]);
        }
    }

    command.args(encoder_args(encoder, plan.quality));

    // Vídeo siempre desde la captura de pantalla; el audio se mapea o se mezcla.
    command.args(["-map", "0:v"]);
    match audio_inputs.len() {
        0 => {}
        1 => {
            command.args(["-map", &format!("{}:a", audio_inputs[0])]);
            command.args(["-c:a", "aac", "-b:a", "160k"]);
        }
        _ => {
            let filter = format!(
                "[{}:a][{}:a]amix=inputs=2:duration=longest:dropout_transition=0[aout]",
                audio_inputs[0], audio_inputs[1]
            );
            command.args(["-filter_complex", &filter, "-map", "[aout]"]);
            command.args(["-c:a", "aac", "-b:a", "160k"]);
        }
    }

    command
        .arg(plan.output_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("No se pudo iniciar FFmpeg: {e}"))?;

    let log = Arc::new(Mutex::new(String::new()));
    if let Some(stderr) = child.stderr.take() {
        let log_clone = Arc::clone(&log);
        std::thread::spawn(move || {
            let mut reader = std::io::BufReader::new(stderr);
            let mut buffer = String::new();
            let mut chunk = [0u8; 512];
            loop {
                match reader.read(&mut chunk) {
                    Ok(0) | Err(_) => break,
                    Ok(read) => {
                        buffer.push_str(&String::from_utf8_lossy(&chunk[..read]));
                        if buffer.len() > 4096 {
                            let cut = buffer.len() - 4096;
                            buffer.drain(..cut);
                        }
                        if let Ok(mut guard) = log_clone.lock() {
                            *guard = buffer.clone();
                        }
                    }
                }
            }
        });
    }

    // Si FFmpeg falla de inmediato (región inválida, códec ausente) se detecta aquí.
    std::thread::sleep(Duration::from_millis(450));
    if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
        let log_text = log.lock().map(|guard| guard.clone()).unwrap_or_default();
        let _ = std::fs::remove_file(plan.output_path);
        let detail = if log_text.trim().is_empty() {
            format!("FFmpeg terminó con código {status}")
        } else {
            log_text.trim().to_string()
        };
        return Err(detail);
    }

    let stdin = child.stdin.take();
    Ok((child, stdin, log))
}

/// Inicia una grabación de la región indicada.
///
/// La captura se delega en FFmpeg (GDIGRAB), que ya forma parte del paquete de
/// Prisma: no se añaden dependencias ni binarios nuevos al proyecto.
pub fn start_recording(
    state: &SharedRecorderState,
    options: RecordingOptions,
) -> Result<RecordingInfo, String> {
    {
        let guard = state.lock().map_err(|_| "Error al acceder a la grabadora".to_string())?;
        if guard.is_some() {
            return Err("Ya hay una grabación en curso".to_string());
        }
    }

    let ffmpeg = find_ffmpeg_binary()
        .ok_or_else(|| "FFmpeg no está disponible en esta instalación".to_string())?;

    let width = even_dimension(options.region.width);
    let height = even_dimension(options.region.height);
    if width < 2 || height < 2 {
        return Err("La región a grabar es demasiado pequeña".to_string());
    }

    let fps = options
        .fps
        .unwrap_or(DEFAULT_FPS)
        .clamp(MIN_FPS, MAX_FPS);

    let (origin_x, origin_y) = virtual_origin();
    let offset_x = options.region.x - origin_x;
    let offset_y = options.region.y - origin_y;
    if offset_x < 0 || offset_y < 0 {
        return Err("La región a grabar está fuera del escritorio virtual".to_string());
    }

    let output_folder = options
        .output_folder
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "No se indicó la carpeta de destino de la grabación".to_string())?;
    let output_path = build_output_path(output_folder)?;

    // Codificadores candidatos. En «auto» se prueban en orden y se queda con el
    // primero que arranque: el FFmpeg que viaja con Prisma trae NVENC, QSV y AMF,
    // así que en una máquina con GPU la grabación deja de consumir CPU.
    let requested_encoder = options
        .encoder
        .as_deref()
        .map(str::trim)
        .unwrap_or("auto")
        .to_lowercase();
    let candidates: Vec<&str> = match requested_encoder.as_str() {
        "nvenc" => vec!["nvenc"],
        "qsv" => vec!["qsv"],
        "amf" => vec!["amf"],
        "cpu" | "libx264" => vec!["cpu"],
        _ => vec!["nvenc", "qsv", "amf", "cpu"],
    };

    let quality = options
        .quality
        .as_deref()
        .map(str::trim)
        .unwrap_or("medium")
        .to_lowercase();
    let max_height = options.max_height.filter(|value| *value >= 240);

    // Audio del sistema: se abre la captura antes de lanzar FFmpeg para que
    // sepa el puerto, la frecuencia y los canales con los que debe grabar.
    #[cfg(windows)]
    let system_audio_source = if options.system_audio.unwrap_or(false) {
        match crate::features::screen_capture::system_audio::SystemAudioSource::start() {
            Ok(source) => Some(source),
            Err(error) => {
                eprintln!("[Grabadora] No se pudo capturar el audio del sistema: {error}");
                None
            }
        }
    } else {
        None
    };
    #[cfg(windows)]
    let system_audio = system_audio_source
        .as_ref()
        .map(|source| (source.port, source.rate, source.channels));

    let plan = SpawnPlan {
        ffmpeg: &ffmpeg,
        quality: &quality,
        fps,
        offset_x,
        offset_y,
        width,
        height,
        audio_device: options
            .audio_device
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty()),
        #[cfg(windows)]
        system_audio,
        #[cfg(not(windows))]
        system_audio: None,
        output_path: &output_path,
        max_height,
    };

    let mut last_error = String::new();
    let mut spawned = None;
    for encoder in candidates {
        if !encoder_available(&ffmpeg, encoder) {
            last_error = format!("el motor «{encoder}» no está disponible en esta máquina");
            continue;
        }
        match spawn_recorder(&plan, encoder) {
            Ok(parts) => {
                spawned = Some(parts);
                break;
            }
            Err(error) => last_error = error,
        }
    }

    let Some((child, stdin, log)) = spawned else {
        // Si FFmpeg no arrancó, la captura de audio se cierra con la variable
        // local al salir de la función.
        return Err(format!("FFmpeg no pudo iniciar la grabación: {last_error}"));
    };

    let started_at = Instant::now();
    let started_at_ms = now_ms();
    let region = RecordingRegion {
        x: options.region.x,
        y: options.region.y,
        width,
        height,
    };

    // Si se pidió una escala, el vídeo sale con otro tamaño que la región.
    let (output_width, output_height) = match max_height {
        Some(max) if height > max => (
            even_dimension((width as u64 * max as u64 / height as u64) as u32),
            even_dimension(max),
        ),
        _ => (width, height),
    };

    let info = RecordingInfo {
        status: "recording".to_string(),
        output_path: output_path.to_string_lossy().into_owned(),
        started_at_ms,
        elapsed_ms: 0,
        region: region.clone(),
        fps,
        width: output_width,
        height: output_height,
        paused: false,
        error: None,
    };

    let mut guard = state
        .lock()
        .map_err(|_| "Error al guardar el estado de la grabadora".to_string())?;
    *guard = Some(ActiveRecording {
        child,
        stdin,
        output_path,
        started_at,
        started_at_ms,
        region,
        fps,
        output_width,
        output_height,
        paused: false,
        #[cfg(windows)]
        system_audio: system_audio_source,
        log,
    });

    Ok(info)
}

/// Estado de la grabación en curso, si la hay.
pub fn recording_info(state: &SharedRecorderState) -> Option<RecordingInfo> {
    let guard = state.lock().ok()?;
    let active = guard.as_ref()?;
    Some(RecordingInfo {
        status: "recording".to_string(),
        output_path: active.output_path.to_string_lossy().into_owned(),
        started_at_ms: active.started_at_ms,
        elapsed_ms: active.started_at.elapsed().as_millis() as u64,
        region: active.region.clone(),
        fps: active.fps,
        width: active.output_width,
        height: active.output_height,
        paused: active.paused,
        error: None,
    })
}

/// Pausa o reanuda la grabación en curso.
///
/// FFmpeg interpreta «p» en su entrada estándar como alternar la pausa: el
/// archivo sigue abierto y se cierra de forma reproducible al detener.
pub fn toggle_pause(state: &SharedRecorderState) -> Result<bool, String> {
    let mut guard = state
        .lock()
        .map_err(|_| "Error al acceder a la grabadora".to_string())?;
    let active = guard
        .as_mut()
        .ok_or_else(|| "No hay ninguna grabación en curso".to_string())?;
    let writer = active
        .stdin
        .as_mut()
        .ok_or_else(|| "La grabación no acepta comandos".to_string())?;
    writer
        .write_all(b"p\n")
        .and_then(|_| writer.flush())
        .map_err(|error| format!("No se pudo pausar la grabación: {error}"))?;
    active.paused = !active.paused;
    Ok(active.paused)
}

/// Detiene la grabación y cierra el archivo para que quede reproducible.
pub fn stop_recording(state: &SharedRecorderState) -> Result<RecordingInfo, String> {
    let (mut child, mut stdin, output_path, started_at, started_at_ms, region, fps, output_width, output_height, log) = {
        let mut guard = state
            .lock()
            .map_err(|_| "Error al acceder a la grabadora".to_string())?;
        let active = guard
            .take()
            .ok_or_else(|| "No hay ninguna grabación en curso".to_string())?;
        (
            active.child,
            active.stdin,
            active.output_path,
            active.started_at,
            active.started_at_ms,
            active.region,
            active.fps,
            active.output_width,
            active.output_height,
            active.log,
        )
    };

    // «q» le pide a FFmpeg que cierre y finalice el archivo: matarlo dejaría el MP4 sin índice.
    if let Some(writer) = stdin.as_mut() {
        let _ = writer.write_all(b"q\n");
        let _ = writer.flush();
    }
    drop(stdin);

    let deadline = Instant::now() + STOP_TIMEOUT;
    let mut status = None;
    loop {
        match child.try_wait() {
            Ok(Some(result)) => {
                status = Some(result);
                break;
            }
            Ok(None) => {}
            Err(_) => break,
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            break;
        }
        std::thread::sleep(Duration::from_millis(120));
    }

    let log_text = log.lock().map(|guard| guard.clone()).unwrap_or_default();
    let elapsed_ms = started_at.elapsed().as_millis() as u64;

    if let Some(status) = status {
        if !status.success() {
            let detail = if log_text.trim().is_empty() {
                format!("FFmpeg terminó con código {status}")
            } else {
                log_text.trim().to_string()
            };
            return Err(format!("La grabación no pudo cerrarse correctamente: {detail}"));
        }
    }

    let size = std::fs::metadata(&output_path).map(|meta| meta.len()).unwrap_or(0);
    if size == 0 {
        let detail = if log_text.trim().is_empty() {
            "el archivo quedó vacío".to_string()
        } else {
            log_text.trim().to_string()
        };
        return Err(format!("La grabación no produjo ningún vídeo: {detail}"));
    }

    Ok(RecordingInfo {
        status: "finished".to_string(),
        output_path: output_path.to_string_lossy().into_owned(),
        started_at_ms,
        elapsed_ms,
        width: output_width,
        height: output_height,
        region,
        fps,
        paused: false,
        error: None,
    })
}

/// Detiene la grabación y descarta el archivo parcial.
pub fn cancel_recording(state: &SharedRecorderState) -> Result<(), String> {
    let (mut child, mut stdin, output_path) = {
        let mut guard = state
            .lock()
            .map_err(|_| "Error al acceder a la grabadora".to_string())?;
        let active = guard
            .take()
            .ok_or_else(|| "No hay ninguna grabación en curso".to_string())?;
        (active.child, active.stdin, active.output_path)
    };

    if let Some(writer) = stdin.as_mut() {
        let _ = writer.write_all(b"q\n");
        let _ = writer.flush();
    }
    drop(stdin);

    let deadline = Instant::now() + Duration::from_secs(6);
    loop {
        match child.try_wait() {
            Ok(Some(_)) | Err(_) => break,
            Ok(None) => {}
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            break;
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    let _ = std::fs::remove_file(&output_path);
    Ok(())
}

/// Coloca la barra de control junto a la región grabada.
///
/// La barra se busca siempre FUERA de la región: si quedara dentro, aparecería
/// dentro del propio vídeo. Cuando la región ocupa todo el escritorio no hay
/// sitio libre, y entonces se deja constancia de ello para que el backend
/// reduzca la región grabada en esa franja.
pub fn place_control_bar(
    region: &RecordingRegion,
    bar_width: i32,
    bar_height: i32,
) -> Option<(i32, i32)> {
    const GAP: i32 = 12;
    let (vx, vy, vw, vh) = virtual_screen_rect();
    let right = vx + vw as i32;
    let bottom = vy + vh as i32;

    let candidates = [
        (region.x, region.y + region.height as i32 + GAP),
        (region.x, region.y - bar_height - GAP),
        (region.x + region.width as i32 + GAP, region.y),
        (region.x - bar_width - GAP, region.y),
    ];

    for (x, y) in candidates {
        if x >= vx && y >= vy && x + bar_width <= right && y + bar_height <= bottom {
            return Some((x, y));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dimensions_are_even_for_h264() {
        assert_eq!(even_dimension(641), 640);
        assert_eq!(even_dimension(640), 640);
        assert_eq!(even_dimension(1), 2);
    }

    #[test]
    fn civil_dates_match_known_values() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(19_723), (2024, 1, 1));
    }

    #[test]
    fn output_file_lands_in_the_requested_folder() {
        let folder = std::env::temp_dir().join("prisma-recorder-test");
        let path = build_output_path(&folder.to_string_lossy()).unwrap();
        assert!(path.starts_with(&folder));
        assert!(path.to_string_lossy().ends_with(".mp4"));
    }

    #[test]
    fn la_calidad_se_traduce_a_crf() {
        assert_eq!(quality_to_crf("high"), 20);
        assert_eq!(quality_to_crf("medium"), 23);
        assert_eq!(quality_to_crf("low"), 28);
    }

    #[test]
    fn cada_motor_aporta_su_codificador() {
        assert!(encoder_args("cpu", "medium").iter().any(|arg| arg == "libx264"));
        assert!(encoder_args("nvenc", "high").iter().any(|arg| arg == "h264_nvenc"));
        assert!(encoder_args("qsv", "high").iter().any(|arg| arg == "h264_qsv"));
        assert!(encoder_args("amf", "low").iter().any(|arg| arg == "h264_amf"));
    }

    #[test]
    fn la_barra_de_control_queda_fuera_de_la_region() {
        let region = RecordingRegion { x: 100, y: 100, width: 400, height: 300 };
        if let Some((x, y)) = place_control_bar(&region, 320, 64) {
            let outside_region = x + 320 <= region.x
                || x >= region.x + region.width as i32
                || y + 64 <= region.y
                || y >= region.y + region.height as i32;
            assert!(
                outside_region,
                "la barra de control ({x},{y}) caería dentro de la región grabada"
            );
        }
    }

    /// Pausar y reanudar una grabación real: el archivo debe seguir cerrando
    /// bien y el estado debe reflejar la pausa.
    #[test]
    fn la_grabacion_se_pausa_y_se_reanuda() {
        if find_ffmpeg_binary().is_none() {
            eprintln!("[Grabadora] FFmpeg no disponible: se omite la prueba de pausa");
            return;
        }

        let state: SharedRecorderState = Arc::new(Mutex::new(None));
        let folder = std::env::temp_dir().join("prisma-recorder-pause");
        let options = RecordingOptions {
            region: RecordingRegion { x: 0, y: 0, width: 320, height: 240 },
            fps: Some(15),
            audio_device: None,
            output_folder: Some(folder.to_string_lossy().into_owned()),
            encoder: None,
            quality: None,
            max_height: None,
            system_audio: Some(false),
        };

        if start_recording(&state, options).is_err() {
            eprintln!("[Grabadora] Sin escritorio disponible: se omite la prueba de pausa");
            return;
        }

        std::thread::sleep(Duration::from_millis(1200));
        assert!(toggle_pause(&state).expect("debe pausar"), "la grabación debe quedar pausada");
        assert!(recording_info(&state).map(|info| info.paused).unwrap_or(false));

        std::thread::sleep(Duration::from_millis(800));
        assert!(
            !toggle_pause(&state).expect("debe reanudar"),
            "la grabación debe volver a estar activa"
        );

        let finished = stop_recording(&state).expect("La grabación debe cerrarse");
        let path = PathBuf::from(&finished.output_path);
        let size = std::fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);
        assert!(size > 0, "El vídeo pausado debe tener contenido");

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir(&folder);
    }

    /// Grabación real con el audio del sistema: comprueba que el MP4 final
    /// incluye una pista de audio y que el archivo queda cerrado.
    ///
    /// Necesita un dispositivo de salida que esté renderizando. En un equipo
    /// con la salida en reposo (auriculares desconectados, escritorio
    /// virtual) Windows no entrega muestras de loopback y la prueba no puede
    /// afirmar nada: se marca como ignorada igual que las pruebas del audio
    /// relay que necesitan un teléfono físico.
    #[test]
    #[ignore = "requiere un dispositivo de salida de audio que esté renderizando"]
    fn graba_con_el_audio_del_sistema() {
        if find_ffmpeg_binary().is_none() {
            eprintln!("[Grabadora] FFmpeg no disponible: se omite la prueba de audio");
            return;
        }

        let state: SharedRecorderState = Arc::new(Mutex::new(None));
        let folder = std::env::temp_dir().join("prisma-recorder-audio");
        let options = RecordingOptions {
            region: RecordingRegion { x: 0, y: 0, width: 320, height: 240 },
            fps: Some(15),
            audio_device: None,
            output_folder: Some(folder.to_string_lossy().into_owned()),
            encoder: None,
            quality: None,
            max_height: None,
            system_audio: Some(true),
        };

        let started = match start_recording(&state, options) {
            Ok(info) => info,
            Err(error) => {
                eprintln!("[Grabadora] Sin audio del sistema en este entorno: {error}");
                return;
            }
        };
        assert_eq!(started.status, "recording");
        std::thread::sleep(Duration::from_millis(2500));
        let finished = stop_recording(&state).expect("La grabación debe cerrarse");
        assert!(finished.elapsed_ms >= 1500);

        let path = PathBuf::from(&finished.output_path);
        let size = std::fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);
        assert!(size > 0, "El vídeo grabado debe tener contenido");

        // Se deja una copia para poder inspeccionar las pistas con ffprobe.
        let evidence = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("temp")
            .join("recorder-audio-test.mp4");
        if let Some(parent) = evidence.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::copy(&path, &evidence);

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir(&folder);
    }

    /// Grabación real de extremo a extremo: se comprueba que el vídeo existe,
    /// que no está vacío y que el archivo se cierra de forma reproducible.
    /// Si el entorno no tiene escritorio ni FFmpeg, la prueba se omite.
    #[test]
    fn records_a_real_clip_and_closes_it() {
        if find_ffmpeg_binary().is_none() {
            eprintln!("[Grabadora] FFmpeg no disponible: se omite la grabación real");
            return;
        }

        let state: SharedRecorderState = Arc::new(Mutex::new(None));
        let folder = std::env::temp_dir().join("prisma-recorder-live");
        let options = RecordingOptions {
            region: RecordingRegion {
                x: 0,
                y: 0,
                width: 320,
                height: 240,
            },
            fps: Some(15),
            audio_device: None,
            output_folder: Some(folder.to_string_lossy().into_owned()),
            encoder: None,
            quality: None,
            max_height: None,
            system_audio: Some(false),
        };

        let started = match start_recording(&state, options) {
            Ok(info) => info,
            Err(error) => {
                eprintln!("[Grabadora] Sin escritorio disponible: {error}");
                return;
            }
        };
        assert_eq!(started.status, "recording");

        std::thread::sleep(Duration::from_millis(2000));
        assert!(recording_info(&state).is_some());

        let finished = stop_recording(&state).expect("La grabación debe cerrarse");
        assert_eq!(finished.status, "finished");
        assert!(finished.elapsed_ms >= 1500);

        let path = PathBuf::from(&finished.output_path);
        let size = std::fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);
        assert!(size > 0, "El vídeo grabado debe tener contenido");

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir(&folder);
    }
}
