# Soporte para Vídeos MOV y Códecs Profesionales (CineForm, ProRes) en Reproductor y Visores — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Backend: Añadir fallback a FFmpeg para miniaturas de vídeo en `load_video_thumbnail_data_url` cuando Windows Shell falle.
- [x] T02 — Backend: Implementar comando `video_get_playback_source` e inspección de códec con generación de proxy en caché para códecs no web.
- [x] T03 — Frontend: Conectar `VideoPlayer.tsx` a `video_get_playback_source`, corregir visualización de fallos de códec y añadir estado de optimización fluida.
- [x] T04 — Frontend: Adaptar `QuickLookVideo.tsx` para resolver la fuente reproducible y mostrar miniaturas nativas sin errores.
- [x] T05 — Validación técnica con `Marcar.mov` y compilación de suite completa.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
