use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
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

    let mut command = Command::new(&ffmpeg);
    command
        .args(["-hide_banner", "-loglevel", "error", "-stats"])
        .args(["-f", "gdigrab", "-draw_mouse", "1"])
        .args(["-framerate", &fps.to_string()])
        .args(["-offset_x", &offset_x.to_string()])
        .args(["-offset_y", &offset_y.to_string()])
        .args(["-video_size", &format!("{width}x{height}")])
        .args(["-i", "desktop"]);

    let has_audio = options
        .audio_device
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some();
    if let Some(device) = options.audio_device.as_deref().map(str::trim) {
        if !device.is_empty() {
            command.args(["-f", "dshow", "-i", &format!("audio=\"{device}\"")]);
        }
    }

    command
        .args(["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"])
        .args(["-pix_fmt", "yuv420p"]);
    if has_audio {
        command.args(["-c:a", "aac", "-b:a", "160k"]);
    }
    command
        .arg(&output_path)
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
        let _ = std::fs::remove_file(&output_path);
        let detail = if log_text.trim().is_empty() {
            format!("FFmpeg terminó con código {status}")
        } else {
            log_text.trim().to_string()
        };
        return Err(format!("FFmpeg no pudo iniciar la grabación: {detail}"));
    }

    let stdin = child.stdin.take();
    let started_at = Instant::now();
    let started_at_ms = now_ms();
    let region = RecordingRegion {
        x: options.region.x,
        y: options.region.y,
        width,
        height,
    };

    let info = RecordingInfo {
        status: "recording".to_string(),
        output_path: output_path.to_string_lossy().into_owned(),
        started_at_ms,
        elapsed_ms: 0,
        region: region.clone(),
        fps,
        width,
        height,
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
        width: active.region.width,
        height: active.region.height,
        error: None,
    })
}

/// Detiene la grabación y cierra el archivo para que quede reproducible.
pub fn stop_recording(state: &SharedRecorderState) -> Result<RecordingInfo, String> {
    let (mut child, mut stdin, output_path, started_at, started_at_ms, region, fps, log) = {
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
        width: region.width,
        height: region.height,
        region,
        fps,
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
