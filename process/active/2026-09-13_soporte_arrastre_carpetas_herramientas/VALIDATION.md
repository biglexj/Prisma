# Soporte Universal de Arrastre de Carpetas en Herramientas — Validación

- Estado: `PASSED`

## Comprobaciones

- [x] V01 — Agente — Comprobar que el evento `dragover` global esté activo en todas las vistas de herramientas sin mostrar cursor 🚫.
- [x] V02 — Agente — Comprobar que arrastrar una carpeta en el Renombrador cargue la ruta y liste sus archivos inmediatamente.
- [x] V03 — Agente — Comprobar que arrastrar un archivo individual en el Renombrador cargue la carpeta contenedora.
- [x] V04 — Agente — Comprobar que arrastrar una carpeta de audio/imagen/vídeo en el Conversor escanee sus archivos compatibles y los agregue a la cola.
- [x] V05 — Agente — Comprobar que arrastrar una carpeta en Duplicados asigne la ruta a la zona de escaneo correspondiente.
- [x] V06 — Agente — Ejecutar `bun run check` (TypeScript), build web y pruebas unitarias nativas (`cargo test`) sin errores.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
