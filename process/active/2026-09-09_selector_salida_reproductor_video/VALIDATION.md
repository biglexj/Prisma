# Selector de Salida y Ecualizador en Reproductor de Vídeo — Validación

- Estado: `PENDING`

## Comprobaciones

- [x] V01 — Agente — Comprobación de compilación TypeScript (`bun run build` o `tsc`). Esperado: compilación exitosa sin errores de tipos (dist generado correctamente en 3.20s).
- [x] V02 — Agente — Renderizado del botón de salida de audio en la barra inferior del reproductor de vídeo. Esperado: botón visible con icono de ecualizador y ancla popover integrada junto al volumen.
- [ ] V03 — Tester — Apertura y cierre del popover de dispositivos de audio. Esperado: despliegue fluido hacia arriba a la derecha, listando los endpoints reales del sistema (altavoces, auriculares) con el seleccionado marcado.
- [ ] V04 — Tester — Cambio de dispositivo de salida en plena reproducción de vídeo. Esperado: el audio conmuta al dispositivo seleccionado sin interrupciones.
- [ ] V05 — Tester — Apertura del Ecualizador DSP desde el botón de acceso directo del popover. Esperado: el modal del ecualizador se despliega permitiendo modificar efectos y bandas.
- [ ] V06 — Dispositivo — Comportamiento al desconectar o reconectar auriculares. Esperado: la lista se actualiza dinámicamente mediante el hook de endpoints.
- [x] V07 — Agente — Comprobación de posición dinámica del toast de captura con controles inactivos. Esperado: cuando los controles están ocultos (`controls-hidden`), el toast se sitúa a `bottom: 28px` evitando el espacio vacío inferior, y transiciona a `136px` al mostrarse los controles.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
