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
use app::commands::quick_look::{
    autostart_get_status, autostart_set, get_minimize_to_tray, is_minimize_to_tray_enabled,
    quick_look_get_current, quick_look_get_shortcut, quick_look_hide, quick_look_open_in_main,
    quick_look_set_shortcut, quick_look_toggle, set_minimize_to_tray,
};
use app::commands::visual_library::{
    show_in_file_manager, video_get_subtitles, video_read_subtitle_vtt,
    visual_library_add_excluded_folder, visual_library_add_folder,
    visual_library_image_preview, visual_library_list_excluded_folders,
    visual_library_list_folders, visual_library_list_items,
    visual_library_remove_excluded_folder, visual_library_remove_folder,
    visual_library_rescan_folder,
};
use app::state::{FavoritesState, InitialFileState, MusicLibraryState, PlaybackProbeState, VisualLibraryState};
use features::quick_look::QuickLookState;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_file = std::env::args().nth(1).filter(|path| {
        !path.starts_with('-') && std::path::Path::new(path).is_file()
    });

    let is_autostart = std::env::args().any(|a| a == "--autostart");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_filename(".window-state-v2.json")
                .skip_initial_state("main")
                .with_state_flags(StateFlags::all())
                .build(),
        )
        .manage(PlaybackProbeState::new())
        .manage(InitialFileState(std::sync::Mutex::new(initial_file)))
        .setup(move |app| {
            if let Some(main_window) = app.get_webview_window("main") {
                let saved_state_exists = app
                    .path()
                    .app_config_dir()
                    .ok()
                    .and_then(|directory| {
                        std::fs::read(directory.join(app.handle().filename())).ok()
                    })
                    .and_then(|contents| {
                        serde_json::from_slice::<serde_json::Value>(&contents).ok()
                    })
                    .is_some_and(|state| state.get("main").is_some());

                if is_autostart {
                    let _ = main_window.hide();
                } else if saved_state_exists {
                    let _ = main_window.restore_state(StateFlags::all());
                } else {
                    let _ = main_window.maximize();
                }
            }

            let data_directory = app.path().app_data_dir()?;
            let library_state =
                MusicLibraryState::load(data_directory.clone()).map_err(std::io::Error::other)?;
            app.manage(library_state);
            let visual_library_state =
                VisualLibraryState::load(data_directory.clone()).map_err(std::io::Error::other)?;
            app.manage(visual_library_state);
            let favorites_state =
                FavoritesState::load(data_directory).map_err(std::io::Error::other)?;
            app.manage(favorites_state);

            let quick_look_state = QuickLookState::new(app.handle().clone());
            quick_look_state.init();
            app.manage(quick_look_state);

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
                                let _ = w.set_focus();
                            }
                        }
                        "settings" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.unminimize();
                                let _ = w.show();
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
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let is_visible = w.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = w.set_focus();
                            } else {
                                let _ = w.unminimize();
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
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
                        let _ = window.app_handle().save_window_state(StateFlags::all());
                        let _ = window.hide();
                    } else {
                        let _ = window.app_handle().save_window_state(StateFlags::all());
                    }
                }
            } else if window.label() == "quicklook" {
                if let WindowEvent::Focused(false) = event {
                    let _ = window.app_handle().emit("quicklook://hide", ());
                    let _ = window.hide();
                    features::quick_look::keyboard_hook::set_preview_open(false);
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
            show_in_file_manager,
            video_get_subtitles,
            video_read_subtitle_vtt,
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
            quick_look_toggle,
            quick_look_hide,
            quick_look_open_in_main,
            quick_look_get_current,
            quick_look_set_shortcut,
            quick_look_get_shortcut,
            autostart_get_status,
            autostart_set,
            set_minimize_to_tray,
            get_minimize_to_tray
        ])
        .run(tauri::generate_context!())
        .expect("Prisma no pudo iniciar el runtime de Tauri");
}
