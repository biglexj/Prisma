# Soporte para Vídeos MOV y Códecs Profesionales (CineForm, ProRes) en Reproductor y Visores — Plan

- Estado: `COMPLETED`
- Fecha: `2026-09-17`
- Proyecto: `Prisma`

## Objetivo

Habilitar soporte transparente de reproducción, previsualización y generación de miniaturas para archivos `.mov` y formatos de vídeo de alta fidelidad (GoPro CineForm `cfhd`, Apple ProRes, Animation `qtrle`) mediante detección inteligente, fallback por proxy ultrarrápido con FFmpeg y miniaturas nativas.

## Alcance

- Incluye:
  - Detección e inspección de códecs de vídeo con el FFprobe empaquetado (`vendor/ffmpeg/`).
  - Generación/reutilización de proxy de reproducción transparente de alta fidelidad H.264 para códecs no soportados nativamente por Chromium (CineForm `cfhd`, ProRes, etc.) con aceleración y modo silencioso (`CREATE_NO_WINDOW`).
  - Fallback a FFmpeg en Rust para miniaturas cuando Windows Shell (`IShellItemImageFactory`) no pueda decodificar el formato (ej. `.mov` CineForm).
  - Experiencia fluida en `VideoPlayer.tsx` y `QuickLookVideo.tsx`: indicador de optimización de alta calidad, manejo limpio de errores con acciones de rescate («Optimizar», «Abrir en reproductor externo», «Convertir»).
  - Pruebas unitarias de Rust y validación con el archivo real `D:\Vídeos\Partidos\Render\Marcar.mov`.
- No incluye:
  - Sustitución completa de WebView2 por renderizado OpenGL/libmpv de vídeo nativo (pertenece a la Fase 5 del Roadmap).
  - Recodificación destructiva de los archivos fuente originales.

## Enfoque

1. **Inspección y Servido de Reproducción en Rust**:
   - Crear comando `video_get_playback_source(path: String) -> Result<VideoPlaybackSource, String>` que detecte si el códec es web-nativo o requiere proxy transparente (`temp/prisma_video_proxies/`).
   - Implementar generador de proxy ultrarrápido en background (`libx264 -preset veryfast -crf 17 -pix_fmt yuv420p`).
2. **Miniaturas Universales**:
   - En `load_video_thumbnail_data_url`, añadir fallback con `ffmpeg -ss 0.1 -i ... -vframes 1` para archivos `.mov` o códecs profesionales donde el Shell de Windows retorne `None`.
3. **Integración en UI (VideoPlayer & QuickLook)**:
   - Integrar `video_get_playback_source` en `VideoPlayer.tsx` y `QuickLookVideo.tsx`.
   - Mostrar estado de carga/optimización si se genera el proxy.
   - Si ocurre cualquier error, corregir el bug de `VideoPlayer` que dejaba la pantalla negra y mostrar una tarjeta elegante con diagnóstico del códec y botones de acción rápida.

## Criterios de finalización

- [x] `D:\Vídeos\Partidos\Render\Marcar.mov` se reproduce de forma fluida en `VideoPlayer.tsx`.
- [x] La miniatura de `Marcar.mov` se genera exitosamente sin errores ni cuadros negros en la biblioteca y en QuickLook.
- [x] Archivos MP4/WebM nativos continúan reproduciéndose directamente sin sobrecarga ni proxy.
- [x] La compilación de TypeScript y las pruebas unitarias de Rust terminan con éxito.

## Autorización

- [x] Plan aprobado para ejecución.
