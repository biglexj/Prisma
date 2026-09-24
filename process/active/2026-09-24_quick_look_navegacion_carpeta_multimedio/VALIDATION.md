# 2026-09-24_quick_look_navegacion_carpeta_multimedio — Validación

- Estado: `PENDING`

## Comprobaciones

- [x] V01 — Agente — Comprobación de compilación frontend (`tsc --noEmit` y `bun run build`). Esperado: compilación exitosa sin errores de tipos ni de bundle. (Validado: `tsc` y `vite build` completados con éxito).
- [x] V02 — Agente — Comprobación de compilación Rust backend (`cargo check`). Esperado: compilación exitosa sin advertencias críticas ni errores. (Validado: `cargo check` completado con código 0 y 0 advertencias).
- [ ] V03 — Tester — Abrir un archivo en Quick Look desde una carpeta con imágenes, vídeos, música y texto. Esperado: el paginador indica el conteo total de elementos compatibles y permite avanzar/retroceder.
- [ ] V04 — Tester — Maximizar/expandir Quick Look a pantalla completa y presionar flechas del teclado (`ArrowLeft` / `ArrowRight`) o hacer clic en los botones laterales. Esperado: transiciona suavemente entre los diferentes archivos de la carpeta sin desvincularse.
- [ ] V05 — Tester — Editar y sobrescribir una imagen en un editor externo (ej. Affinity) con el mismo nombre y abrirla en Quick Look. Esperado: Quick Look muestra inmediatamente la versión nueva y no la imagen previa en caché.
- [x] V06 — Agente — Comprobación de compilación tras la integración del comando `music_library_scan_folder_tracks` y servicio `folderQueueResolver`. Esperado: `cargo check` y `bun run build` exitosos con 0 errores. (Validado: compilado exitosamente).
- [ ] V07 — Tester — Abrir una canción externa (ej. canción 5 de una carpeta con 31 canciones desde Quick Look «Abrir en Prisma» o explorador de Windows). Esperado: Prisma crea la cola con el nombre de la carpeta (ej. `Music`), la canción 5 es la #1 en la cola y comienza a reproducirse de inmediato, y todas las demás canciones de la carpeta le siguen en orden correlativo circular, ignorando imágenes, vídeos y subcarpetas.
- [x] V08 — Agente — Comprobación de eliminación de parpadeo de consola y llamadas redundantes a `ffprobe` al abrir vídeos MKV (`CREATE_NO_WINDOW (0x08000000)` en `get_video_dimensions_ffprobe`, caché de `current_payload` y propagación de `known_dims` a `resolve_media_size`). Esperado: `cargo check` y 34/34 tests unitarios pasando limpiamente. (Validado: 34 tests pasados en 2.77s).
- [ ] V09 — Tester — Abrir un archivo `.mkv` con la barra espaciadora en Quick Look. Esperado: apertura limpia, fluida e instantánea sin destellos ni parpadeo doble de ventanas de consola.
- [x] V10 — Agente — Comprobación de compilación tras la solución de fijado (pinning), `always_on_top` y sincronización de hooks. Esperado: `cargo check` y `bun run build` exitosos con 0 errores. (Validado: cargo check en 3.55s, cargo test 34/34 ok en 1.46s, bun run build en 3.34s).
- [ ] V11 — Tester — Fijar ventana de Quick Look con el botón pin (`📌`). Abrir otra aplicación, teclear o cambiar foco. Esperado: la ventana permanece visible siempre encima (`always_on_top`), no se cierra ni se minimiza; al regresar a Explorer y pulsar Espacio sobre otro archivo, la ventana fijada se actualiza fluidamente sin cerrarse ni bloquearse el sistema.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
