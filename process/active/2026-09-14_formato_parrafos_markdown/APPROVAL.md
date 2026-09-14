# Proceso: Distinción de Saltos de Línea y Párrafos en QuickLook Markdown — Aprobación

- Proceso: `2026-09-14_formato_parrafos_markdown`
- Fecha: `2026-09-14`
- Solicitante: `biglexj`
- Estado: `APPROVED`

## Resumen del Proceso

Corrección del renderizado de párrafos en el visor QuickLook Markdown para diferenciar estrofas y saltos simples frente a dobles saltos / líneas vacías, agrupando líneas consecutivas en el mismo `<p>` con `<br />` y respetando la separación entre párrafos.

## Decisión de Aprobación

- [x] Aprobado para ejecución y despliegue
- [ ] Requiere ajustes (ver observaciones)

### Observaciones
Implementación completada y validada con compilación limpia (`bun run build`, 0 errores). Los saltos simples se mantienen compactos dentro de sus estrofas y los saltos dobles separan nítidamente los bloques de párrafos.
