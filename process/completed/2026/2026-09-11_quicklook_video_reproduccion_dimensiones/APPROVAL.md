# QuickLook: Corrección de Dimensiones, Caché y Reproducción de Vídeo Sobrescrito — Aprobación

- Estado: `APPROVED`

## Controles

- [x] Validación técnica del agente.
- [x] Validación funcional del tester.
- [x] Aprobación final de Biglex.
- [x] `ROADMAP.md` actualizado.
- [x] Sesión cerrada con resumen breve.

## Decisión

- [x] `APPROVED`
- [ ] `REWORK`
- [ ] `CANCELLED`
- [ ] `SUPERSEDED`

## Resumen

- Corrección del GUID de PKEY_VIDEO_FRAME_WIDTH/HEIGHT y fallback ffprobe para dimensiones exactas.
- Caché busteado en `<video>` y desmontaje limpio para archivos sobrescritos (ej. DaVinci Resolve).
- Eliminación del parpadeo negro con poster inmediato y tamaño de apertura proporcionado/discreto.

## Destino

- `APPROVED` con todos los controles completos → `process/completed/2026/`.
- `CANCELLED`, `SUPERSEDED` o cierre incompleto → `process/archive/2026/`.
- `REWORK` → permanece en `process/active/`.

Mueve la carpeta completa y no conserves una copia duplicada en `active`.
