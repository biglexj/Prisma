# Validación: Ajuste de Opacidad y Distinción de Reposo vs Apagado en Espectro DSP

## Evidencias de Ejecución

### 1. Desacoplamiento de Estados Semánticos
- En `DspEqualizerView.tsx`, se computa la clase semántica `visualizerStatusClass`:
  - `active` cuando hay señal de audio activa y DSP habilitado.
  - `standby` cuando DSP está habilitado (`POWER ON`) pero no hay reproducción de audio activa.
  - `off` cuando DSP está deshabilitado (`BYPASS`).

### 2. Calibración de Transparencia y Visibilidad
- **Estado `standby` (POWER ON en reposo)**:
  - Contenedor `.dsp-visualizer-bar.standby`: opacidad 95%.
  - Columnas `.dsp-viz-column`: opacidad aumentada al 60% con `height: 3px` y `background: var(--outline-variant, rgba(255, 255, 255, 0.35))`, destacando con nitidez los puntos de referencia sin competir con los bordes de la tarjeta ni saturar.
- **Estado `off` (DSP BYPASS / Apagado)**:
  - Contenedor `.dsp-visualizer-bar.off`: opacidad al 65%.
  - Columnas `.dsp-viz-column`: opacidad al 22%, permaneciendo visiblemente apagado y discreto.

### 3. Build & Typecheck
- **Frontend**: `bun run build` (`tsc --noEmit && vite build`) completado con éxito en 3.20s, 0 errores tipográficos.
