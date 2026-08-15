# Tareas: Prisma Quick Look (Previsualización Rápida con Espacio)

## Estado: `COMPLETADO`

- [x] **Fase 1: Backend Rust — Detección Shell COM y Hook de Teclado**
  - [x] 1.1 Configurar dependencias de Windows en `Cargo.toml` (`windows` crate con `Win32_UI_Shell`, `Win32_UI_WindowsAndMessaging`, `Win32_System_Com`, `Win32_Foundation`, `Win32_System_Variant`).
  - [x] 1.2 Implementar `shell_selection.rs` para extraer la ruta seleccionada en Explorador (`CabinetWClass`) y Escritorio (`Progman`/`WorkerW`) vía COM.
  - [x] 1.3 Implementar `keyboard_hook.rs` con `WH_KEYBOARD_LL`, filtro de cajas de texto (`Edit`/renombrado) y despacho de eventos `VK_SPACE` / teclas de dirección.
  - [x] 1.4 Implementar `quick_look_service.rs` y registrar comandos Tauri (`quick_look_toggle`, `quick_look_hide`, `quick_look_open_in_main`, `quick_look_get_current`).

- [x] **Fase 2: Ventana Secundaria Tauri y Enrutamiento Aislado**
  - [x] 2.1 Configurar la ventana `quicklook` en `tauri.conf.json` (`decorations: false`, `transparent: true`, `alwaysOnTop: true`, `visible: false`, `skipTaskbar: true`).
  - [x] 2.2 Configurar enrutamiento en `src/main.tsx` para aislar `QuickLookWindow` de la UI pesada del layout principal.

- [x] **Fase 3: Frontend — Visores Compactos para Imagen, Vídeo y Música**
  - [x] 3.1 Crear `src/features/quick_look/ui/QuickLookWindow.tsx` con manejo de eventos y atajos (`Espacio`, `Esc`).
  - [x] 3.2 Crear `QuickLookHeader.tsx` con metadatos del archivo, botón *"Abrir en Prisma"* y botón de cierre `✕`.
  - [x] 3.3 Crear `QuickLookMusic.tsx` con diseño compacto (carátula a la izquierda, título/artista a la derecha, barra de transporte y paleta adaptativa).
  - [x] 3.4 Crear `QuickLookImage.tsx` optimizado para auto-fit, zoom sutil y badge de resolución.
  - [x] 3.5 Crear `QuickLookVideo.tsx` con controles mínimos y reproducción fluida.
  - [x] 3.6 Crear `quick-look.css` con diseño Material 3 Expressive, bordes redondeados y fondo tonal.

- [x] **Fase 4: Navegación Continua, Ciclo de Vida y Transición**
  - [x] 4.1 Implementar actualización de contenido en vivo al navegar con flechas en el Explorador sin parpadeos.
  - [x] 4.2 Integrar acción *"Abrir en Prisma"* para transferir el archivo a la ventana principal `main` y enfocarla.
  - [x] 4.3 Manejar eventos de pérdida de foco y ocultación para detener audio/vídeo y liberar memoria.

- [x] **Fase 5: Validación Integral y Pruebas**
  - [x] 5.1 Validar compilación de Rust con `cargo check` y `cargo test` (17 pruebas pasadas).
  - [x] 5.2 Validar compilación de TypeScript con `bun run build` (0 errores).
  - [x] 5.3 Registrar evidencia de pruebas en `VALIDATION.md` y formalizar en `APPROVAL.md`.
