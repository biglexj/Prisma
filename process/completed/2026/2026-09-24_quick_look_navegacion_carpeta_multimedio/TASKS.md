# 2026-09-24_quick_look_navegacion_carpeta_multimedio — Tareas

- Estado: `COMPLETED`

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
- [x] T13 — Eliminar parpadeo doble al abrir MKVs en Quick Look configurando `CREATE_NO_WINDOW (0x08000000)` en `get_video_dimensions_ffprobe` (`src-tauri/src/features/quick_look/model.rs`).
- [x] T14 — Optimizar `resolve_media_size` en `service.rs` para reutilizar dimensiones ya calculadas por el payload en lugar de invocar `ffprobe` redundantemente.
- [x] T15 — Persistir `current_payload` en `QuickLookState` para evitar ejecuciones adicionales de `ffprobe` y mantener la información de selección sincronizada en `get_current_payload`.
- [x] T16 — Prevenir re-renderizados innecesarios en `QuickLookVideo.tsx` evitando llamadas redundantes a `onDimensionsLoad` cuando las dimensiones ya coinciden.
- [x] T18 — Corregir arquitectura de fijado (pinning) en Quick Look: sincronizar `IS_PINNED` en `keyboard_hook.rs`, activar `set_always_on_top`, evitar cierre por pulsaciones externas o cambio de foco, permitir actualización con Espacio desde Explorer y asegurar reseteo de `is_pinned` al ocultar (`hide()`).
- [x] T19 — Prevenir cierre accidental por barra espaciadora en `QuickLookWindow.tsx` cuando `isPinned` está activo y sincronizar estado en React ante eventos `quicklook://hide` y `quicklook://preview`.
- [x] T20 — Validar compilación Rust y Frontend (`cargo check` y `bun run build`).
- [x] T21 — Corregir reinicio de la aplicación desde la bandeja del sistema ("Reiniciar Prisma"): liberar mutex de instancia única (`tauri_plugin_single_instance::destroy`) y ejecutar un supervisor desacoplado (`Wait-Process` + `Start-Process`) para evitar la condición de carrera donde la nueva instancia es terminada por el bloqueo de instancia única de la instancia previa.
- [x] T22 — Validar compilación Rust y Frontend (`cargo check` y `bun run build`).

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
