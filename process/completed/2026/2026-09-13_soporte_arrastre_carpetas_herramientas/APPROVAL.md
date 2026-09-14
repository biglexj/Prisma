# Soporte Universal de Arrastre de Carpetas en Herramientas — Aprobación

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

- Soporte de arrastre y soltado de carpetas en Renombrador, Conversor y Duplicados.
- Recepción dual mediante el evento OLE propio de Prisma y `onDragDropEvent` como respaldo.
- Detección automática del tipo de medio en el Conversor al soltar carpetas completas.
- Prevención de bloqueos de cursor en WebView2 mediante `dragover` global continuo.
- Corrección adicional: receptor OLE/Win32 propio con re-registro al enfocar Prisma, porque la prueba real demostró que `dragover` no resolvía la recepción nativa.

## Destino

- `APPROVED` con todos los controles completos → `process/completed/YYYY/`.
- `CANCELLED`, `SUPERSEDED` o cierre incompleto → `process/archive/YYYY/`.
- `REWORK` → permanece en `process/active/`.

Mueve la carpeta completa y no conserves una copia duplicada en `active`.
