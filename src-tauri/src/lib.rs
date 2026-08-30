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
    music_library_rescan_folder,
};
use app::commands::playback::{
    get_initial_file, playback_capabilities, playback_load, playback_next, playback_previous,
    playback_seek, playback_set_speed, playback_set_volume, playback_snapshot,
    playback_toggle_pause,
};
use app::commands::playlists::{
    playlists_add_files, playlists_add_item, playlists_clean_missing, playlists_create,
    playlists_delete, playlists_import, playlists_list, playlists_read, playlists_relink_folder,
    playlists_relink_item, playlists_remove_item, playlists_save_from_items,
    playlists_toggle_hidden,
};
use app::commands::converter::{
    converter_convert_image, converter_extract_video_audio, converter_get_status,
    converter_process_batch_item, converter_scan_folder, converter_transcode_audio,
    converter_transcode_video,
};
use app::commands::custom_libraries::{
    custom_libraries_add_excluded_folder, custom_libraries_add_folder, custom_libraries_delete,
    custom_libraries_get_all, custom_libraries_get_excluded_folders, custom_libraries_get_folders,
    custom_libraries_get_thumbnail, custom_libraries_open_file, custom_libraries_read_text_file,
    custom_libraries_remove_excluded_folder, custom_libraries_remove_folder, custom_libraries_save,
    custom_libraries_save_text_file, custom_libraries_scan_items, custom_libraries_toggle_active,
};
use app::commands::media::{media_delete_items, media_rename_item, media_save_image};
use app::commands::quick_look::{
    autostart_get_status, autostart_set, get_minimize_to_tray, is_minimize_to_tray_enabled,
    quick_look_close_window, quick_look_get_current, quick_look_get_detached_payload,
    quick_look_get_shortcut, quick_look_hide, quick_look_is_maximized, quick_look_open_detached,
    quick_look_open_in_main, quick_look_set_shortcut, quick_look_set_size, quick_look_show_file,
    quick_look_start_dragging, quick_look_step_selection, quick_look_toggle, quick_look_toggle_maximize, set_minimize_to_tray,
};
use app::commands::synapse::{
    launch_gallery_dl, launch_luna_fetch, synapse_get_discovered_devices, synapse_get_downloads_dir,
    synapse_get_status, synapse_send_file_to_device, synapse_set_downloads_dir,
    synapse_update_playback,
};
use app::commands::tags::{
    audio_batch_write_tags, audio_read_tags, audio_save_lyrics, audio_write_tags,
    image_read_exif,
};
use app::commands::visual_library::{
    open_external_url, open_in_file_manager, open_path_with_default_app, show_in_file_manager, video_extract_audio_track, video_get_audio_tracks, video_get_subtitles, video_read_subtitle_vtt,
    visual_library_add_excluded_folder, visual_library_add_folder,
    visual_library_image_preview, visual_library_list_excluded_folders,
    visual_library_list_folders, visual_library_list_items,
    visual_library_remove_excluded_folder, visual_library_remove_folder,
    visual_library_rescan_folder,
};
use app::commands::wallpapers::{wallpaper_save_and_apply, wallpaper_set_desktop};
use app::state::{FavoritesState, InitialFileState, MusicLibraryState, PlaybackProbeState, VisualLibraryState};
use features::quick_look::QuickLookState;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let raw_initial_arg = std::env::args().nth(1).filter(|path| !path.starts_with('-'));
    
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
    let is_media_initial_file = initial_file_clone.as_ref().is_some_and(|f| {
        features::quick_look::QuickLookMediaType::from_path(std::path::Path::new(f)).is_some()
    });

    let initial_file_for_main = if is_media_initial_file {
        None
    } else {
        initial_file.clone()
    };

    let is_autostart = std::env::args().any(|a| a == "--autostart");
    let is_dev_mode = cfg!(debug_assertions)
        || std::env::args().any(|a| a == "--dev" || a == "--multi-instance" || a == "-d")
        || std::env::var("PRISMA_DEV").is_ok()
        || std::env::var("PRISMA_MULTI_INSTANCE").is_ok();

    let mut builder = tauri::Builder::default();

    if !is_dev_mode {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let maybe_arg = args.into_iter().skip(1).find(|arg| !arg.starts_with('-'));

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
                    if let Some(quick_look) = app.try_state::<QuickLookState>() {
                        if quick_look.show_file_path(path) {
                            return;
                        }
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

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_filename(if is_dev_mode { ".window-state-dev.json" } else { ".window-state-v2.json" })
                .skip_initial_state("main")
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .manage(PlaybackProbeState::new())
        .manage(InitialFileState(std::sync::Mutex::new(initial_file_for_main)))
        .setup(move |app| {
            let mut data_directory = app.path().app_data_dir()?;
            if is_dev_mode {
                data_directory = data_directory.join("dev_profile");
                let _ = std::fs::create_dir_all(&data_directory);
            }

            // ── Registro de esquema prisma:// y servicios de Aurora Synapse ──
            features::synapse::register_windows_deep_link();
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
                if is_media_initial_file {
                    quick_look_state.show_file_path(std::path::Path::new(file_path));
                }
            }

            app.manage(quick_look_state);

            if let Some(main_window) = app.get_webview_window("main") {
                if is_dev_mode {
                    let _ = main_window.set_title("Prisma (Dev) · Multimedia local");
                }
                if is_autostart || is_media_initial_file {
                    let _ = main_window.hide();
                } else {
                    let _ = main_window.show();
                    let _ = main_window.unminimize();
                    let _ = main_window.maximize();
                    let _ = main_window.set_focus();
                }
            }

            // ── Menú de la bandeja del sistema (System Tray) ──
            let show_item = MenuItemBuilder::with_id("show", "Mostrar Prisma").build(app)?;
            let settings_item = MenuItemBuilder::with_id("settings", "Configuración").build(app)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Salir de Prisma").build(app)?;

            let tray_menu = MenuBuilder::new(app)
                .items(&[&show_item, &settings_item, &separator, &quit_item])
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Prisma · Multimedia local")
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
                        "settings" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.unminimize();
                                let _ = w.show();
                                let _ = w.maximize();
                                let _ = w.set_focus();
                                let _ = w.emit("prisma://navigate", "settings");
                            }
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
                if let WindowEvent::CloseRequested { api, .. } = event {
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
            visual_library_list_folders,
            visual_library_list_excluded_folders,
            visual_library_add_folder,
            visual_library_add_excluded_folder,
            visual_library_rescan_folder,
            visual_library_remove_folder,
            visual_library_remove_excluded_folder,
            visual_library_list_items,
            visual_library_image_preview,
            media_delete_items,
            media_rename_item,
            media_save_image,
            show_in_file_manager,
            open_in_file_manager,
            open_path_with_default_app,
            open_external_url,
            video_get_subtitles,
            video_read_subtitle_vtt,
            video_get_audio_tracks,
            video_extract_audio_track,
            playback_capabilities,
            playback_load,
            playback_next,
            playback_previous,
            playback_toggle_pause,
            playback_seek,
            playback_set_volume,
            playback_set_speed,
            playback_snapshot,
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
            quick_look_step_selection,
            quick_look_set_size,
            autostart_get_status,
            autostart_set,
            set_minimize_to_tray,
            get_minimize_to_tray,
            synapse_get_status,
            synapse_set_downloads_dir,
            synapse_get_downloads_dir,
            synapse_update_playback,
            synapse_get_discovered_devices,
            synapse_send_file_to_device,
            launch_luna_fetch,
            launch_gallery_dl,
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
            audio_read_tags,
            audio_write_tags,
            audio_batch_write_tags,
            audio_save_lyrics,
            image_read_exif,
            wallpaper_set_desktop,
            wallpaper_save_and_apply,
        ])
        .run(tauri::generate_context!())
        .expect("Prisma no pudo iniciar el runtime de Tauri");
}
