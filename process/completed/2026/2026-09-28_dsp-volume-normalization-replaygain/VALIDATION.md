# Normalización de Volumen y ReplayGain Conmutable en DSP — Validación

- Estado: `PASSED`
- Fecha: `2026-09-28`

## Resumen del Proceso

Validación del sistema de normalización de volumen acústica automática (-14 LUFS / RMS) y lectura de ReplayGain conmutable en DSP (pipeline WASAPI nativo y motor MPV) con botón en el Ecualizador y atajo de teclado dedicado en Prisma.

## Matriz de Comprobaciones

| Prueba | Comando / Acción | Resultado Esperado | Estado |
|---|---|---|---|
| Compilación TypeScript | `bun run tsc --noEmit` | Cero errores de tipos | ✅ PASADO (exit 0) |
| Compilación Rust | `cargo check` en `src-tauri` | Cero errores backend | ✅ PASADO (exit 0, 2.74s) |
| Pipeline WASAPI DSP | Activar normalización en DSP | AGC adaptativo -14 LUFS, slew rate 500ms, gate -55 dBFS | ✅ Implementado |
| Pipeline MPV | Reproducir pistas con diferente ganancia | `replaygain=track` + `dynaudnorm` activados | ✅ Implementado |
| Conmutador en UI | Pulsar botón en Ecualizador | Alternancia con punto tonal activo verde (Material 3) | ✅ Implementado |
| Atajo de Teclado | Pulsar `Shift + N` globalmente | Toast "🔊 Normalización de volumen acústica (ReplayGain)" | ✅ Implementado |

## Registro de Evidencias

- `tsc --noEmit` exit code 0 — sin errores de tipos ni advertencias.
- `cargo check` exit code 0 — 0 errores, 0 warnings en Rust backend.
- Conteos de línea: `App.tsx` 1637 | `DspEqualizerView.tsx` 981 | `useDspController.ts` 493 — todos dentro del límite de 1200 líneas.
- Error residual `setVolumeLeveling` detectado en T07 y corregido antes del cierre: la llamada obsoleta fue eliminada del botón "Restablecer Controles" en `DspEqualizerView.tsx`.
