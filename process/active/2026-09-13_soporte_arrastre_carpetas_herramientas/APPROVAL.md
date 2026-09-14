# Soporte Universal de Arrastre de Carpetas en Herramientas — Aprobación

- Estado: `PENDING`

## Controles

- [ ] Validación técnica del agente.
- [ ] Validación funcional del tester.
- [ ] Aprobación final de Biglex.
- [ ] `ROADMAP.md` actualizado.
- [ ] Sesión cerrada con resumen breve.

## Decisión

- [ ] `APPROVED`
- [ ] `REWORK`
- [ ] `CANCELLED`
- [ ] `SUPERSEDED`

## Resumen

- Soporte de arrastre y soltado de carpetas en Renombrador, Conversor y Duplicados.
- Unificación de eventos nativos de Tauri v2 (`tauri://drag-drop` y `onDragDropEvent`).
- Detección automática del tipo de medio en el Conversor al soltar carpetas completas.
- Prevención de bloqueos de cursor en WebView2 mediante `dragover` global continuo.

## Destino

- `APPROVED` con todos los controles completos → `process/completed/YYYY/`.
- `CANCELLED`, `SUPERSEDED` o cierre incompleto → `process/archive/YYYY/`.
- `REWORK` → permanece en `process/active/`.

Mueve la carpeta completa y no conserves una copia duplicada en `active`.
