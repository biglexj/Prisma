mod app;
mod features;
mod infrastructure;

use app::commands::music_library::{
    music_library_add_excluded_folder, music_library_add_folder, music_library_artwork,
    music_library_list_excluded_folders, music_library_list_folders, music_library_list_items,
    music_library_remove_excluded_folder, music_library_remove_folder, music_library_rescan_folder,
};
use app::commands::playback::{
    get_initial_file, playback_capabilities, playback_load, playback_next, playback_previous,
    playback_seek, playback_set_speed, playback_set_volume, playback_snapshot,
    playback_toggle_pause,
};
use app::commands::visual_library::{
    show_in_file_manager, visual_library_add_excluded_folder, visual_library_add_folder,
    visual_library_image_preview, visual_library_list_excluded_folders,
    visual_library_list_folders, visual_library_list_items,
    visual_library_remove_excluded_folder, visual_library_remove_folder,
    visual_library_rescan_folder,
};
use app::state::{InitialFileState, MusicLibraryState, PlaybackProbeState, VisualLibraryState};
use tauri::{Manager, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_file = std::env::args().nth(1).filter(|path| {
        !path.starts_with('-') && std::path::Path::new(path).is_file()
    });

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
        .setup(|app| {
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

                if saved_state_exists {
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
                VisualLibraryState::load(data_directory).map_err(std::io::Error::other)?;
            app.manage(visual_library_state);
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { .. } = event {
                    let _ = window.app_handle().save_window_state(StateFlags::all());
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
            playback_capabilities,
            playback_load,
            playback_next,
            playback_previous,
            playback_toggle_pause,
            playback_seek,
            playback_set_volume,
            playback_set_speed,
            playback_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("Prisma no pudo iniciar el runtime de Tauri");
}

