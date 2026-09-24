# 2026-09-24_quick_look_navegacion_carpeta_multimedio — Tareas

- Estado: `PENDING`

## Ejecución

- [x] T01 — Implementar `resolve_folder_selection` y la lógica de escaneo natural en `src-tauri/src/features/quick_look/service.rs`.
- [x] T02 — Integrar el soporte de carpeta en `show_current_selection`, `show_file_path` y `handle_selection_update` en Rust.
- [x] T03 — Incorporar `modifiedMillis` en `QuickLookPayload` e invalidar caché de renderizado en `QuickLookImage` y visores al sobrescribir/reemplazar archivos.
- [x] T04 — Habilitar atajos de teclado (`ArrowLeft` / `ArrowRight` / `PageUp` / `PageDown`) en `QuickLookWindow.tsx` para navegación secuencial.
- [x] T05 — Integrar botones flotantes laterales de navegación (`<` y `>`) en `QuickLookWindow.tsx` y sus estilos CSS en `quick-look.css`.
- [x] T06 — Verificar compilación TypeScript y Rust (`cargo check`).
- [x] T07 — Preparar la validación y evidencias en `VALIDATION.md`.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
