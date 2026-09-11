# Selector de Salida y Ecualizador en Reproductor de Vídeo — Plan

- Estado: `DRAFT`
- Fecha: `2026-09-09`
- Proyecto: `Prisma`

## Objetivo

Integrar un selector de dispositivos de salida de audio y acceso directo al ecualizador DSP en la barra de controles del reproductor de vídeo (`VideoPlayer`).

## Alcance

- Incluye:
  - Botón selector de salida de audio en los controles de reproducción de vídeo (junto al control de volumen, en la posición indicada por el usuario).
  - Menú popover desplegable de selección de dispositivos de salida de audio (WASAPI / Web Audio), mostrando el dispositivo activo con marca de verificación.
  - Sincronización bidireccional en tiempo real con el estado de `useDsp()` (`audioEndpoints`, `selectedRenderDeviceId`, `selectAudioDevice`).
  - Sincronización física de salida de audio del elemento `<video>` y la cadena Web Audio API mediante `setSinkId` cuando el usuario cambie de dispositivo.
  - Acceso directo opcional en el popover para abrir el Ecualizador DSP (`DspEqualizerModal`), unificando la experiencia acústica.
  - Soporte para atajos de teclado y cierre al hacer clic fuera o presionar Escape.
- No incluye:
  - Modificación del motor de mezcla MPV nativo de música (ya cuenta con soporte en `useDspController`).

## Enfoque

1. Conectar `VideoPlayer` con el contexto `useDsp()` y propagar el callback `onOpenEqualizer` desde `App.tsx`.
2. Implementar en `VideoPlayer` el botón popover de dispositivos de salida de audio, situado junto al grupo de volumen (entre el porcentaje de volumen y el botón de captura de fotograma / cámara, o a la izquierda del grupo de volumen según la preferencia final).
3. Añadir el popover estilizado con Material 3 Expressive (`video-audio-output-popover`), listando los endpoints activos con selección instantánea y un botón para abrir el Ecualizador DSP completo.
4. Actualizar `useVideoAudioDsp.ts` para aplicar el cambio de `sinkId` al `AudioContext` / `<video>` cuando se alterne la salida.
5. Registrar y verificar en `VALIDATION.md` y `APPROVAL.md`.

## Criterios de finalización

- [ ] Botón de salida visible y accesible en la barra del reproductor de vídeo.
- [ ] Popover despliega la lista real de dispositivos de audio de Windows.
- [ ] Cambiar de dispositivo actualiza inmediatamente la salida de audio del vídeo y el estado global.
- [ ] Posibilidad de abrir el ecualizador DSP desde el control de vídeo.
- [ ] Cierre automático con clic exterior o tecla Escape.
- [ ] Compilación TypeScript y Vite sin errores.

## Autorización

- [ ] Plan aprobado para ejecución.
