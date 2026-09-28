# Normalización de Volumen y ReplayGain Conmutable en DSP — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Actualizar modelo de datos backend `DspConfig` y `DspParameters` en `src-tauri/src/features/playback/model.rs` y `src-tauri/src/infrastructure/media/passthru/dsp_engine.rs`.
- [x] T02 — Implementar algoritmo de normalización acústica automática y ReplayGain en tiempo real en `dsp_engine.rs`.
- [x] T03 — Sincronizar propiedad `replaygain` y filtro de normalización en `src-tauri/src/infrastructure/media/mpv.rs`.
- [x] T04 — Actualizar tipos frontend `src/features/dsp/model/types.ts` y controlador `src/features/dsp/useDspController.ts`.
- [x] T05 — Añadir botón / switch conmutable Material 3 Expressive en `src/features/dsp/ui/DspEqualizerView.tsx` y estilos en `dsp-equalizer.css`.
- [x] T06 — Integrar atajo de teclado global `Shift + N` con OSD / Toast en `src/app/App.tsx`.
- [x] T07 — Validar compilaciones con `bun run tsc --noEmit` y `cargo check` (ambas pasan, 0 errores).
- [x] T08 — Documentar evidencias en `VALIDATION.md`, cerrar `APPROVAL.md`, actualizar `ROADMAP.md` y generar commit de resguardo.
