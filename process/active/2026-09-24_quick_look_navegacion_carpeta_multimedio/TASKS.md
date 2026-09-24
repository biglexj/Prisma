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
- [x] T08 — Implementar comando Tauri `music_library_scan_folder_tracks` en Rust (`src-tauri/src/app/commands/music_library.rs`) para escanear únicamente audios en la carpeta inmediata, ignorando imágenes, vídeos y subcarpetas, y ordenándolos naturalmente.
- [x] T09 — Registrar el comando `music_library_scan_folder_tracks` en el invoke_handler de `src-tauri/src/lib.rs`.
- [x] T10 — Crear servicio `folderQueueResolver.ts` en `src/features/playback/services/` para estructurar la cola con la canción seleccionada como la #1 en la cola y las demás siguiéndole en secuencia natural con ciclo completo.
- [x] T11 — Refactorizar `playMusicItem` en `src/app/App.tsx` para usar `resolveMusicQueueForPath`, optimizando y reduciendo la deuda técnica de líneas de `App.tsx`.
- [x] T12 — Validar compilación con `cargo check` y `bun run build`.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
