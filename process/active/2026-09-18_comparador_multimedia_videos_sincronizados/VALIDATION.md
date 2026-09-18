# Comparador Multimedia (Fotos y Vídeos Sincronizados) — Validación

- Estado: `PENDING`

## Comprobaciones

- [ ] V01 — Agente — Compilación con `bun run build` y verificación de tipos TypeScript sin errores.
- [ ] V02 — Agente — Auditoría de líneas en componentes modificados asegurando que ningún archivo exceda 1,200 líneas.
- [ ] V03 — Tester — Arrastrar o seleccionar 2 vídeos en el comparador y verificar reproducción simultánea.
- [ ] V04 — Tester — Comprobar que al pasar el ratón sobre el Vídeo A suena el Vídeo A (Vídeo B silenciado) y viceversa con indicador visual 🔊.
- [ ] V05 — Tester — Usar la barra de transporte para pausar/reanudar y mover el scrubber verificando que ambos vídeos se posicionen en el mismo segundo.
- [ ] V06 — Tester — Abrir "Buscador de Duplicados" en pestaña Vídeos y pulsar "Comparar" para validar que se abre la comparativa frente a frente.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
