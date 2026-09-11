# Selector de Salida y Ecualizador en Reproductor de Vídeo — Tareas

- Estado: `PENDING`

## Ejecución

- [x] T01 — Propagar `onOpenEqualizer` desde `App.tsx` hacia `VideoPlayer`.
- [x] T02 — Conectar `useDsp()` en `VideoPlayer.tsx` y gestionar el estado del popover de dispositivos de salida.
- [x] T03 — Añadir el botón ancla y el menú popover de salida de audio (`video-audio-output-popover`) junto al control de volumen en `VideoPlayer.tsx`.
- [x] T04 — Integrar el cambio dinámico de dispositivo de salida en `useVideoAudioDsp.ts` mediante `setSinkId` (Web Audio / HTMLMediaElement) y sincronizarlo con `selectAudioDevice`.
- [x] T05 — Añadir estilos en `video-player.css` alineados con Material 3 Expressive, cuidando alineación hacia la derecha, elevación, desenfoque y micro-animaciones.
- [x] T06 — Preparar la validación y registrar comprobaciones en `VALIDATION.md`.
- [x] T07 — Ajustar posición dinámica de `.video-snapshot-toast` a `bottom: 28px` cuando los controles están inactivos/ocultos (`controls-hidden`), con transición suave de 260ms hacia `136px` cuando los controles se activan.
- [x] T08 — Unificar botón de ecualizador en `VideoPlayer.tsx` para abrir directamente `DspEqualizerModal` como en el reproductor de música, eliminando el popover intermedio y su botón redundante.
- [x] T09 — Propagar `prisma-audio-sink-change` desde `selectAudioDevice` en `useDspController.ts` para que cualquier cambio de salida en el modal se aplique instantáneamente al vídeo.
- [x] T10 — Pulir `.dsp-dropdown-list` y `.dsp-dropdown-item` en `dsp-equalizer.css` con padding de 6px, scrollbar estilizado y bordes sin colisión para evitar que los elementos activos se peguen a los límites.
- [x] T11 — Purgar estilos obsoletos del popover de salida en `video-player.css`.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
