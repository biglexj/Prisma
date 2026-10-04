# Integración de Motores Multi-Vendor en Prisma Upscaler — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Actualizar los modelos y definiciones en `ModelSelectModal.tsx` con `fsr1`, `nis`, `rtx-video` y `dlss-nr`, incluyendo escala 1x y visuales enriquecidos.
- [x] T02 — Actualizar `PrismaUpscalerView.tsx` para sincronizar la lista de modelos, selector de escalas dinámico (permitiendo 1x según el motor) y lógica de estado del motor.
- [x] T03 — Extender el backend en `src-tauri/src/app/commands/synapse.rs` para detectar motores multi-vendor y soportar la ejecución de `fsr1`, `nis`, `dlss-nr` y `rtx-video` junto a NCNN.
- [x] T04 — Validar la compilación de TypeScript (`bun run check`).
- [x] T05 — Validar la compilación del backend Rust (`cargo check` en `src-tauri`).
- [x] T06 — Registrar evidencias en `VALIDATION.md` y preparar `APPROVAL.md`.
