mod app;
mod features;
mod infrastructure;

use app::commands::flyout::{
    flyout_get_system_volume, flyout_hide, flyout_is_visible, flyout_set_position,
    flyout_set_system_volume, flyout_show, flyout_configure, flyout_get_audio_peak,
    flyout_get_system_media, flyout_system_media_action, flyout_open_media_app,
};
use app::commands::favorites::{
    favorites_get_all, favorites_is_favorite, favorites_toggle,
};
use app::commands::music_library::{
    music_library_add_excluded_folder, music_library_add_folder, music_library_artwork,
    music_library_list_excluded_folders, music_library_list_folders, music_library_list_items,
    music_library_lyrics, music_library_remove_excluded_folder, music_library_remove_folder,
    music_library_rescan_folder, music_library_scan_duplicates, music_library_scan_folder_tracks,
};
use app::commands::playback::{
    get_initial_file, global_passthru_get_status, global_passthru_list_endpoints,
    global_passthru_set_volume, global_passthru_toggle, playback_capabilities,
    playback_get_audio_devices, playback_get_multi_output, playback_get_global_multi_output_shortcut_error, playback_set_multi_output_devices,
    playback_toggle_multi_output, playback_load, playback_next, playback_pause, playback_previous,
    playback_resume, playback_seek, playback_set_audio_device, playback_set_dsp_config,
    playback_set_speed, playback_set_system_default_device, playback_set_volume,
    playback_snapshot, playback_toggle_pause, smtc_clear, smtc_update_metadata,
    smtc_update_playback, smtc_update_timeline,
};
use app::commands::playlists::{
    playlists_add_files, playlists_add_item, playlists_clean_missing, playlists_create,
    playlists_delete, playlists_import, playlists_list, playlists_read, playlists_relink_folder,
    playlists_relink_item, playlists_remove_item, playlists_save_from_items,
    playlists_toggle_hidden,
};
use app::commands::converter::{
    converter_convert_image, converter_extract_video_audio, converter_get_status,
    converter_process_batch_item, converter_extract_zip, converter_save_image_data, converter_scan_folder, converter_transcode_audio,
    converter_transcode_video,
};
use app::commands::custom_libraries::{
    custom_libraries_add_excluded_folder, custom_libraries_add_folder, custom_libraries_delete,
    custom_libraries_get_all, custom_libraries_get_excluded_folders, custom_libraries_get_folders,
    custom_libraries_get_thumbnail, custom_libraries_open_file, custom_libraries_read_text_file,
    custom_libraries_remove_excluded_folder, custom_libraries_remove_folder, custom_libraries_save,
    custom_libraries_save_text_file, custom_libraries_scan_items, custom_libraries_toggle_active,
};
use app::commands::media::{
    media_delete_items, media_filter_existing_paths, media_get_default_pictures_dir,
    media_rename_item, media_save_image, video_save_snapshot,
};
use app::commands::quick_look::{
    autostart_get_status, autostart_set, get_minimize_to_tray, is_minimize_to_tray_enabled,
    quick_look_close_window, quick_look_edit_file, quick_look_get_current, quick_look_get_detached_payload,
    quick_look_hide, quick_look_open_detached, quick_look_open_in_main, quick_look_set_shortcut, quick_look_get_shortcut,
    quick_look_set_size, quick_look_set_comparing, quick_look_set_pinned, quick_look_is_pinned, quick_look_show_file,
    quick_look_start_dragging, quick_look_get_position, quick_look_set_position, quick_look_step_selection,
    quick_look_toggle, quick_look_toggle_maximize, quick_look_is_maximized, set_minimize_to_tray,
    window_hide_to_background, window_restore_from_background,
};
use app::commands::renamer::{
    renamer_execute_batch, renamer_scan_folder, renamer_scan_paths, renamer_undo_batch, RenamerState,
};
use app::commands::ecosystem::{
    ecosystem_app_launch, ecosystem_apps_state, ecosystem_root_path,
};
use app::commands::synapse::{
    check_prisma_upscaler_engine, launch_gallery_dl, launch_luna_fetch, launch_prisma_upscaler,
    synapse_get_discovered_devices, synapse_get_downloads_dir, synapse_get_initial_send_file,
    synapse_get_status, synapse_send_file_to_device, synapse_set_downloads_dir,
    synapse_update_playback, upscale_image_native,
};
use app::commands::tags::{
    audio_batch_write_tags, audio_read_tags, audio_save_lyrics, audio_write_tags,
    image_read_exif,
};
use app::commands::visual_library::{
    open_external_url, open_in_file_manager, open_path_with_default_app, show_in_file_manager, video_extract_audio_track, video_get_audio_tracks, video_get_playback_source, video_get_subtitles, video_read_subtitle_vtt,
    visual_library_add_excluded_folder, visual_library_add_folder,
    visual_library_image_preview, visual_library_image_render, visual_library_list_excluded_folders,
    visual_library_list_folders, visual_library_list_items,
    visual_library_move_duplicates, visual_library_remove_excluded_folder, visual_library_remove_folder,
    visual_library_replace_duplicate, visual_library_rescan_folder, visual_library_scan_duplicates, visual_library_scan_folder_items, visual_library_sync_pip_icon,
};
use app::commands::video_takes::{
    video_delete_take_marker, video_get_take_marker, video_get_technical_metadata,
    video_list_take_markers, video_set_take_marker,
};
use app::commands::wallpapers::{
    live_wallpaper_add_folder, live_wallpaper_get_state, live_wallpaper_next, live_wallpaper_prev,
    live_wallpaper_pause, live_wallpaper_play_file, live_wallpaper_refresh_sources, live_wallpaper_remove_folder,
    live_wallpaper_resume, live_wallpaper_set_audio_enabled, live_wallpaper_set_fit,
    live_wallpaper_set_folder_hidden,
    live_wallpaper_set_mode, live_wallpaper_set_video_hidden,
    live_wallpaper_start, live_wallpaper_stop, live_wallpaper_toggle_folder,
    wallpaper_save_and_apply, wallpaper_set_desktop,
};
use app::commands::screen_capture::{
    screen_capture_cancel, screen_capture_configure, screen_capture_confirm, screen_capture_detect_subregion,
    screen_capture_detect_window_at, screen_capture_get_editor_payload,
    screen_capture_get_session, screen_capture_get_shortcut_status, screen_capture_pick_color,
    screen_capture_save_file, screen_capture_start, screen_recorder_cancel, screen_recorder_list_audio_devices,
    screen_recorder_pause, screen_recorder_start, screen_recorder_status, screen_recorder_stop, screen_recorder_trim,
};
use app::commands::drop_zone::{
    drop_zone_copy_file, drop_zone_default_folder, drop_zone_is_active, drop_zone_pointer_inside,
    system_drop_zone_set_active, system_drop_zone_set_size, system_drop_zone_set_visible,
    vault_add, vault_list, vault_log, vault_remove, vault_toggle_pin,
};
use app::commands::vault::VaultState;
use app::commands::vault_import::vault_import;
use app::state::{
    FavoritesState, InitialFileState, InitialSynapseSendState, MusicLibraryState,
    PlaybackProbeState, VisualLibraryState,
};
use features::quick_look::QuickLookState;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

#[derive(Clone)]
pub struct WallpaperTrayControls {
    pub toggle: tauri::menu::MenuItem<tauri::Wry>,
    pub pause: tauri::menu::MenuItem<tauri::Wry>,
    pub sound: tauri::menu::MenuItem<tauri::Wry>,
}

pub fn update_wallpaper_tray_menu(app: &tauri::AppHandle) {
    if let (Some(controller), Some(controls)) = (
        app.try_state::<features::wallpapers::WallpaperController>(),
        app.try_state::<WallpaperTrayControls>(),
    ) {
        if let Ok(state) = controller.get_state() {
            let toggle_text = if state.is_active {
                "Apagar fondo vivo"
            } else {
                "Encender fondo vivo"
            };
            let pause_text = if state.is_paused {
                "Reanudar fondo"
            } else {
                "Pausar fondo"
            };
            let sound_text = if state.settings.audio_enabled {
                "Quitar sonido del fondo"
            } else {
                "Activar sonido del fondo"
            };
            let _ = controls.toggle.set_text(toggle_text);
            let _ = controls.pause.set_text(pause_text);
            let _ = controls.pause.set_enabled(state.is_active);
            let _ = controls.sound.set_text(sound_text);
            let _ = controls.sound.set_enabled(state.is_active);
        }
    }
}

fn restart_application(app: &tauri::AppHandle) {
    // El evento de bandeja se ejecuta en el hilo principal. request_restart
    // permite completar RunEvent::Exit (audio e instancia única) antes del relanzamiento.
    app.request_restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let raw_initial_arg = std::env::args().nth(1).filter(|path| !path.starts_with('-'));

    // Detección de argumento --synapse-send para envío directo a través de la red LAN
    let all_args: Vec<String> = std::env::args().collect();
    let initial_synapse_send_file = all_args
        .windows(2)
        .find_map(|w| {
            if w[0] == "--synapse-send" {
                Some(w[1].clone())
            } else {
                None
            }
        })
        .or_else(|| {
            all_args.iter().find_map(|a| {
                a.strip_prefix("--synapse-send=").map(|s| s.to_string())
            })
        });
    
    let initial_file = if let Some(ref arg) = raw_initial_arg {
        if arg.starts_with("prisma://") || arg.starts_with("aurora-synapse://") {
            features::synapse::parse_prisma_uri(arg).map(|p| p.path)
        } else if std::path::Path::new(arg).is_file() {
            Some(arg.clone())
        } else {
            None
        }
    } else {
        None
    };

    let initial_file_clone = initial_file.clone();
    let is_explicit_quicklook = all_args.iter().any(|a| a == "--quicklook" || a == "-ql");

    let initial_file_for_main = if is_explicit_quicklook {
        None
    } else {
        initial_file.clone()
    };

    let is_autostart = std::env::args().any(|a| a == "--autostart");
    let is_dev_mode = cfg!(debug_assertions)
        || std::env::args().any(|a| a == "--dev" || a == "--multi-instance" || a == "-d")
        || std::env::var("PRISMA_DEV").is_ok()
        || std::env::var("PRISMA_MULTI_INSTANCE").is_ok();

    #[cfg(target_os = "windows")]
    if is_dev_mode {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let dev_udf = std::path::PathBuf::from(local_app_data)
                .join("com.biglexj.prisma.dev")
                .join("EBWebView");
            let _ = std::fs::create_dir_all(&dev_udf);
            unsafe {
                std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", dev_udf);
            }
        }
    }

    let mut builder = tauri::Builder::default();

    if !is_dev_mode {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let incoming_args: Vec<String> = args;

            // Manejo de envío directo por menú contextual (--synapse-send)
            let synapse_send = incoming_args
                .windows(2)
                .find_map(|w| {
                    if w[0] == "--synapse-send" {
                        Some(w[1].clone())
                    } else {
                        None
                    }
                })
                .or_else(|| {
                    incoming_args.iter().find_map(|a| {
                        a.strip_prefix("--synapse-send=").map(|s| s.to_string())
                    })
                });

            if let Some(send_file) = synapse_send {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.unminimize();
                    let _ = w.show();
                    let _ = w.set_focus();
                    let _ = app.emit("prisma://synapse-send", send_file);
                }
                return;
            }

            let is_explicit_quicklook = incoming_args.iter().any(|a| a == "--quicklook" || a == "-ql");
            let maybe_arg = incoming_args.into_iter().skip(1).find(|arg| !arg.starts_with('-'));

            if let Some(arg_str) = maybe_arg {
                if arg_str.starts_with("prisma://") || arg_str.starts_with("aurora-synapse://") {
                    if let Some(parsed) = features::synapse::parse_prisma_uri(&arg_str) {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.unminimize();
                            let _ = w.show();
                            let _ = w.set_focus();
                            let event = features::synapse::SynapseOpenMediaEvent {
                                path: parsed.path,
                                current_time: parsed.current_time_sec,
                                autoplay: Some(parsed.autoplay),
                                title: parsed.title,
                                artist: parsed.artist,
                            };
                            let _ = app.emit("prisma://open-media", event);
                        }
                        return;
                    }
                }

                if std::path::Path::new(&arg_str).is_file() {
                    let file_path = arg_str;
                    let path = std::path::Path::new(&file_path);

                    if is_explicit_quicklook {
                        if let Some(quick_look) = app.try_state::<QuickLookState>() {
                            if quick_look.show_file_path(path) {
                                return;
                            }
                        }
                    }

                    // Doble clic o apertura estándar: abrir directamente en Prisma
                    // Si QuickLook estaba visible, ocultarlo para evitar colisiones
                    if let Some(quick_look) = app.try_state::<QuickLookState>() {
                        quick_look.hide();
                    }

                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.unminimize();
                        let _ = w.show();
                        let _ = w.set_focus();
                        let _ = app.emit("prisma://open-media", file_path);
                    }
                    return;
                }
            }

            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }));
    }

    builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_drag::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_filename(if is_dev_mode { ".window-state-dev.json" } else { ".window-state-v2.json" })
                .skip_initial_state("main")
                .skip_initial_state("quicklook")
                .skip_initial_state("flyout")
                .skip_initial_state("screen_capture_overlay")
                .skip_initial_state("screen_capture_editor")
                .with_denylist(&["quicklook", "flyout", "mobile-audio-toast", "screen_capture_overlay", "screen_capture_editor"])
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .manage(PlaybackProbeState::new())
        .manage(InitialFileState(std::sync::Mutex::new(initial_file_for_main)))
        .manage(InitialSynapseSendState(std::sync::Mutex::new(initial_synapse_send_file)))
        .manage(RenamerState::default())
        .manage(app::commands::playback::GlobalMultiOutputShortcutStatus::default())
        .manage(std::sync::Arc::new(crate::infrastructure::media::passthru::PassthruService::new()))
        .setup(move |app| {
            #[cfg(target_os = "windows")]
            {
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
                let held = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
                let registration = app.global_shortcut().on_shortcut(if is_dev_mode { "Ctrl+Shift+Alt+D" } else { "Ctrl+Shift+Alt+P" }, move |app, _shortcut, event| {
                    if event.state() == ShortcutState::Released {
                        held.store(false, std::sync::atomic::Ordering::Relaxed);
                        return;
                    }
                    if held.swap(true, std::sync::atomic::Ordering::Relaxed) { return; }
                    let app = app.clone();
                    tauri::async_runtime::spawn_blocking(move || {
                        let service = app.state::<std::sync::Arc<infrastructure::media::passthru::PassthruService>>();
                        let enabled = !service.get_multi_output().enabled;
                        match service.toggle_multi_output(enabled) {
                            Ok(config) => {
                                if enabled {
                                    if let Err(error) = service.ensure_multi_output_running() {
                                        let _ = service.toggle_multi_output(false);
                                        let _ = app.emit("prisma://multi-output-shortcut-error", error);
                                        return;
                                    }
                                }
                                let _ = app.emit("prisma://multi-output-shortcut-toggled", config);
                            }
                            Err(error) => { let _ = app.emit("prisma://multi-output-shortcut-error", error); }
                        }
                    });
                });
                if let Err(error) = registration {
                    let message = "El atajo global está ocupado; Ctrl + Mayús + O sigue disponible dentro de Prisma.".to_string();
                    eprintln!("[Prisma] No se pudo registrar Ctrl+Mayús+Alt+P: {error}");
                    if let Ok(mut status) = app.state::<app::commands::playback::GlobalMultiOutputShortcutStatus>().error.lock() {
                        *status = Some(message);
                    }
                }
            }
            let mut data_directory = app.path().app_data_dir()?;
            if is_dev_mode {
                data_directory = data_directory.join("dev_profile");
                let _ = std::fs::create_dir_all(&data_directory);
            }

            // 1. Gestión inmediata de estados de biblioteca (previene condiciones de carrera con el frontend)
            let library_state =
                MusicLibraryState::load(data_directory.clone()).map_err(std::io::Error::other)?;
            app.manage(library_state);
            let visual_library_state =
                VisualLibraryState::load(data_directory.clone()).map_err(std::io::Error::other)?;
            app.manage(visual_library_state);
            let favorites_state =
                FavoritesState::load(data_directory.clone()).map_err(std::io::Error::other)?;
            app.manage(favorites_state);
            let custom_libraries_state =
                features::custom_libraries::CustomLibrariesState::load(data_directory.clone())
                    .map_err(std::io::Error::other)?;
            app.manage(custom_libraries_state);
            let video_takes_state =
                infrastructure::video_takes::VideoTakesState::load(data_directory.clone())
                    .map_err(std::io::Error::other)?;
            app.manage(video_takes_state);
            let audio_relay = features::audio_relay::AudioRelayService::start(app.handle().clone(), data_directory.clone(), is_dev_mode);
            app.manage(audio_relay);
            let synapse_state = features::synapse::SynapseState::load(data_directory.clone());
            app.manage(synapse_state);
            let wallpaper_controller = features::wallpapers::WallpaperController::new(data_directory.clone());
            if wallpaper_controller.should_auto_start() {
                let _ = wallpaper_controller.start();
            }
            // Se conserva un clon para el menú de la bandeja: `manage` consume el valor.
            let wallpaper_controller_for_tray = wallpaper_controller.clone();
            app.manage(wallpaper_controller);

            // 2. Registro de esquema prisma:// y servicios de Aurora Synapse
            if !is_dev_mode {
                features::synapse::register_windows_deep_link();
            }
            infrastructure::file_associations::register_file_associations();
            let beacon_service = features::synapse::SynapseBeaconService::start();
            app.manage(beacon_service);
            // Read only the known phone address from each profile. Availability is checked
            // over Synapse; preferences and audio sessions remain independent.
            let mut known_phone_configs = vec![data_directory.join("mobile-audio.json")];
            if is_dev_mode {
                if let Ok(roaming) = std::env::var("APPDATA") {
                    known_phone_configs.push(std::path::PathBuf::from(roaming).join("com.biglexj.prisma/mobile-audio.json"));
                }
            }
            let discovery_service = features::synapse::SynapseDiscoveryService::start(known_phone_configs);
            app.manage(discovery_service);
            let synapse_server = features::synapse::SynapseServer::start(app.handle().clone());
            app.manage(synapse_server);

            let capture_state: features::screen_capture::SharedCaptureState =
                std::sync::Arc::new(std::sync::Mutex::new(features::screen_capture::CaptureSessionState::default()));
            app.manage(capture_state.clone());

            // Estado de la grabadora de vídeo: una sola grabación activa a la vez.
            let recorder_state: features::screen_capture::SharedRecorderState =
                std::sync::Arc::new(std::sync::Mutex::new(None));
            app.manage(recorder_state.clone());

            // Atajo global para detener la grabación: la barra flotante cubre el
            // caso normal, pero con Prisma en bandeja hace falta una tecla.
            app::commands::screen_capture::apply_recorder_stop_shortcut(
                app.handle(),
                &recorder_state,
            );

            // El atajo global del capturador queda activo desde el arranque: la
            // aplicación responde en segundo plano, en bandeja o minimizada,
            // sin depender de que el frontend abra alguna vista.
            app::commands::screen_capture::apply_capture_shortcut_at_startup(
                app.handle(),
                &capture_state,
                &data_directory.join("screen_capture.json"),
            );

            // Zona de recepción del sistema: una muesca fija en el borde superior
            // central de la pantalla, por encima de cualquier ventana, para
            // arrastrar archivos desde el Explorador o cualquier aplicación.
            app::commands::drop_zone::place_at_startup(app.handle());
            app::commands::drop_zone::apply_vault_shortcut(app.handle());

            // En desarrollo, la caché del WebView2 puede servir un bundle viejo
            // y la ventana se queda con el contenido de la versión anterior.
            if is_dev_mode {
                for label in [
                    "main",
                    "system_drop_zone",
                    "screen_capture_overlay",
                    "screen_capture_editor",
                    "screen_capture_recorder",
                ] {
                    if let Some(window) = app.get_webview_window(label) {
                        let _ = window.clear_all_browsing_data();
                    }
                }
            }

            // Barra Synapse: cinco espacios; los fijados sobreviven a la rotación.
            let vault_state = VaultState::new(data_directory.join("vault.json"));
            app.manage(vault_state);
            if let Some(zone) = app.get_webview_window("system_drop_zone") {
                let _ = infrastructure::windows_file_drop::register_or_refresh(&zone);
                let retry = zone.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(800));
                    let target = retry.clone();
                    let _ = retry.run_on_main_thread(move || {
                        let _ = infrastructure::windows_file_drop::register_or_refresh(&target);
                    });
                });
            }

            let quick_look_state = QuickLookState::new(app.handle().clone());
            quick_look_state.init();

            if let Some(ref file_path) = initial_file_clone {
                if is_explicit_quicklook {
                    quick_look_state.show_file_path(std::path::Path::new(file_path));
                }
            }

            app.manage(quick_look_state);

            // Iniciar listener nativo de cambios de volumen del sistema operativo para el Flyout
            crate::app::commands::flyout::init_system_volume_listener(app.handle().clone());

            let smtc_state: infrastructure::media::smtc::NativeSmtcState =
                std::sync::Arc::new(std::sync::Mutex::new(None));
            app.manage(smtc_state.clone());

            if let Some(main_window) = app.get_webview_window("main") {
                #[cfg(windows)]
                {
                    if let Ok(hwnd) = main_window.hwnd() {
                        let win_hwnd = windows::Win32::Foundation::HWND(hwnd.0);
                        match infrastructure::media::smtc::NativeSmtcManager::new(win_hwnd, app.handle().clone()) {
                            Ok(mgr) => {
                                if let Ok(mut guard) = smtc_state.lock() {
                                    *guard = Some(mgr);
                                }
                                println!("[SMTC] Native Windows SMTC initialized for Prisma main window");
                            }
                            Err(e) => {
                                eprintln!("[SMTC] Failed to initialize native SMTC: {e}");
                            }
                        }
                    }
                }

                if is_dev_mode {
                    let _ = main_window.set_title("Prisma (Dev) · Tu espacio de multimedia");
                    let _ = main_window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                        width: 1200.0,
                        height: 800.0,
                    }));
                    let _ = main_window.center();
                }
                if is_autostart || is_explicit_quicklook {
                    let _ = main_window.hide();
                } else {
                    let _ = main_window.show();
                    let _ = main_window.unminimize();
                    let _ = main_window.maximize();
                    let _ = main_window.set_focus();
                }

                let win_clone = main_window.clone();
                let _ = infrastructure::windows_file_drop::register_or_refresh(&main_window);
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    let _ = infrastructure::windows_file_drop::register_or_refresh(&win_clone);
                });
            }

            // ── Menú de la bandeja del sistema (System Tray) ──
            let show_item = MenuItemBuilder::with_id("show", "Mostrar Prisma").build(app)?;
            let equalizer_item = MenuItemBuilder::with_id("equalizer", "Ecualizador & DSP").build(app)?;
            let settings_item = MenuItemBuilder::with_id("settings", "Configuración").build(app)?;
            let recording_stop_item = MenuItemBuilder::with_id("recording_stop", "Detener y guardar grabación (Ctrl+S)").enabled(false).build(app)?;
            let recording_show_item = MenuItemBuilder::with_id("recording_show", "Mostrar controles de grabación").enabled(false).build(app)?;
            app.manage(app::commands::screen_capture::RecorderTrayControls {
                stop: recording_stop_item.clone(),
                show: recording_show_item.clone(),
                save_shortcut_registered: std::sync::atomic::AtomicBool::new(false),
            });
            // Submenú de Fondos Vivos
            let wp_snapshot = wallpaper_controller_for_tray.get_state().unwrap_or_else(|_| features::wallpapers::WallpaperStateSnapshot {
                is_active: false,
                is_paused: false,
                current_video: None,
                current_folder: None,
                total_videos: 0,
                settings: features::wallpapers::sources::WallpaperSettings::default(),
                videos: Vec::new(),
            });
            let wp_toggle_label = if wp_snapshot.is_active { "Apagar fondo vivo" } else { "Encender fondo vivo" };
            let wp_pause_label = if wp_snapshot.is_paused { "Reanudar fondo" } else { "Pausar fondo" };

            let wallpaper_next_item = MenuItemBuilder::with_id("wallpaper_next", "Siguiente fondo").build(app)?;
            let wallpaper_prev_item = MenuItemBuilder::with_id("wallpaper_prev", "Anterior fondo").build(app)?;
            let wallpaper_pause_item = MenuItemBuilder::with_id("wallpaper_pause", wp_pause_label)
                .enabled(wp_snapshot.is_active)
                .build(app)?;
            let wallpaper_toggle_item = MenuItemBuilder::with_id("wallpaper_toggle", wp_toggle_label).build(app)?;
            let wp_sound_label = if wp_snapshot.settings.audio_enabled {
                "Quitar sonido del fondo"
            } else {
                "Activar sonido del fondo"
            };
            let wallpaper_sound_item = MenuItemBuilder::with_id("wallpaper_sound", wp_sound_label)
                .enabled(wp_snapshot.is_active)
                .build(app)?;
            let wallpaper_open_item = MenuItemBuilder::with_id("wallpaper_open", "Abrir Fondos Vivos").build(app)?;
            let wp_sep = PredefinedMenuItem::separator(app)?;

            let wallpaper_submenu = SubmenuBuilder::new(app, "Fondos en vivo")
                .items(&[
                    &wallpaper_next_item,
                    &wallpaper_prev_item,
                    &wallpaper_pause_item,
                    &wallpaper_toggle_item,
                    &wallpaper_sound_item,
                    &wp_sep,
                    &wallpaper_open_item,
                ])
                .build()?;

            app.manage(WallpaperTrayControls {
                toggle: wallpaper_toggle_item.clone(),
                pause: wallpaper_pause_item.clone(),
                sound: wallpaper_sound_item.clone(),
            });

            let separator = PredefinedMenuItem::separator(app)?;
            let separator2 = PredefinedMenuItem::separator(app)?;
            let restart_item = MenuItemBuilder::with_id("restart", "Reiniciar Prisma").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Salir de Prisma").build(app)?;

            let tray_menu = MenuBuilder::new(app)
                .items(&[
                    &show_item,
                    &equalizer_item,
                    &settings_item,
                    &recording_stop_item,
                    &recording_show_item,
                    &separator,
                    &wallpaper_submenu,
                    &separator2,
                    &restart_item,
                    &quit_item,
                ])
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Prisma · Tu espacio de multimedia")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "wallpaper_next" => {
                            if let Some(controller) = app.try_state::<features::wallpapers::WallpaperController>() {
                                let _ = controller.next();
                                update_wallpaper_tray_menu(app);
                                let _ = app.emit("prisma://wallpaper-state-changed", ());
                            }
                        }
                        "wallpaper_prev" => {
                            if let Some(controller) = app.try_state::<features::wallpapers::WallpaperController>() {
                                let _ = controller.prev();
                                update_wallpaper_tray_menu(app);
                                let _ = app.emit("prisma://wallpaper-state-changed", ());
                            }
                        }
                        "wallpaper_pause" => {
                            if let Some(controller) = app.try_state::<features::wallpapers::WallpaperController>() {
                                if let Ok(state) = controller.get_state() {
                                    if state.is_paused {
                                        let _ = controller.resume();
                                    } else {
                                        let _ = controller.pause();
                                    }
                                    update_wallpaper_tray_menu(app);
                                    let _ = app.emit("prisma://wallpaper-state-changed", ());
                                }
                            }
                        }
                        "wallpaper_toggle" => {
                            if let Some(controller) = app.try_state::<features::wallpapers::WallpaperController>() {
                                if let Ok(state) = controller.get_state() {
                                    if state.is_active {
                                        let _ = controller.stop();
                                    } else {
                                        let _ = controller.start();
                                    }
                                    update_wallpaper_tray_menu(app);
                                    let _ = app.emit("prisma://wallpaper-state-changed", ());
                                }
                            }
                        }
                        "wallpaper_sound" => {
                            if let Some(controller) = app.try_state::<features::wallpapers::WallpaperController>() {
                                if let Ok(state) = controller.get_state() {
                                    let _ = controller.set_audio_enabled(!state.settings.audio_enabled);
                                    update_wallpaper_tray_menu(app);
                                    let _ = app.emit("prisma://wallpaper-state-changed", ());
                                }
                            }
                        }
                        "wallpaper_open" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.unminimize();
                                let _ = w.show();
                                let _ = w.maximize();
                                let _ = w.set_focus();
                                let _ = w.emit("prisma://navigate", "live_wallpapers");
                            }
                        }
                        "recording_stop" => app::commands::screen_capture::request_recording_stop(app),
                        "recording_show" => app::commands::screen_capture::show_recording_controls(app),
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.unminimize();
                                let _ = w.show();
                                let _ = w.maximize();
                                let _ = w.set_focus();
                            }
                        }
                        "equalizer" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.unminimize();
                                let _ = w.show();
                                let _ = w.maximize();
                                let _ = w.set_focus();
                                let _ = w.emit("prisma://navigate", "equalizer");
                            }
                        }
                        "settings" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.unminimize();
                                let _ = w.show();
                                let _ = w.maximize();
                                let _ = w.set_focus();
                                let _ = w.emit("prisma://navigate", "settings");
                            }
                        }
                        "restart" => {
                            restart_application(app);
                        }
                        "quit" => {
                            if let Some(controller) = app.try_state::<features::wallpapers::WallpaperController>() {
                                let _ = controller.stop();
                            }
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                        | TrayIconEvent::DoubleClick {
                            button: MouseButton::Left,
                            ..
                        } => {
                            let app = tray.app_handle();
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.unminimize();
                                let _ = w.show();
                                let _ = w.maximize();
                                let _ = w.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "system_drop_zone" && matches!(event, WindowEvent::Focused(true)) {
                if let Some(zone) = window.app_handle().get_webview_window("system_drop_zone") {
                    let _ = infrastructure::windows_file_drop::register_or_refresh(&zone);
                }
            }
            if window.label() == "main" {
                if let WindowEvent::Resized(_) = event {
                    if let Ok(is_min) = window.is_minimized() {
                        if !is_min {
                            if let Ok(max) = window.is_maximized() {
                                app::commands::quick_look::record_main_window_maximized(max);
                            }
                        }
                    }
                }
                if matches!(event, WindowEvent::Focused(true)) {
                    if let Some(main_window) = window.app_handle().get_webview_window("main") {
                        if let Err(error) =
                            infrastructure::windows_file_drop::register_or_refresh(&main_window)
                        {
                            eprintln!(
                                "Prisma no pudo refrescar el receptor nativo de carpetas: {error}"
                            );
                        }
                    }
                }
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.emit("prisma://window-close-requested", ());
                    if let Ok(is_min) = window.is_minimized() {
                        if !is_min {
                            if let Ok(max) = window.is_maximized() {
                                app::commands::quick_look::record_main_window_maximized(max);
                            }
                        }
                    }
                    if is_minimize_to_tray_enabled() {
                        api.prevent_close();
                        let _ = window.app_handle().save_window_state(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED);
                        let _ = window.hide();
                    } else {
                        let _ = window.app_handle().save_window_state(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED);
                    }
                }
            } else if matches!(window.label(), "screen_capture_overlay" | "screen_capture_editor") {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    // Son ventanas reutilizables: Alt+F4 debe cancelar, no destruirlas
                    // y dejar los siguientes atajos sin una ventana que mostrar.
                    api.prevent_close();
                    app::commands::screen_capture::hide_capture_windows(window.app_handle());
                    if let Some(state) = window.app_handle().try_state::<features::screen_capture::SharedCaptureState>() {
                        features::screen_capture::clear_session(&state);
                    }
                }
            } else if window.label() == "quicklook" {
                match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        // Prevenir el cierre real; ocultar correctamente mediante QuickLookState
                        api.prevent_close();
                        if let Some(state) = window.app_handle().try_state::<QuickLookState>() {
                            state.hide();
                        } else {
                            let _ = window.app_handle().emit("quicklook://hide", ());
                            let _ = window.hide();
                            features::quick_look::keyboard_hook::set_preview_open(false);
                        }
                    }
                    _ => {}
                }
            } else if window
                .label()
                .starts_with(features::quick_look::DETACHED_LABEL_PREFIX)
            {
                if matches!(event, WindowEvent::Destroyed) {
                    if let Some(state) = window.app_handle().try_state::<QuickLookState>() {
                        state.remove_detached(window.label());
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_file,
            music_library_list_folders,
            music_library_list_excluded_folders,
            music_library_add_folder,
            music_library_add_excluded_folder,
            music_library_rescan_folder,
            music_library_remove_folder,
            music_library_remove_excluded_folder,
            music_library_list_items,
            music_library_artwork,
            music_library_lyrics,
            music_library_scan_duplicates,
            music_library_scan_folder_tracks,
            visual_library_list_folders,
            visual_library_list_excluded_folders,
            visual_library_add_folder,
            visual_library_add_excluded_folder,
            visual_library_rescan_folder,
            visual_library_remove_folder,
            visual_library_remove_excluded_folder,
            visual_library_list_items,
            visual_library_image_preview,
            visual_library_image_render,
            visual_library_sync_pip_icon,
            visual_library_scan_duplicates,
            visual_library_scan_folder_items,
            visual_library_replace_duplicate,
            visual_library_move_duplicates,
            media_delete_items,
            media_filter_existing_paths,
            media_rename_item,
            media_save_image,
            media_get_default_pictures_dir,
            app::commands::media::media_get_default_capture_folders,
            video_save_snapshot,
            show_in_file_manager,
            open_in_file_manager,
            open_path_with_default_app,
            open_external_url,
            video_get_subtitles,
            video_read_subtitle_vtt,
            video_get_audio_tracks,
            video_extract_audio_track,
            video_get_playback_source,
            playback_capabilities,
            playback_load,
            playback_next,
            playback_previous,
            playback_toggle_pause,
            playback_pause,
            playback_resume,
            playback_seek,
            playback_set_volume,
            playback_set_speed,
            playback_snapshot,
            playback_set_dsp_config,
            playback_get_audio_devices,
            app::commands::audio_relay::mobile_audio_status,
            app::commands::audio_relay::mobile_audio_select_phone,
            app::commands::audio_relay::mobile_audio_set_enabled,
            app::commands::audio_relay::mobile_audio_toggle,
            app::commands::audio_relay::mobile_audio_configure,
            app::commands::audio_relay::mobile_audio_set_shortcut,
            playback_get_multi_output,
            playback_get_global_multi_output_shortcut_error,
            playback_set_multi_output_devices,
            playback_toggle_multi_output,
            playback_set_audio_device,
            playback_set_system_default_device,
            smtc_update_playback,
            smtc_update_metadata,
            smtc_update_timeline,
            smtc_clear,
            flyout_show,
            flyout_hide,
            flyout_set_position,
            flyout_is_visible,
            flyout_get_system_volume,
            flyout_set_system_volume,
            flyout_configure,
            flyout_get_audio_peak,
            flyout_get_system_media,
            flyout_system_media_action,
            flyout_open_media_app,
            global_passthru_get_status,
            global_passthru_toggle,
            global_passthru_list_endpoints,
            global_passthru_set_volume,
            playlists_list,
            playlists_read,
            playlists_create,
            playlists_import,
            playlists_save_from_items,
            playlists_delete,
            playlists_toggle_hidden,
            playlists_clean_missing,
            playlists_relink_item,
            playlists_relink_folder,
            playlists_add_item,
            playlists_add_files,
            playlists_remove_item,
            favorites_get_all,
            favorites_toggle,
            favorites_is_favorite,
            quick_look_close_window,
            quick_look_edit_file,
            quick_look_toggle,
            quick_look_hide,
            quick_look_open_in_main,
            quick_look_open_detached,
            quick_look_get_current,
            quick_look_get_detached_payload,
            quick_look_show_file,
            quick_look_set_shortcut,
            quick_look_get_shortcut,
            quick_look_toggle_maximize,
            quick_look_is_maximized,
            quick_look_start_dragging,
            quick_look_get_position,
            quick_look_set_position,
            quick_look_step_selection,
            quick_look_set_size,
            quick_look_set_comparing,
            quick_look_set_pinned,
            quick_look_is_pinned,
            autostart_get_status,
            autostart_set,
            set_minimize_to_tray,
            get_minimize_to_tray,
            window_hide_to_background,
            window_restore_from_background,
            synapse_get_status,
            synapse_set_downloads_dir,
            synapse_get_downloads_dir,
            synapse_get_initial_send_file,
            synapse_update_playback,
            synapse_get_discovered_devices,
            synapse_send_file_to_device,
            launch_luna_fetch,
            launch_gallery_dl,
            launch_prisma_upscaler,
            ecosystem_apps_state,
            ecosystem_app_launch,
            ecosystem_root_path,
            check_prisma_upscaler_engine,
            upscale_image_native,
            custom_libraries_get_all,
            custom_libraries_save,
            custom_libraries_toggle_active,
            custom_libraries_delete,
            custom_libraries_add_folder,
            custom_libraries_remove_folder,
            custom_libraries_add_excluded_folder,
            custom_libraries_remove_excluded_folder,
            custom_libraries_get_folders,
            custom_libraries_get_excluded_folders,
            custom_libraries_scan_items,
            custom_libraries_get_thumbnail,
            custom_libraries_read_text_file,
            custom_libraries_save_text_file,
            custom_libraries_open_file,
            converter_get_status,
            converter_convert_image,
            converter_extract_video_audio,
            converter_transcode_video,
            converter_transcode_audio,
            converter_process_batch_item,
            converter_scan_folder,
            converter_extract_zip,
            converter_save_image_data,
            audio_read_tags,
            audio_write_tags,
            audio_batch_write_tags,
            audio_save_lyrics,
            image_read_exif,
            wallpaper_set_desktop,
            wallpaper_save_and_apply,
            live_wallpaper_get_state,
            live_wallpaper_start,
            live_wallpaper_play_file,
            live_wallpaper_pause,
            live_wallpaper_resume,
            live_wallpaper_next,
            live_wallpaper_prev,
            live_wallpaper_stop,
            live_wallpaper_add_folder,
            live_wallpaper_remove_folder,
            live_wallpaper_toggle_folder,
            live_wallpaper_refresh_sources,
            live_wallpaper_set_mode,
            live_wallpaper_set_fit,
            live_wallpaper_set_audio_enabled,
            live_wallpaper_set_folder_hidden,
            live_wallpaper_set_video_hidden,
            renamer_scan_folder,
            renamer_scan_paths,
            renamer_execute_batch,
            app::commands::renamer::renamer_validate_batch,
            app::commands::renamer::renamer_can_undo,
            app::commands::renamer::renamer_occupied_paths,
            renamer_undo_batch,
            video_get_technical_metadata,
            video_get_take_marker,
            video_set_take_marker,
            video_list_take_markers,
            video_delete_take_marker,
            screen_capture_start,
            app::commands::screen_capture::screen_capture_overlay_ready,
            app::commands::screen_capture::screen_capture_set_intent,
            features::screen_capture::diagnostics::screen_capture_trace,
            screen_capture_detect_subregion,
            screen_capture_detect_window_at,
            screen_capture_get_session,
            screen_capture_confirm,
            screen_capture_cancel,
            screen_capture_pick_color,
            screen_capture_get_editor_payload,
            screen_capture_save_file,
            screen_capture_get_shortcut_status,
            screen_capture_configure,
            screen_recorder_start,
            screen_recorder_stop,
            screen_recorder_status,
            screen_recorder_cancel,
            screen_recorder_pause,
            screen_recorder_trim,
            screen_recorder_list_audio_devices,
            system_drop_zone_set_active,
            system_drop_zone_set_size,
            system_drop_zone_set_visible,
            drop_zone_default_folder,
            drop_zone_copy_file,
            drop_zone_is_active,
            drop_zone_pointer_inside,
            vault_list,
            vault_log,
            vault_add,
            vault_import,
            app::commands::vault_import::vault_save_item,
            app::commands::vault_import::vault_read_text,
            vault_remove,
            vault_toggle_pin,
        ]);

        let mut context = tauri::generate_context!();
        if is_dev_mode {
            context.config_mut().identifier = "com.biglexj.prisma.dev".to_string();
        }

        builder
            .build(context)
            .expect("Prisma no pudo iniciar el runtime de Tauri")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Ready)
                && std::env::args().any(|arg| arg == "--capture-diagnostics")
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_title("Prisma · Diagnóstico de lápiz");
                }
                if let Some(window) = app.get_webview_window("screen_capture_overlay") {
                    let _ = window.set_title("Prisma · Captura · Diagnóstico");
                }
            }
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(relay) = app.try_state::<std::sync::Arc<features::audio_relay::AudioRelayService>>() { relay.shutdown(); }
                let service = app.state::<std::sync::Arc<infrastructure::media::passthru::PassthruService>>();
                let _ = service.stop();
            }
        });
}
// Trigger rebuild for native drag preview (CreateBitmap with 32bppPBGRA)

