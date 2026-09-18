# Lista de Tareas — Instancia Múltiple QuickLook, Blindaje de Renderizado y Rescate en Tray

## Tareas

- [x] **Módulo 1: Backend Tray y QuickLook en Rust**
  - [x] Añadir opción «Reiniciar Prisma» en el menú contextual del System Tray (`src-tauri/src/lib.rs`).
  - [x] Restringir `open_detached` exclusivamente a `QuickLookMediaType::Image` y `QuickLookMediaType::Video` (`src-tauri/src/features/quick_look/service.rs`).
  - [x] Configurar `.skip_taskbar(true)` y `.always_on_top(true)` en la creación de ventanas secundarias (`service.rs`).
  - [x] Reforzar visibilidad y z-order en `handle_selection_update` (`service.rs`) con `SW_SHOWNOACTIVATE` y `HWND_TOP`.

- [x] **Módulo 2: Frontend QuickLook & Error Handling**
  - [x] Crear componente `QuickLookErrorBoundary.tsx` para aislamiento de fallos en tiempo de ejecución.
  - [x] Integrar `QuickLookErrorBoundary` en `QuickLookWindow.tsx` envolviendo el contenido de `quicklook-body`.
  - [x] Condicionar la presencia del botón `onOpenDetached` en `QuickLookWindow.tsx` a `!isDetached && (mediaType === "image" || mediaType === "video")`.
  - [x] Actualizar tooltip y semántica del botón `layers` en `QuickLookHeader.tsx`.
  - [x] Blindar `QuickLookImage.tsx` con manejo de `onError`, estados de carga y recuperación ante fallos de asset protocol o WebView2.
  - [x] Permitir atajo de refresco manual (`F5` / `Ctrl+R`) en la ventana de QuickLook.

- [x] **Módulo 3: Validación y Verificación**
  - [x] Compilación frontend con `bun run build`.
  - [x] Comprobación de compilación Rust y pruebas con `cargo check` / `cargo test` (34 tests superados exitosamente).
  - [x] Documentar evidencia en `VALIDATION.md` y formalizar en `APPROVAL.md`.
  - [ ] Generar checkpoint commit en rama `preview`.
