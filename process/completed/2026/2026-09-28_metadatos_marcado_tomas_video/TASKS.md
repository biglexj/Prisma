# Metadatos Técnicos y Marcado de Tomas de Vídeo (Workflow DaVinci) — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Backend Rust: comando `video_get_technical_metadata` para extracción de códec, fps, resolución, bitrate, color transfer/space/primaries con `ffprobe`.
- [x] T02 — Backend Rust: persistencia y comandos `video_get_take_marker`, `video_set_take_marker` y `video_list_take_markers` (`video_takes.json`).
- [x] T03 — Frontend UI: creación de `VideoTechnicalHud.tsx` con badges de telemetría técnica (Material 3 Expressive).
- [x] T04 — Frontend UI: integración de marcado rápido (atajos numéricos `1`, `2`, `3`, `0` y paleta de color DaVinci) en `VideoPlayer.tsx`.
- [x] T05 — Frontend UI: filtros rápidos por toma y mini-insignias en `VisualLibrary.tsx`.
- [x] T06 — Pruebas unitarias de Rust y verificación de tipos TypeScript (`tsc --noEmit`).
- [x] T07 — Preparar la validación y evidencias en `VALIDATION.md`.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
