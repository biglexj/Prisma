# 2026-09-24_quick_look_navegacion_carpeta_multimedio — Validación

- Estado: `PENDING`

## Comprobaciones

- [x] V01 — Agente — Comprobación de compilación frontend (`tsc --noEmit` y `bun run build`). Esperado: compilación exitosa sin errores de tipos ni de bundle. (Validado: `tsc` y `vite build` completados con éxito).
- [x] V02 — Agente — Comprobación de compilación Rust backend (`cargo check`). Esperado: compilación exitosa sin advertencias críticas ni errores. (Validado: `cargo check` completado con código 0 y 0 advertencias).
- [ ] V03 — Tester — Abrir un archivo en Quick Look desde una carpeta con imágenes, vídeos, música y texto. Esperado: el paginador indica el conteo total de elementos compatibles y permite avanzar/retroceder.
- [ ] V04 — Tester — Maximizar/expandir Quick Look a pantalla completa y presionar flechas del teclado (`ArrowLeft` / `ArrowRight`) o hacer clic en los botones laterales. Esperado: transiciona suavemente entre los diferentes archivos de la carpeta sin desvincularse.
- [ ] V05 — Tester — Editar y sobrescribir una imagen en un editor externo (ej. Affinity) con el mismo nombre y abrirla en Quick Look. Esperado: Quick Look muestra inmediatamente la versión nueva y no la imagen previa en caché.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
