# Metadatos Técnicos y Marcado de Tomas de Vídeo (Workflow DaVinci) — Validación

- Estado: `PENDING`

## Comprobaciones

- [ ] V01 — Agente — Comprobación de extracción de metadatos técnicos con `ffprobe` (resolución, fps exactos, códec de vídeo/audio, color transfer y primaries). Esperado: comando Tauri responde exitosamente con estructura JSON enriquecida en < 150ms.
- [ ] V02 — Agente — Comprobación de persistencia de marcadores de tomas (`video_takes.json`). Esperado: escrituras y lecturas atómicas preservadas en `%APPDATA%\com.biglexj.prisma\video_takes.json`.
- [ ] V03 — Tester — En `VideoPlayer.tsx`, alternar visualización de la ficha técnica HUD. Esperado: overlay no intrusivo con badges tonales de códec, resolución, fps y perfil de color.
- [ ] V04 — Tester — Durante la reproducción o pausa de un vídeo, pulsar teclas numéricas `1` (Good Take), `2` (Descarte), `3` (B-Roll) y `0` (Reset). Esperado: feedback visual inmediato y persistencia del estado.
- [ ] V05 — Tester — En `VisualLibrary.tsx`, filtrar vídeos por tipo de toma y observar mini-insignias en la cuadrícula. Esperado: filtrado instantáneo sin parpadeo.
- [ ] V06 — Agente — Validación técnica completa: `cargo test --features mpv` (34+ tests pasando) y `bun run check` (0 errores de TypeScript).

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
