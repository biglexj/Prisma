# Normalización de Volumen y ReplayGain Conmutable en DSP — Plan

- Proceso: `process/active/2026-09-28_dsp-volume-normalization-replaygain`
- Fecha: `2026-09-28`
- Estado: `IN_PROGRESS`
- Autor: `biglexj` (2026)

## 1. Contexto y Justificación

En bibliotecas heterogéneas de música y vídeo (grabaciones analógicas clásicas, masters digitales modernos con loudness war, pistas Hi-Res FLAC con ReplayGain, pistas de YouTube o diálogos en películas), las variaciones bruscas de sonoridad aparente entre elementos obligan al usuario a ajustar manualmente el volumen de forma repetitiva.
Prisma cuenta con un pipeline de audio dual de alto rendimiento:
1. **Motor MPV** (para reproducción de audio y vídeo multiformato).
2. **Motor WASAPI Direct DSP** (`dsp_engine.rs`, procesamiento estéreo flotante SIMD con cero asignaciones en el bucle caliente).

El objetivo es incorporar **Normalización de Volumen Acústica y ReplayGain Conmutable**:
- Nivelación acústica automática al estándar de -14 LUFS / RMS.
- Soporte para etiquetas ReplayGain (Track / Album gain en MPV).
- Algoritmo AGC adaptativo en tiempo real en `dsp_engine.rs` para WASAPI (con puerta de silencio para evitar levantar el piso de ruido, interpolación de ganancia suave y limitador predictivo anti-clipping).
- Conmutador intuitivo de activación/desactivación en `DspEqualizerView.tsx` y en el modal de ecualizador.
- Atajo de teclado global dedicado (`Shift + N`) con indicador OSD / Toast flotante.

## 2. Alcance Técnico y Arquitectura

1. **Backend Rust (`src-tauri`)**:
   - `src-tauri/src/features/playback/model.rs`:
     - Agregar `pub volume_normalization: bool` al struct `DspConfig`.
     - Propagar `volume_normalization` en `From<&DspConfig>` hacia `DspParameters`.
   - `src-tauri/src/infrastructure/media/passthru/dsp_engine.rs`:
     - Agregar `pub volume_normalization: bool` a `DspParameters`.
     - Implementar seguidor RMS lento (ventana 400ms), rampa de ganancia suave (slew rate) y umbral de piso de ruido (-55 dBFS) dentro de `DspProcessor`.
   - `src-tauri/src/infrastructure/media/mpv.rs`:
     - Configurar propiedad nativa `replaygain` (`"track"` cuando esté activo, `"no"` cuando esté desactivado).
     - Incorporar filtro dinámico de normalización (`dynaudnorm` o `acompressor/loudnorm`) en la cadena `lavfi` de MPV cuando la normalización esté habilitada.
2. **Frontend TypeScript & React (`src/`)**:
   - `src/features/dsp/model/types.ts`:
     - Agregar `volumeNormalization: boolean` a `DspConfig`.
   - `src/features/dsp/useDspController.ts`:
     - Estado y método `toggleVolumeNormalization()`.
     - Persistencia en almacenamiento local para preservar la preferencia del usuario.
   - `src/features/dsp/ui/DspEqualizerView.tsx`:
     - Botón / Card conmutable Material 3 Expressive en el encabezado o columna de efectos con indicador LED / tonal.
   - `src/features/dsp/ui/dsp-equalizer.css`:
     - Estilos para el botón / switch de normalización.
   - `src/app/App.tsx`:
     - Integración del atajo de teclado global `Shift + N` (con Toast flotante y sincronización con el controlador DSP).

## 3. Plan de Verificación

- Compilación TypeScript sin errores (`bun run build`).
- Compilación Rust sin advertencias ni errores (`cargo check`).
- Validación de persistencia y conmutación.
