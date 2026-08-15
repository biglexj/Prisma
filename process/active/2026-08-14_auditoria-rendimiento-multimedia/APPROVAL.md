# Aprobación — Auditoría de rendimiento multimedia de Prisma

- Estado: `AWAITING_BIGLEX`
- Fecha: `2026-08-14`
- Implementación autorizada: `NO`

## Alcance confirmado

- [x] Prisma es el proyecto auditado y problemático.
- [x] Lienzo se utiliza solo como referencia visual, funcional y estructural.
- [x] No se propone portar el stack Android de Lienzo.

## Decisiones pendientes

- [ ] `A0` Aprobar el plan y autorizar únicamente la Fase 0 de medición.
- [ ] `A1` Aprobar o ajustar los presupuestos provisionales.
- [ ] `A2` Indicar la raíz Git real de Prisma o autorizar un respaldo alternativo.
- [ ] `A3` Después de la línea base, aprobar la corrección de carátulas y paletas.
- [ ] `A4` Aprobar cada fase posterior con su evidencia correspondiente.

## Decisiones no tomadas

- No se ha aprobado abandonar Tauri.
- No se ha aprobado reescribir Prisma en otro stack.
- No se ha aprobado modificar código.
- No se ha confirmado mediante runtime qué porcentaje del consumo corresponde a WebView2, carátulas o MPV.

## Criterio de cierre

El proceso solo podrá cerrarse cuando un build de producción demuestre memoria estable, reproducción real, cierre limpio y navegación visual funcional. Compilar no equivale a superar la auditoría.
