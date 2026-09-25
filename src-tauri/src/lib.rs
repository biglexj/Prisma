mod app;
mod features;
mod infrastructure;

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
    playback_get_audio_devices, playback_load, playback_next, playback_pause, playback_previous,
    playback_resume, playback_seek, playback_set_audio_device, playback_set_dsp_config,
    playback_set_speed, playback_set_system_default_device, playback_set_volume,
    playback_snapshot, playback_toggle_pause,
};
use app::commands::playlists::{
    playlists_add_files, playlists_add_item, playlists_clean_missing, playlists_create,
    playlists_delete, playlists_import, playlists_list, playlists_read, playlists_relink_folder,
    playlists_relink_item, playlists_remove_item, playlists_save_from_items,
    playlists_toggle_hidden,
};
use app::commands::converter::{
    converter_convert_image, converter_extract_video_audio, converter_get_status,
    converter_process_batch_item, converter_extract_zip, converter_scan_folder, converter_transcode_audio,
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
    media_delete_items, media_get_default_pictures_dir, media_rename_item, media_save_image,
    video_save_snapshot,
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
    renamer_execute_batch, renamer_scan_folder, renamer_undo_batch, RenamerState,
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
    visual_library_image_preview, visual_library_list_excluded_folders,
    visual_library_list_folders, visual_library_list_items,
    visual_library_move_duplicates, visual_library_remove_excluded_folder, visual_library_remove_folder,
    visual_library_replace_duplicate, visual_library_rescan_folder, visual_library_scan_duplicates, visual_library_scan_folder_items, visual_library_sync_pip_icon,
};
use app::commands::wallpapers::{wallpaper_save_and_apply, wallpaper_set_desktop};
use app::state::{
    FavoritesState, InitialFileState, InitialSynapseSendState, MusicLibraryState,
    PlaybackProbeState, VisualLibraryState,
};
use features::quick_look::QuickLookState;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

fn restart_application(app: &tauri::AppHandle) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        // Liberar el bloqueo de instancia única para no colisionar con la nueva instancia
        tauri_plugin_single_instance::destroy(app);

        if let Ok(exe_path) = std::env::current_exe() {
            let pid = std::process::id();
            let exe_str = exe_path.to_string_lossy().replace('\'', "''");
            let args: Vec<String> = std::env::args().skip(1).collect();

            let ps_command = if args.is_empty() {
                format!(
                    "Wait-Process -Id {} -ErrorAction SilentlyContinue; Start-Process -FilePath '{}'",
                    pid, exe_str
                )
            } else {
                let args_joined = args
                    .iter()
                    .map(|a| format!("'{}'", a.replace('\'', "''")))
                    .collect::<Vec<_>>()
                    .join(", ");
                format!(
                    "Wait-Process -Id {} -ErrorAction SilentlyContinue; Start-Process -FilePath '{}' -ArgumentList @({})",
                    pid, exe_str, args_joined
                )
            };

            let _ = std::process::Command::new("powershell")
                .args(&[
                    "-NoProfile",
                    "-NonInteractive",
                    "-WindowStyle",
                    "Hidden",
                    "-Command",
                    &ps_command,
                ])
                .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
                .spawn();
        }

        app.exit(0);
    }

    #[cfg(not(windows))]
    {
        app.restart();
    }
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
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_filename(if is_dev_mode { ".window-state-dev.json" } else { ".window-state-v2.json" })
                .skip_initial_state("main")
                .skip_initial_state("quicklook")
                .with_denylist(&["quicklook"])
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .manage(PlaybackProbeState::new())
        .manage(InitialFileState(std::sync::Mutex::new(initial_file_for_main)))
        .manage(InitialSynapseSendState(std::sync::Mutex::new(initial_synapse_send_file)))
        .manage(RenamerState::default())
        .manage(std::sync::Arc::new(crate::infrastructure::media::passthru::PassthruService::new()))
        .setup(move |app| {
            let mut data_directory = app.path().app_data_dir()?;
            if is_dev_mode {
                data_directory = data_directory.join("dev_profile");
                let _ = std::fs::create_dir_all(&data_directory);
            }

            // ── Registro de esquema prisma:// y servicios de Aurora Synapse ──
            features::synapse::register_windows_deep_link();
            infrastructure::file_associations::register_file_associations();
            let synapse_state = features::synapse::SynapseState::load(data_directory.clone());
            app.manage(synapse_state);
            let beacon_service = features::synapse::SynapseBeaconService::start();
            app.manage(beacon_service);
            let discovery_service = features::synapse::SynapseDiscoveryService::start();
            app.manage(discovery_service);
            let synapse_server = features::synapse::SynapseServer::start(app.handle().clone());
            app.manage(synapse_server);

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
                features::custom_libraries::CustomLibrariesState::load(data_directory)
                    .map_err(std::io::Error::other)?;
            app.manage(custom_libraries_state);

            let quick_look_state = QuickLookState::new(app.handle().clone());
            quick_look_state.init();

            if let Some(ref file_path) = initial_file_clone {
                if is_explicit_quicklook {
                    quick_look_state.show_file_path(std::path::Path::new(file_path));
                }
            }

            app.manage(quick_look_state);

            if let Some(main_window) = app.get_webview_window("main") {
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
            let separator = PredefinedMenuItem::separator(app)?;
            let restart_item = MenuItemBuilder::with_id("restart", "Reiniciar Prisma").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Salir de Prisma").build(app)?;

            let tray_menu = MenuBuilder::new(app)
                .items(&[&show_item, &equalizer_item, &settings_item, &separator, &restart_item, &quit_item])
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Prisma · Tu espacio de multimedia")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
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
            visual_library_sync_pip_icon,
            visual_library_scan_duplicates,
            visual_library_scan_folder_items,
            visual_library_replace_duplicate,
            visual_library_move_duplicates,
            media_delete_items,
            media_rename_item,
            media_save_image,
            media_get_default_pictures_dir,
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
            playback_set_audio_device,
            playback_set_system_default_device,
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
            audio_read_tags,
            audio_write_tags,
            audio_batch_write_tags,
            audio_save_lyrics,
            image_read_exif,
            wallpaper_set_desktop,
            wallpaper_save_and_apply,
            renamer_scan_folder,
            renamer_execute_batch,
            renamer_undo_batch,
        ]);

        let mut context = tauri::generate_context!();
        if is_dev_mode {
            context.config_mut().identifier = "com.biglexj.prisma.dev".to_string();
        }

        builder
            .build(context)
            .expect("Prisma no pudo iniciar el runtime de Tauri")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                let service = app.state::<std::sync::Arc<infrastructure::media::passthru::PassthruService>>();
                let _ = service.stop();
            }
        });
}
