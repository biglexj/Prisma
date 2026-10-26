use std::fs;
use std::path::{Path, PathBuf};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetWallpaperResult {
    pub success: bool,
    pub path: String,
}

fn get_wallpapers_dir() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let pics = Path::new(&user_profile).join("Pictures").join("Prisma Wallpapers");
            if fs::create_dir_all(&pics).is_ok() {
                return pics;
            }
        }
    }
    let temp = std::env::temp_dir().join("Prisma_Wallpapers");
    let _ = fs::create_dir_all(&temp);
    temp
}

/// Guarda una imagen recibida en base64 y la establece como fondo de escritorio en Windows.
#[tauri::command]
pub async fn wallpaper_save_and_apply(
    image_base64: String,
    file_name: String,
) -> Result<SetWallpaperResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let raw_b64 = if let Some(idx) = image_base64.find(";base64,") {
            &image_base64[idx + 8..]
        } else if let Some(stripped) = image_base64.strip_prefix("data:image/") {
            if let Some(idx) = stripped.find(',') {
                &stripped[idx + 1..]
            } else {
                &image_base64
            }
        } else {
            &image_base64
        };

        let bytes = STANDARD
            .decode(raw_b64.trim())
            .map_err(|e| format!("Error al decodificar imagen: {e}"))?;

        if bytes.is_empty() {
            return Err("La imagen descargada está vacía.".to_string());
        }

        let dir = get_wallpapers_dir();
        let safe_name = if file_name.trim().is_empty() {
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            format!("Aurora_Wallpaper_{timestamp}.png")
        } else {
            file_name.trim().to_string()
        };

        let target_path = dir.join(safe_name);
        fs::write(&target_path, bytes)
            .map_err(|e| format!("No se pudo guardar la imagen del fondo: {e}"))?;

        let canonical = target_path
            .canonicalize()
            .unwrap_or(target_path.clone());

        #[cfg(windows)]
        {
            use windows::core::HSTRING;
            use windows::Win32::UI::WindowsAndMessaging::{
                SystemParametersInfoW, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SPI_SETDESKWALLPAPER,
            };

            let wide_str = HSTRING::from(canonical.as_os_str());
            unsafe {
                let res = SystemParametersInfoW(
                    SPI_SETDESKWALLPAPER,
                    0,
                    Some(wide_str.as_ptr() as *mut _),
                    SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
                );
                if let Err(e) = res {
                    return Err(format!("Error de la API de Windows al aplicar fondo: {e}"));
                }
            }
        }

        Ok(SetWallpaperResult {
            success: true,
            path: canonical.to_string_lossy().to_string(),
        })
    })
    .await
    .map_err(|e| format!("Error interno al aplicar fondo: {e}"))?
}

/// Establece una imagen local como fondo de escritorio en Windows.
#[tauri::command]
pub async fn wallpaper_set_desktop(image_path: String) -> Result<SetWallpaperResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&image_path);
        let canonical = path
            .canonicalize()
            .map_err(|e| format!("No se pudo acceder al archivo local: {e}"))?;

        if !canonical.is_file() {
            return Err("La ruta especificada no es un archivo válido.".to_string());
        }

        #[cfg(windows)]
        {
            use windows::core::HSTRING;
            use windows::Win32::UI::WindowsAndMessaging::{
                SystemParametersInfoW, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SPI_SETDESKWALLPAPER,
            };

            let wide_str = HSTRING::from(canonical.as_os_str());
            unsafe {
                let res = SystemParametersInfoW(
                    SPI_SETDESKWALLPAPER,
                    0,
                    Some(wide_str.as_ptr() as *mut _),
                    SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
                );
                if let Err(e) = res {
                    return Err(format!("Error de la API de Windows al aplicar fondo: {e}"));
                }
            }
        }

        Ok(SetWallpaperResult {
            success: true,
            path: canonical.to_string_lossy().to_string(),
        })
    })
    .await
    .map_err(|e| format!("Error interno al aplicar fondo: {e}"))?
}


// ── Comandos de Fondos Vivos (Fase 1: Vídeo multicarpeta local) ──

use crate::features::wallpapers::{
    sources::{FolderSource, MediaKindMode, WallpaperFit, WallpaperMode},
    WallpaperController, WallpaperStateSnapshot,
};
use tauri::{AppHandle, Emitter, Manager, State};

fn notify_wallpaper_change(app: &AppHandle) {
    crate::update_wallpaper_tray_menu(app);
    if let Some(controller) = app.try_state::<WallpaperController>() {
        if let Ok(config) = controller.compositor_config() {
            crate::features::wallpapers::compositor::push_config(app, &config);
            if let Ok(state)=controller.get_state() {
                let desired=config.has_layers();
                if state.is_active && desired!=state.compositor_enabled
                    && !controller.composition_transition.swap(true,std::sync::atomic::Ordering::SeqCst) {
                    let handle=app.clone();let owned=controller.inner().clone();
                    tauri::async_runtime::spawn_blocking(move||{
                        let mut applied=None;
                        if let (Ok(state),Ok(config))=(owned.get_state(),owned.compositor_config()) {
                            if state.is_active {
                                let desired=config.has_layers();
                                match owned.set_compositor_enabled(&handle,desired) {
                                    Ok(_)=>applied=Some(desired),
                                    Err(error)=>{let _=handle.emit("prisma://compositor-error",error);}
                                }
                            }
                        }
                        owned.composition_transition.store(false,std::sync::atomic::Ordering::SeqCst);
                        if let Ok(config)=owned.compositor_config(){crate::features::wallpapers::compositor::push_config(&handle,&config);}
                        crate::update_wallpaper_tray_menu(&handle);
                        let _=handle.emit("prisma://wallpaper-state-changed",());
                        // Un ajuste puede llegar mientras se está creando la superficie.
                        if let (Some(applied),Ok(latest))=(applied,owned.compositor_config()) {
                            if applied!=latest.has_layers() { notify_wallpaper_change(&handle); }
                        }
                    });
                }
                if state.compositor_enabled { crate::features::wallpapers::compositor::raise(app); }
            }
        }
    }
    let _ = app.emit("prisma://wallpaper-state-changed", ());
}

#[tauri::command]
pub fn live_wallpaper_stop_base(app:AppHandle,controller:State<'_,WallpaperController>) -> Result<WallpaperStateSnapshot,String> {
    let result=controller.stop_base();notify_wallpaper_change(&app);result
}

#[tauri::command]
pub fn live_wallpaper_get_state(
    controller: State<'_, WallpaperController>,
) -> Result<WallpaperStateSnapshot, String> {
    controller.get_state()
}

#[tauri::command]
pub fn live_wallpaper_start(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.start();
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_play_file(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    path: String,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.play_file(&path);
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_pause(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.pause();
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_resume(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.resume();
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_next(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.next();
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_prev(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.prev();
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_stop(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.stop();
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_add_folder(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    path: String,
) -> Result<FolderSource, String> {
    let res = controller.add_folder(&path);
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_remove_folder(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    id: String,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.remove_folder(&id);
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_toggle_folder(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    id: String,
    enabled: bool,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.toggle_folder(&id, enabled);
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_refresh_sources(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.refresh_sources();
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_set_mode(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    mode: WallpaperMode,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.set_mode(mode);
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_set_fit(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    fit: WallpaperFit,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.set_fit(fit);
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_set_audio_enabled(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    enabled: bool,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.set_audio_enabled(enabled);
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_set_folder_hidden(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    id: String,
    hidden: bool,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.set_folder_hidden(&id, hidden);
    notify_wallpaper_change(&app);
    res
}

/// Oculta o muestra un medio concreto (vídeo o imagen).
#[tauri::command]
pub fn live_wallpaper_set_media_hidden(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    path: String,
    hidden: bool,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.set_media_hidden(&path, hidden);
    notify_wallpaper_change(&app);
    res
}

/// Cambia el tipo de medio que entra en la cola y en la cuadrícula.
/// Valores admitidos: "video" (por defecto), "image" y "mixed".
#[tauri::command]
pub fn live_wallpaper_set_media_kind_mode(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    mode: String,
) -> Result<WallpaperStateSnapshot, String> {
    let parsed = MediaKindMode::parse(&mode)?;
    let res = controller.set_media_kind_mode(parsed);
    notify_wallpaper_change(&app);
    res
}

/// Segundos que una imagen estática permanece en pantalla.
#[tauri::command]
pub fn live_wallpaper_set_image_duration(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    seconds: u32,
) -> Result<WallpaperStateSnapshot, String> {
    let res = controller.set_image_duration(seconds);
    notify_wallpaper_change(&app);
    res
}

/// Monta o desmonta la composición de escritorio (capas 2 a 6 del modelo).
/// La superficie web se cuelga del contenedor del escritorio: queda por encima
/// de la capa de vídeo y por debajo de la capa de iconos.
#[tauri::command]
pub async fn live_wallpaper_compositor_set(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    enabled: bool,
) -> Result<WallpaperStateSnapshot, String> {
    let owned = controller.inner().clone();
    let handle = app.clone();
    let res = tauri::async_runtime::spawn_blocking(move || owned.set_compositor_enabled(&handle, enabled))
        .await.map_err(|e| e.to_string())?;
    notify_wallpaper_change(&app);
    res
}

#[tauri::command]
pub fn live_wallpaper_compositor_config_get(
    controller: State<'_, WallpaperController>,
) -> Result<crate::features::wallpapers::compositor::CompositorConfig, String> {
    controller.compositor_config()
}

/// Solo clics del escritorio para los dos efectos interactivos seleccionados.
#[tauri::command]
pub fn live_wallpaper_compositor_clicks(controller:State<'_,WallpaperController>)->Result<Vec<[f32;2]>,String> {
    controller.poll_interaction()
}

/// Lectura de posición; no instala hooks ni intercepta clics del escritorio.
#[tauri::command]
pub fn live_wallpaper_compositor_pointer(
    controller: State<'_, WallpaperController>,
) -> Result<[f32; 2], String> {
    let config = controller.compositor_config()?;
    if !config.enabled || config.paused || !config.parallax.enabled { return Ok([0.0, 0.0]); }
    #[cfg(windows)]
    {
        use windows::Win32::{Foundation::POINT, UI::WindowsAndMessaging::GetCursorPos};
        let mut point = POINT::default();
        unsafe { GetCursorPos(&mut point).map_err(|e| e.to_string())?; }
        let screen = crate::features::wallpapers::window::ScreenGeometry::current();
        let position = [
            (((point.x - screen.x) as f32 / screen.width.max(1) as f32) * 2.0 - 1.0).clamp(-1.0, 1.0),
            (1.0 - ((point.y - screen.y) as f32 / screen.height.max(1) as f32) * 2.0).clamp(-1.0, 1.0),
        ];
        controller.update_base_parallax(position)?;
        return Ok(position);
    }
    #[cfg(not(windows))]
    Ok([0.0, 0.0])
}

#[tauri::command]
pub fn live_wallpaper_compositor_config_set(
    app: AppHandle,
    controller: State<'_, WallpaperController>,
    config: crate::features::wallpapers::compositor::CompositorConfig,
) -> Result<(), String> {
    controller.set_compositor_config(config)?;
    notify_wallpaper_change(&app);
    Ok(())
}
