# Plan: Ajuste de Opacidad y Distinción de Reposo vs Apagado en Espectro DSP

## Contexto y Diagnóstico
En la vista de Ecualizador & DSP de Audio (`DspEqualizerView`), el indicador superior de espectro (`dsp-visualizer-bar`) presenta una serie de columnas/puntitos que en reposo se mantienen en una línea plana de 3px.
Anteriormente, tanto cuando el DSP estaba apagado (BYPASS) como cuando estaba encendido (POWER ON) pero sin reproducir audio, se aplicaba la misma clase genérica `.dsp-visualizer-bar.inactive` con una opacidad reducida del 28% y contenedor al 75%, dando la apariencia de que el DSP estaba apagado incluso cuando el botón indicaba `POWER ON`.

El usuario ha indicado con suma precisión:
- **En Reposo (POWER ON pero sin reproducción)**: No debe verse tan apagado. Debe aumentarse la visibilidad/opacidad de los puntitos para que resalten más y sea evidente que el DSP está encendido y a la espera de señal, pero sin llegar a ser tan prominentes como los bordes de la tarjeta.
- **Apagado (BYPASS)**: Cuando el botón POWER esté apagado, en ese estado sí conviene que permanezca tenue y discreto como estaba.

## Objetivos
1. **Diferenciación Semántica de Estados en `DspEqualizerView.tsx`**:
   - Crear el descriptor de estado:
     - `active`: DSP encendido y audio activo (animación completa de barras).
     - `standby`: DSP encendido (`POWER ON`), pero en reposo/pausa (sin señal de audio).
     - `off`: DSP apagado (`BYPASS`).
2. **Refinamiento de Estilos en `dsp-equalizer.css`**:
   - `.dsp-visualizer-bar.standby`: Contenedor a `opacity: 0.95` y columnas a `opacity: 0.62` con `height: 3px`, logrando que los puntitos resalten nítidamente con elegancia sin saturar ni igualar el borde.
   - `.dsp-visualizer-bar.off`: Contenedor a `opacity: 0.65` y columnas a `opacity: 0.22`, representando fielmente el estado inactivo.
3. **Verificación y Pruebas**:
   - `bun run build` y `cargo check` sin errores.
   - Verificación visual de los 3 estados en la interfaz.
