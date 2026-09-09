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

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
