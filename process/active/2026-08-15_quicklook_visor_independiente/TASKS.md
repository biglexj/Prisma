# Tareas — Quick Look y Visor Independiente

- [x] 1. Backend Rust: Corrección de Hook de Teclado y Selección Shell
  - [x] 1.1 Corregir `is_text_edit_focused` y detección de foco de hilo en `keyboard_hook.rs`.
  - [x] 1.2 Mejorar detección de pestañas activas en Windows 11 Explorer y escritorio en `shell_selection.rs`.
  - [x] 1.3 Implementar `show_file_path` y control de gracia de foco en `service.rs`.
- [x] 2. Backend Rust: Inicio con Archivo y Single Instance
  - [x] 2.1 Configurar `tauri-plugin-single-instance` en `lib.rs` para capturar archivos abiertos externamente.
  - [x] 2.2 Configurar arranque condicional: si se recibe un archivo multimedia, abrir ventana `quicklook` en vez de `main`.
  - [x] 2.3 Ajustar `on_window_event` para prevenir el cierre inmediato por carrera de foco en `quicklook`.
  - [x] 2.4 Registrar nuevo comando `quick_look_show_file` en `commands/quick_look.rs` y `lib.rs`.
- [x] 3. Frontend: Sincronización y Experiencia de Usuario
  - [x] 3.1 Corregir inicialización de atajos en `useSystemSettings.ts`.
  - [x] 3.2 Afinar visor `QuickLookWindow.tsx` para responder a eventos de apertura externa y atajos locales.
- [x] 4. Validación y Cierre
  - [x] 4.1 Ejecutar `cargo check` y pruebas unitarias de Rust.
  - [x] 4.2 Probar atajo de Espacio en Explorer y apertura directa de archivo multimedia.
