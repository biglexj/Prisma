# Tareas: Configuración de Atajos, Autorun y Bandeja del Sistema (System Tray)

## Estado: `COMPLETADO`

- [x] **Fase 1: Backend Rust — Modificadores de Atajo y Autorun en Registro**
  - [x] 1.1 Extender `keyboard_hook.rs` para soportar modificadores (`Ctrl`, `Alt`, `Shift`, `Disabled`) y comando `quick_look_set_shortcut`.
  - [x] 1.2 Implementar `infrastructure/autostart.rs` para gestionar el registro `HKCU\...\Run` en Windows y comandos `autostart_get_status` / `autostart_set`.
  - [x] 1.3 Implementar flag `--autostart` para arranque silencioso en segundo plano.

- [x] **Fase 2: Backend Rust — System Tray y Gestión de Cierre a la Bandeja**
  - [x] 2.1 Configurar `TrayIconBuilder` en `lib.rs` con menú contextual ("Mostrar Prisma", "Configuración", "Salir").
  - [x] 2.2 Implementar interceptación de `WindowEvent::CloseRequested` para minimizar a la bandeja si la opción está activa.
  - [x] 2.3 Añadir comando `set_minimize_to_tray(enabled: bool)`.

- [x] **Fase 3: Frontend — Hook de Configuración y UI en AppSettings**
  - [x] 3.1 Crear `src/app/useSystemSettings.ts` con persistencia de preferencias y sincronización con comandos de Rust.
  - [x] 3.2 Actualizar `src/app/ui/AppSettings.tsx` con secciones dedicadas a "Previsualización Rápida (Quick Look)" y "Sistema y Segundo Plano".
  - [x] 3.3 Añadir estilos CSS en `app-settings.css` para selectores de atajo, switches e información detallada.

- [x] **Fase 4: Validación y Pruebas Integrales**
  - [x] 4.1 Validar `cargo test` y `cargo check` (17 pruebas superadas).
  - [x] 4.2 Validar `bun run build` (0 errores de tipos en 1.03s).
  - [x] 4.3 Registrar evidencia de pruebas y formalizar en `APPROVAL.md`.
