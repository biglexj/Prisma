//! Ventana de aceptación aislada: cargo build --example synapse_notch_smoke.
//! En Windows, ejecutarla junto a las DLL de target/debug y con un manifiesto
//! Common Controls v6 (véase VALIDATION.md del proceso de la barra Synapse).
//! Usa los comandos y el receptor reales sin abrir ni reiniciar Prisma.
#[path = "../src/app/commands/vault.rs"]
mod vault;
#[path = "../src/app/commands/vault_import.rs"]
mod vault_import;
#[path = "../src/app/commands/drop_zone.rs"]
mod drop_zone;
#[path = "../src/infrastructure/windows_file_drop.rs"]
mod windows_file_drop;

// El posicionamiento del producto usa la geometría de su grabador.
// Este ejecutable solo necesita la misma geometría virtual de Windows.
mod features { pub mod screen_capture { pub mod recorder {
    pub fn virtual_screen_rect() -> (i32, i32, u32, u32) {
        use windows::Win32::UI::WindowsAndMessaging::*;
        unsafe { (GetSystemMetrics(SM_XVIRTUALSCREEN), GetSystemMetrics(SM_YVIRTUALSCREEN), GetSystemMetrics(SM_CXVIRTUALSCREEN) as u32, GetSystemMetrics(SM_CYVIRTUALSCREEN) as u32) }
    }
}}}

// Descubrimiento vacío explícito: esta prueba no envía a dispositivos reales.
#[tauri::command]
fn synapse_get_discovered_devices() -> Vec<serde_json::Value> { Vec::new() }

fn main() {
    use tauri::Manager;
    let mut context = tauri::generate_context!();
    context.config_mut().identifier = "com.biglexj.prisma.notch-smoke".into();
    context.config_mut().app.windows.retain(|window| window.label == "system_drop_zone");
    context.config_mut().app.windows[0].title = "Prisma · Prueba aislada de Synapse".into();
    tauri::Builder::default()
        .plugin(tauri_plugin_drag::init())
        .setup(|app| {
            let path = app.path().app_data_dir()?.join("vault.json");
            println!("Perfil aislado: {}", path.display());
            app.manage(vault::VaultState::new(path));
            drop_zone::place_at_startup(app.handle());
            let zone = app.get_webview_window("system_drop_zone").unwrap();
            let _ = windows_file_drop::register_or_refresh(&zone);
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(1000));
                let target = zone.clone();
                let _ = zone.run_on_main_thread(move || {
                    println!("Receptor OLE: {:?}", windows_file_drop::register_or_refresh(&target));
                });
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            drop_zone::drop_zone_pointer_inside, drop_zone::system_drop_zone_set_size,
            drop_zone::system_drop_zone_set_active, drop_zone::drop_zone_default_folder,
            drop_zone::drop_zone_copy_file, drop_zone::vault_list, drop_zone::vault_remove,
            drop_zone::vault_toggle_pin, vault_import::vault_import, synapse_get_discovered_devices,
        ])
        .run(context).expect("No se pudo abrir la prueba de Synapse");
}
