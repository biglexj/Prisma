use serde::{Deserialize, Serialize};
use tauri::State;

use crate::features::synapse::{
    send_file_to_device_sync, SynapseDiscoveredDevice, SynapseDiscoveryService, SynapseState,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SynapseStatusInfo {
    pub beacon_active: bool,
    pub server_active: bool,
    pub port: u16,
    pub beacon_port: u16,
    pub device_name: String,
    pub downloads_dir: String,
}

#[tauri::command]
pub fn synapse_get_status(state: State<'_, SynapseState>) -> SynapseStatusInfo {
    let device_name = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "PC-Biglex".to_string());

    SynapseStatusInfo {
        beacon_active: true,
        server_active: true,
        port: 49288,
        beacon_port: 49289,
        device_name,
        downloads_dir: state.get_downloads_dir().to_string_lossy().to_string(),
    }
}

#[tauri::command]
pub fn synapse_set_downloads_dir(
    new_dir: String,
    state: State<'_, SynapseState>,
) -> Result<String, String> {
    state.set_downloads_dir(new_dir)
}

#[tauri::command]
pub fn synapse_get_downloads_dir(state: State<'_, SynapseState>) -> String {
    state.get_downloads_dir().to_string_lossy().to_string()
}

#[tauri::command]
pub fn synapse_get_discovered_devices(
    discovery: State<'_, SynapseDiscoveryService>,
) -> Vec<SynapseDiscoveredDevice> {
    discovery.get_devices()
}

#[tauri::command]
pub async fn synapse_send_file_to_device(
    app: tauri::AppHandle,
    target_ip: String,
    target_port: u16,
    file_path: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = std::path::Path::new(&file_path);
        send_file_to_device_sync(&app, &target_ip, target_port, p)
    })
    .await
    .map_err(|e| format!("Error en tarea de envío: {e}"))?
}

#[tauri::command]
pub fn synapse_update_playback(
    status: crate::features::synapse::SynapsePlaybackStatus,
    state: State<'_, SynapseState>,
) -> Result<(), String> {
    state.set_playback_status(status);
    Ok(())
}

#[tauri::command]
pub async fn launch_luna_fetch(
    url: Option<String>,
    format: Option<String>,
    quality: Option<String>,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;

            // 1. Si se envía una URL, intentar lanzar vía protocolo lunafetch:// con parámetros
            if let Some(ref target_url) = url {
                let trimmed = target_url.trim();
                if !trimmed.is_empty() {
                    let mut proto = format!("lunafetch://download?url={}", trimmed);
                    if let Some(ref fmt) = format {
                        if !fmt.trim().is_empty() {
                            proto.push_str(&format!("&format={}", fmt.trim()));
                        }
                    }
                    if let Some(ref q) = quality {
                        if !q.trim().is_empty() {
                            proto.push_str(&format!("&quality={}", q.trim()));
                        }
                    }
                    if let Ok(mut child) = Command::new("cmd").args(["/C", "start", "", &proto]).spawn() {
                        let _ = child.wait();
                        return Ok(true);
                    }
                }
            }

            // 2. Comprobar ejecutables instalados de LunaFetch
            let mut candidates = Vec::new();
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                candidates.push(std::path::PathBuf::from(&local_app_data).join("Programs").join("LunaFetch").join("LunaFetch.exe"));
                candidates.push(std::path::PathBuf::from(&local_app_data).join("LunaFetch").join("LunaFetch.exe"));
            }
            if let Ok(prog_files) = std::env::var("ProgramFiles") {
                candidates.push(std::path::PathBuf::from(&prog_files).join("LunaFetch").join("LunaFetch.exe"));
                candidates.push(std::path::PathBuf::from(&prog_files).join("Luna Fetch").join("LunaFetch.exe"));
            }
            // Ubicación del repositorio en desarrollo
            candidates.push(std::path::PathBuf::from(r"D:\Proyectos\biglexj\Luna---Fetch\release\LunaFetch.exe"));

            for cand in candidates {
                if cand.exists() {
                    let mut cmd = Command::new(&cand);
                    if let Some(ref u) = url {
                        if !u.trim().is_empty() {
                            cmd.arg(u.trim());
                        }
                    }
                    if let Some(ref fmt) = format {
                        if !fmt.trim().is_empty() {
                            cmd.args(["--format", fmt.trim()]);
                        }
                    }
                    if let Some(ref q) = quality {
                        if !q.trim().is_empty() {
                            cmd.args(["--quality", q.trim()]);
                        }
                    }
                    if let Ok(_) = cmd.spawn() {
                        return Ok(true);
                    }
                }
            }

            // 3. Intento genérico vía protocolo
            if let Ok(mut child) = Command::new("cmd").args(["/C", "start", "", "lunafetch:"]).spawn() {
                let _ = child.wait();
                return Ok(true);
            }

            Ok(false)
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = (url, format, quality);
            Ok(false)
        }
    })
    .await
    .map_err(|e| format!("Error al iniciar Luna Fetch: {e}"))?
}

#[tauri::command]
pub async fn launch_gallery_dl(
    url: Option<String>,
    directory_structure: Option<String>,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            use std::io::Write;
            use std::net::TcpStream;
            use std::process::Command;
            use std::time::Duration;

            // 1. Si se envía una URL, intentar POST directo a InterceptionServer (puertos 18274 prod y 18284 dev)
            if let Some(ref target_url) = url {
                let trimmed = target_url.trim();
                if !trimmed.is_empty() {
                    let struct_val = directory_structure.as_deref().unwrap_or("Flat");
                    let ports = [18274, 18284];
                    for port in ports {
                        if let Ok(mut stream) = TcpStream::connect_timeout(
                            &std::net::SocketAddr::from(([127, 0, 0, 1], port)),
                            Duration::from_millis(400),
                        ) {
                            let _ = stream.set_write_timeout(Some(Duration::from_millis(400)));
                            let json_body = format!(
                                r#"{{"url":"{}","directoryStructure":"{}"}}"#,
                                trimmed.replace('\\', "\\\\").replace('"', "\\\""),
                                struct_val.replace('\\', "\\\\").replace('"', "\\\"")
                            );
                            let req = format!(
                                "POST /download HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                port,
                                json_body.len(),
                                json_body
                            );
                            if stream.write_all(req.as_bytes()).is_ok() {
                                return Ok(true);
                            }
                        }
                    }
                }
            }

            // 2. Comprobar ejecutables instalados de Gallery-DL GUI
            let mut candidates = Vec::new();
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                candidates.push(std::path::PathBuf::from(&local_app_data).join("Programs").join("GalleryDL-GUI").join("GalleryDL-GUI.exe"));
                candidates.push(std::path::PathBuf::from(&local_app_data).join("GalleryDL-GUI").join("GalleryDL-GUI.exe"));
            }
            if let Ok(prog_files) = std::env::var("ProgramFiles") {
                candidates.push(std::path::PathBuf::from(&prog_files).join("GalleryDL-GUI").join("GalleryDL-GUI.exe"));
                candidates.push(std::path::PathBuf::from(&prog_files).join("Gallery-DL GUI").join("GalleryDL-GUI.exe"));
            }
            // Ubicación del repositorio en desarrollo
            candidates.push(std::path::PathBuf::from(r"D:\Proyectos\biglexj\Gallery-DL-GUI\release\GalleryDL-GUI.exe"));

            for cand in candidates {
                if cand.exists() {
                    let mut cmd = Command::new(&cand);
                    if let Some(ref u) = url {
                        if !u.trim().is_empty() {
                            cmd.arg(u.trim());
                        }
                    }
                    if let Ok(_) = cmd.spawn() {
                        return Ok(true);
                    }
                }
            }

            // 3. Fallback: intentar invocar por comando directo en PATH o protocolo
            if let Ok(mut child) = Command::new("cmd").args(["/C", "start", "", "gallerydl:"]).spawn() {
                let _ = child.wait();
                return Ok(true);
            }

            Ok(false)
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = (url, directory_structure);
            Ok(false)
        }
    })
    .await
    .map_err(|e| format!("Error al iniciar Gallery-DL GUI: {e}"))?
}

#[tauri::command]
pub async fn launch_prisma_upscaler(
    file_path: Option<String>,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;

            let mut candidates = Vec::new();
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                candidates.push(std::path::PathBuf::from(&local_app_data).join("Programs").join("PrismaUpscaler").join("PrismaUpscaler.exe"));
                candidates.push(std::path::PathBuf::from(&local_app_data).join("Programs").join("prisma-upscaler").join("prisma-upscaler.exe"));
                candidates.push(std::path::PathBuf::from(&local_app_data).join("Programs").join("prisma-upscaler").join("prisma-upscaler-desktop.exe"));
                candidates.push(std::path::PathBuf::from(&local_app_data).join("PrismaUpscaler").join("PrismaUpscaler.exe"));
                candidates.push(std::path::PathBuf::from(&local_app_data).join("prisma-upscaler").join("prisma-upscaler.exe"));
            }
            if let Ok(prog_files) = std::env::var("ProgramFiles") {
                candidates.push(std::path::PathBuf::from(&prog_files).join("PrismaUpscaler").join("PrismaUpscaler.exe"));
                candidates.push(std::path::PathBuf::from(&prog_files).join("Prisma Upscaler").join("PrismaUpscaler.exe"));
                candidates.push(std::path::PathBuf::from(&prog_files).join("prisma-upscaler").join("prisma-upscaler.exe"));
            }
            // Ubicaciones del repositorio en desarrollo
            candidates.push(std::path::PathBuf::from(r"D:\Proyectos\biglexj\prisma-upscaler\release\prisma-upscaler.exe"));
            candidates.push(std::path::PathBuf::from(r"D:\Proyectos\biglexj\prisma-upscaler\release\prisma-upscaler-desktop.exe"));
            candidates.push(std::path::PathBuf::from(r"D:\Proyectos\biglexj\prisma-upscaler\desktop\src-tauri\target\release\prisma-upscaler-desktop.exe"));
            candidates.push(std::path::PathBuf::from(r"D:\Proyectos\biglexj\prisma-upscaler\target\release\prisma-upscaler.exe"));

            for cand in candidates {
                if cand.exists() {
                    let mut cmd = Command::new(&cand);
                    if let Some(ref path) = file_path {
                        let trimmed = path.trim();
                        if !trimmed.is_empty() {
                            cmd.arg(trimmed);
                        }
                    }
                    if let Ok(_) = cmd.spawn() {
                        return Ok(true);
                    }
                }
            }

            // Fallback genérico vía comando directo o protocolo
            if let Ok(mut child) = Command::new("cmd").args(["/C", "start", "", "prismaupscaler:"]).spawn() {
                let _ = child.wait();
                return Ok(true);
            }

            Ok(false)
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = file_path;
            Ok(false)
        }
    })
    .await
    .map_err(|e| format!("Error al iniciar Prisma Upscaler: {e}"))?
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUpscaleResult {
    pub success: bool,
    pub output_path: String,
    pub duration_secs: f64,
    pub error: Option<String>,
}

pub fn find_prisma_upscaler_engine() -> Option<(std::path::PathBuf, std::path::PathBuf)> {
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();

    // 1. AppData canónico en Windows: %LOCALAPPDATA%\PrismaUpscaler\engine
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        candidates.push(std::path::PathBuf::from(&local_app_data).join("PrismaUpscaler").join("engine"));
        candidates.push(std::path::PathBuf::from(&local_app_data).join("Programs").join("PrismaUpscaler").join("engine"));
        candidates.push(std::path::PathBuf::from(&local_app_data).join("prisma-upscaler").join("engine"));
    }

    // 2. Directorios de desarrollo del monorepo / proyectos biglexj
    candidates.push(std::path::PathBuf::from(r"D:\Proyectos\biglexj\prisma-upscaler\desktop\src-tauri\engine"));
    candidates.push(std::path::PathBuf::from(r"D:\Proyectos\biglexj\prisma-upscaler\release\engine"));
    candidates.push(std::path::PathBuf::from(r"D:\Proyectos\biglexj\prisma-upscaler\engine"));

    // 3. ProgramFiles
    if let Ok(prog_files) = std::env::var("ProgramFiles") {
        candidates.push(std::path::PathBuf::from(&prog_files).join("PrismaUpscaler").join("engine"));
        candidates.push(std::path::PathBuf::from(&prog_files).join("Prisma Upscaler").join("engine"));
        candidates.push(std::path::PathBuf::from(&prog_files).join("prisma-upscaler").join("engine"));
    }

    // 4. Junto al ejecutable de Prisma
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("engine"));
            candidates.push(parent.join("..").join("..").join("prisma-upscaler").join("desktop").join("src-tauri").join("engine"));
        }
    }

    for dir in candidates {
        let bin = dir.join("realesrgan-ncnn-vulkan.exe");
        let models = dir.join("models");
        if bin.exists() && models.exists() {
            return Some((bin, models));
        }
    }

    None
}

#[tauri::command]
pub fn check_prisma_upscaler_engine() -> bool {
    find_prisma_upscaler_engine().is_some()
}

#[tauri::command]
pub async fn upscale_image_native(
    input_path: String,
    scale: u32,
    model: String,
    custom_output_dir: Option<String>,
) -> Result<NativeUpscaleResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (bin_path, models_dir) = match find_prisma_upscaler_engine() {
            Some(res) => res,
            None => {
                return Ok(NativeUpscaleResult {
                    success: false,
                    output_path: String::new(),
                    duration_secs: 0.0,
                    error: Some("El motor de inferencia Vulkan de Prisma Upscaler no se encuentra instalado en este equipo.".to_string()),
                });
            }
        };

        let engine_dir = match bin_path.parent() {
            Some(p) => p.to_path_buf(),
            None => {
                return Err("No se pudo determinar el directorio del motor.".to_string());
            }
        };

        let in_path = std::path::PathBuf::from(&input_path);
        if !in_path.exists() {
            return Err("El archivo de imagen no existe.".to_string());
        }

        let start_time = std::time::Instant::now();

        let file_stem = in_path.file_stem().and_then(|s| s.to_str()).unwrap_or("imagen");
        let ext = in_path.extension().and_then(|e| e.to_str()).unwrap_or("png");
        let out_file_name = format!("{}_upscaled_{}x.{}", file_stem, scale, ext);

        let out_dir = if let Some(ref custom) = custom_output_dir {
            let p = std::path::PathBuf::from(custom);
            if !p.as_os_str().is_empty() {
                p
            } else {
                in_path.parent().unwrap_or_else(|| std::path::Path::new(".")).to_path_buf()
            }
        } else {
            in_path.parent().unwrap_or_else(|| std::path::Path::new(".")).to_path_buf()
        };

        if !out_dir.exists() {
            let _ = std::fs::create_dir_all(&out_dir);
        }

        let final_output_path = out_dir.join(&out_file_name);

        let normalized_model = match model.trim().to_lowercase().as_str() {
            "digital-art" | "arte-digital" | "anime" => "realesrgan-x4plus-anime",
            "photo" | "foto" | "general" => "realesrgan-x4plus",
            "remacri" => "remacri",
            "ultrasharp" | "ultra-sharp" => "ultrasharp",
            "ultramix" | "ultramix_balanced" => "ultramix_balanced",
            "siax_anime" => "siax_anime",
            "realesr-animevideov3-x4" => "realesr-animevideov3-x4",
            m if m.contains("animesharp") => "animesharp",
            other if !other.is_empty() => model.as_str(),
            _ => "realesrgan-x4plus-anime",
        };

        let is_downscale_needed = scale != 4 && (scale == 2 || scale == 3);
        let actual_engine_scale = if is_downscale_needed { 4 } else { scale };
        let engine_output_path = if is_downscale_needed {
            final_output_path.with_extension("raw_4x_temp.png")
        } else {
            final_output_path.clone()
        };

        let models_arg = if models_dir.starts_with(&engine_dir) {
            "models"
        } else {
            models_dir.to_str().unwrap_or("models")
        };

        let tile_candidates = ["64", "32"];
        let mut engine_succeeded = false;
        let mut last_error_msg = String::new();

        for tile in tile_candidates {
            #[cfg(target_os = "windows")]
            use std::os::windows::process::CommandExt;

            let mut cmd = std::process::Command::new(&bin_path);
            cmd.current_dir(&engine_dir)
                .arg("-i").arg(&in_path)
                .arg("-o").arg(&engine_output_path)
                .arg("-s").arg(actual_engine_scale.to_string())
                .arg("-m").arg(models_arg)
                .arg("-n").arg(normalized_model)
                .arg("-g").arg("0")
                .arg("-t").arg(tile);

            #[cfg(target_os = "windows")]
            {
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }

            match cmd.output() {
                Ok(output) => {
                    if output.status.success() && engine_output_path.exists() {
                        engine_succeeded = true;
                        break;
                    }
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    let _ = std::fs::remove_file(&engine_output_path);
                    let err = if !stderr.trim().is_empty() { stderr } else { stdout };
                    last_error_msg = err.trim().to_string();
                }
                Err(e) => {
                    last_error_msg = format!("Error al ejecutar binario Vulkan: {e}");
                }
            }
        }

        if !engine_succeeded {
            // En GPUs integradas con VRAM compartida reducida (e.g. AMD Radeon 780M / Intel Iris),
            // si un modelo denso produce vkAllocateMemory failed, reintentar con el modelo ligero de alta compatibilidad.
            if last_error_msg.contains("vkAllocateMemory failed") || last_error_msg.contains("out of device memory") {
                let fallback_model = if normalized_model.contains("anime") || normalized_model.contains("art") || normalized_model.contains("sharp") {
                    "realesrgan-x4plus-anime"
                } else {
                    "realesr-animevideov3-x4"
                };

                if fallback_model != normalized_model {
                    #[cfg(target_os = "windows")]
                    use std::os::windows::process::CommandExt;

                    let mut fallback_cmd = std::process::Command::new(&bin_path);
                    fallback_cmd.current_dir(&engine_dir)
                        .arg("-i").arg(&in_path)
                        .arg("-o").arg(&engine_output_path)
                        .arg("-s").arg(actual_engine_scale.to_string())
                        .arg("-m").arg(models_arg)
                        .arg("-n").arg(fallback_model)
                        .arg("-g").arg("0")
                        .arg("-t").arg("64");

                    #[cfg(target_os = "windows")]
                    {
                        fallback_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                    }

                    if let Ok(out) = fallback_cmd.output() {
                        if out.status.success() && engine_output_path.exists() {
                            engine_succeeded = true;
                        }
                    }
                }
            }
        }

        if !engine_succeeded {
            return Ok(NativeUpscaleResult {
                success: false,
                output_path: String::new(),
                duration_secs: start_time.elapsed().as_secs_f64(),
                error: Some(if !last_error_msg.is_empty() {
                    format!("Error del motor de IA: {last_error_msg}")
                } else {
                    "No se pudo completar el escalado neuronal.".to_string()
                }),
            });
        }

        if is_downscale_needed {
            let temp_path = engine_output_path.clone();
            let target_out = final_output_path.clone();

            match image::open(&temp_path) {
                Ok(img_4x) => {
                    let target_w = ((img_4x.width() as f64 / 4.0) * scale as f64).round() as u32;
                    let target_h = ((img_4x.height() as f64 / 4.0) * scale as f64).round() as u32;
                    let resized = img_4x.resize(
                        target_w.max(1),
                        target_h.max(1),
                        image::imageops::FilterType::Lanczos3,
                    );
                    let _ = resized.save(&target_out);
                    let _ = std::fs::remove_file(&temp_path);
                }
                Err(e) => {
                    let _ = std::fs::rename(&temp_path, &target_out);
                    eprintln!("Aviso: Fallback en redimensionamiento Lanczos3: {e}");
                }
            }
        }

        let duration_secs = start_time.elapsed().as_secs_f64();

        Ok(NativeUpscaleResult {
            success: true,
            output_path: final_output_path.to_string_lossy().to_string(),
            duration_secs,
            error: None,
        })
    })
    .await
    .map_err(|e| format!("Error en tarea de escalado: {e}"))?
}
