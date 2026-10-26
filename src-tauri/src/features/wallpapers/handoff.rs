//! Dev tiene prioridad mientras está abierto; el escritorio tiene un único propietario.
use super::{desktop_lease, WallpaperController};
use std::{fs::File, path::PathBuf, sync::{atomic::{AtomicBool, Ordering}, Mutex}, time::Duration};
use tauri::{AppHandle, Emitter};

#[derive(Default)]
pub(super) struct Handoff {
    pub enabled: AtomicBool,
    pub blocked: AtomicBool,
    pub running: AtomicBool,
    pub message: Mutex<Option<String>>,
    pub owner: Mutex<Option<File>>,
}

#[derive(Default)]
struct Restore {
    base: bool,
    composition: bool,
    paused: bool,
}

impl WallpaperController {
    pub fn configure_handoff(&self, app: AppHandle, is_dev: bool) {
        self.handoff.enabled.store(true, Ordering::SeqCst);
        self.handoff.running.store(true, Ordering::SeqCst);
        self.handoff.blocked.store(true, Ordering::SeqCst);
        let controller = self.clone();
        std::thread::spawn(move || {
            if let Err(error) = controller.handoff_loop(&app, is_dev) {
                controller.handoff_message(Some(error.clone()));
                eprintln!("[Fondos Vivos] {error}");
                let _ = app.emit("prisma://wallpaper-state-changed", ());
            }
        });
    }

    pub(super) fn ensure_wallpaper_control(&self) -> Result<(), String> {
        if self.handoff.enabled.load(Ordering::SeqCst) && self.handoff.blocked.load(Ordering::SeqCst) {
            return Err(self.handoff.message.lock().ok().and_then(|m| m.clone())
                .unwrap_or_else(|| "Esperando el control de los fondos".into()));
        }
        Ok(())
    }

    fn handoff_message(&self, message: Option<String>) {
        if let Ok(mut current) = self.handoff.message.lock() { *current = message; }
    }

    fn handoff_loop(&self, app: &AppHandle, is_dev: bool) -> Result<(), String> {
        let mut root = std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
            .ok_or("No se encontró el directorio local para coordinar los fondos")?
            .join("com.biglexj.prisma-session");
        if std::env::args().any(|arg| arg == "--wallpaper-handoff-diagnostics") {
            root = PathBuf::from(std::env::var_os("PRISMA_HANDOFF_DIAGNOSTICS_DIR")
                .ok_or("Falta el directorio de diagnóstico")?).join("session-locks");
        }
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        // Una instancia Dev reserva la sesión completa, aunque todavía no tenga un fondo activo.
        let _dev = if is_dev {
            let mut reservation = None;
            for _ in 0..20 {
                reservation = desktop_lease::acquire(&root.join("dev.lock"))?;
                if reservation.is_some() { break; }
                std::thread::sleep(Duration::from_millis(50));
            }
            Some(reservation.ok_or("Otra instancia Dev ya tiene el control de los fondos")?)
        } else { None };
        let mut restore = Restore {
            base: self.should_auto_start(),
            composition: self.should_auto_start() && self.compositor_config()?.has_layers(),
            paused: false,
        };
        let mut owns = false;
        while self.handoff.running.load(Ordering::SeqCst) {
            let dev_present = !is_dev && desktop_lease::acquire(&root.join("dev.lock"))?.is_none();
            if dev_present {
                self.handoff_message(Some("Dev tiene el control de los fondos. Se recuperará al cerrar Dev.".into()));
                self.handoff.blocked.store(true, Ordering::SeqCst);
                if owns {
                    restore = self.suspend_for_handoff(app)?;
                    // Se libera únicamente después de destruir las superficies de Stable.
                    self.handoff.owner.lock().map_err(|e| e.to_string())?.take();
                    owns = false;
                    Self::handoff_notify(app);
                }
            } else if !owns {
                self.handoff_message(Some("Esperando a que la otra instancia libere los fondos".into()));
                if let Some(owner) = desktop_lease::acquire(&root.join("desktop.lock"))? {
                    // Las versiones antiguas no participan en los bloqueos: jamás superponerlas.
                    if super::window::has_foreign_wallpaper_host() {
                        self.handoff_message(Some("Otra versión de Prisma mantiene un fondo activo. Actualízala para permitir la cesión automática.".into()));
                        drop(owner);
                    } else {
                        *self.handoff.owner.lock().map_err(|e| e.to_string())? = Some(owner);
                        owns = true;
                        if !self.handoff.running.load(Ordering::SeqCst) { break; }
                        if let Err(error) = self.restore_after_handoff(app, &restore) {
                            // Un medio ausente no debe bloquear los controles para corregir la fuente.
                            eprintln!("[Fondos Vivos] No se pudo recuperar el fondo: {error}");
                            let _ = app.emit("prisma://compositor-error", error);
                        }
                        restore = Restore::default();
                        self.handoff_message(None);
                        self.handoff.blocked.store(false, Ordering::SeqCst);
                        Self::handoff_notify(app);
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(200));
        }
        // La reserva del escritorio se conserva hasta finalizar la limpieza de salida.
        Ok(())
    }

    fn handoff_notify(app: &AppHandle) {
        crate::update_wallpaper_tray_menu(app);
        let _ = app.emit("prisma://wallpaper-state-changed", ());
        if let Some(controller) = app.try_state::<WallpaperController>() {
            if let Ok(config) = controller.compositor_config() { super::compositor::push_config(app, &config); }
        }
    }

    fn suspend_for_handoff(&self, app: &AppHandle) -> Result<Restore, String> {
        let _lifecycle = self.compositor_lifecycle.lock().map_err(|e| e.to_string())?;
        let (restore, host) = {
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            let restore = Restore { base: inner.engine.is_some(), composition: inner.compositor_enabled, paused: inner.is_paused };
            inner.compositor_epoch += 1;
            super::interaction::disable();
            // mpv deja de usar el HWND antes de destruir la superficie.
            if let Some(mut engine) = inner.engine.take() { engine.stop()?; drop(engine); }
            inner.compositor_enabled = false;
            inner.compositor_app = None;
            inner.is_paused = false;
            (restore, inner.window.take())
        };
        let handle = app.clone();
        let (tx, rx) = std::sync::mpsc::channel();
        app.run_on_main_thread(move || {
            let _ = tx.send(super::compositor::request_destroy(&handle));
        }).map_err(|e| e.to_string())?;
        let composition_hwnd = rx.recv_timeout(Duration::from_secs(10)).map_err(|e| e.to_string())??;
        #[cfg(windows)]
        if let Some(hwnd) = composition_hwnd {
            use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::IsWindow};
            let deadline = std::time::Instant::now() + Duration::from_secs(10);
            while unsafe { IsWindow(HWND(hwnd as *mut _)).as_bool() } {
                if std::time::Instant::now() >= deadline { return Err("La superficie 3D no confirmó el cierre".into()); }
                std::thread::sleep(Duration::from_millis(20));
            }
        }
        let (tx, rx) = std::sync::mpsc::channel();
        app.run_on_main_thread(move || {
            let _ = tx.send(host.map_or(true, |host| host.destroy_for_handoff()));
        }).map_err(|e| e.to_string())?;
        match rx.recv_timeout(Duration::from_secs(10)) {
            Ok(true) => Ok(restore),
            _ => Err("No se pudo confirmar la liberación del fondo; la otra instancia seguirá bloqueada".into()),
        }
    }

    fn restore_after_handoff(&self, app: &AppHandle, restore: &Restore) -> Result<(), String> {
        if !self.handoff.running.load(Ordering::SeqCst) { return Ok(()); }
        if restore.base {
            let controller = self.clone();
            let (tx, rx) = std::sync::mpsc::channel();
            app.run_on_main_thread(move || { let _ = tx.send(controller.start_internal(true)); }).map_err(|e| e.to_string())?;
            rx.recv().map_err(|e| e.to_string())??;
        }
        if restore.composition { self.set_compositor_enabled_internal(app, true, true)?; }
        if restore.paused {
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            if let Some(engine) = &mut inner.engine { engine.pause()?; }
            inner.is_paused = true;
        }
        Ok(())
    }
}

use tauri::Manager;
