# Plan — Activación Estricta de Tema Reactivo y Reposo Absoluto del Visualizador DSP

- **Fecha**: 2026-09-26
- **Objetivo**:
  1. Condicionar el tema dinámico reactivo a la música para que ÚNICAMENTE se active cuando una pista se esté reproduciendo activamente (estado Play real). Si la música está pausada, detenida o en cola inicial («Listo para reproducir»), la interfaz debe permanecer en el tema y colores predeterminados del usuario.
  2. Investigar y erradicar la causa raíz por la cual el visualizador de espectro del ecualizador DSP continuaba animándose con barras altas aun sin música sonando en el sistema, asegurando que quede 100% plano a 3px y estático en reposo.

## Diagnóstico Inicial

### 1. Tema Reactivo a la Música
En `src/app/App.tsx`:
```tsx
const isAudioPlaying = (!playback.snapshot.paused && Boolean(playback.snapshot.path || playback.queue.currentItem || (playback.snapshot.positionSeconds !== null && (playback.snapshot.durationSeconds ?? 0) > 0))) || false;
```
- ¿Qué valor tiene `playback.snapshot.paused` cuando una pista está cargada en cola en estado inicial?
- Si `playback.snapshot.path` es null o la sesión no ha iniciado, `playback.queue.currentItem` existe en la cola ("Cola 7 de 13").
- Si `!playback.snapshot.paused` es verdadero en el estado inicial de `snapshot` (o antes de que libmpv informe pausa), `isAudioPlaying` se convierte erróneamente en `true` simplemente porque hay un `playback.queue.currentItem` en cola!
- Esto hace que la paleta del álbum se active incluso con el reproductor detenido en «Listo para reproducir».
- Solución: la condición de audio en reproducción debe requerir explícitamente:
  `Boolean(!playback.snapshot.paused && playback.snapshot.path && (playback.snapshot.positionSeconds ?? 0) >= 0 && playback.isPlaying)` o equivalente, verificando que realmente esté en reproducción activa y no solo que exista un ítem en la cola.

### 2. Animación Residual en Espectro DSP
En `DspEqualizerView.tsx`:
- La condición `isVisualizerActive`:
  `dsp.enabled && (isPrismaAudioActive || isGlobalAudioActive)`
- En la captura del usuario, `POWER ON` está encendido y `Global` está encendido.
- Debemos auditar en detalle:
  a) En `DspEqualizerView.tsx`, ¿se está leyendo `dsp.globalPassthruStatus?.hasSignal`?
  b) En `wasapi_passthru.rs`:
     ¿Cómo reporta `get_status()`? ¿Qué devuelve `wasapi_passthru` cuando está en modo loopback o dispositivo virtual?
  c) En `dsp-equalizer.css`:
     Asegurar que cuando no haya señal activa, las barras no tengan ninguna animación activa y estén fijadas a 3px con fondo neutro.

## Pasos de Implementación
1. Corregir la lógica de `isAudioPlaying` en `App.tsx` y su enlace con `usePlaybackController`.
2. Auditar a fondo el cálculo de `has_signal` y el estado reactivo del espectro DSP.
3. Validar con compilación y pruebas de estado.
4. Documentar en `TASKS.md`, `VALIDATION.md` y `APPROVAL.md`.
