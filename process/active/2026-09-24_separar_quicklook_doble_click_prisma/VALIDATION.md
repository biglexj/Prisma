# Separar Quick Look y Doble Clic en Prisma — Validación

- Estado: `VALIDATED`

## Comprobaciones

- [x] V01 — Agente — `bun run check` en frontend. Esperado: 0 errores de TypeScript. (Verificado: código de salida 0 sin errores).
- [x] V02 — Agente — `cargo check` en backend Rust. Esperado: compilación exitosa sin errores ni advertencias. (Verificado: código de salida 0 en 0.48s).
- [x] V03 — Agente — Inspección de `src-tauri/src/lib.rs` (cold start y single-instance). Esperado: doble clic / argumentos abren siempre en la ventana principal `main`, cierran Quick Look si estaba abierto y emiten `prisma://open-media`.
- [x] V04 — Agente — Inspección de `App.tsx` y `VideoPlayer.tsx`. Esperado: reemplazo fluido de vídeo activo sin interferencia de pausas residuales de Quick Look.
- [ ] V05 — Tester — Doble clic en explorador de Windows sobre un vídeo. Esperado: abre directamente en Prisma reemplazando el vídeo activo. Quick Look solo responde a la barra espaciadora.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
