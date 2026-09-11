# Selector de Salida y Ecualizador en Reproductor de Vídeo — Validación

- Estado: `PENDING`

## Comprobaciones

- [x] V01 — Agente — Comprobación de compilación TypeScript (`bun run build` o `tsc`). Esperado: compilación exitosa sin errores de tipos (dist generado correctamente en 3.20s).
- [x] V02 — Agente — Renderizado del botón de salida de audio en la barra inferior del reproductor de vídeo. Esperado: botón visible con icono de ecualizador y ancla popover integrada junto al volumen.
- [x] V03 — Tester/Agente — Apertura y cierre directo del Ecualizador DSP desde el botón de la barra de vídeo. Esperado: clic en el botón con icono de ecualizador abre/alterna el modal `DspEqualizerModal` de forma limpia y consistente con el reproductor de música.
- [x] V04 — Agente — Cambio de dispositivo de salida en plena reproducción de vídeo vía `prisma-audio-sink-change`. Esperado: `useDspController.selectAudioDevice` emite el evento y conmuta `setSinkId` en el vídeo/WebAudio sin interrupciones.
- [x] V05 — Agente — Espaciado y scrollbar de menús desplegables del ecualizador. Esperado: `.dsp-dropdown-list` tiene padding de 6px y scrollbar de 4px; los elementos activos no colisionan ni se pegan a los bordes.
- [ ] V06 — Dispositivo — Comportamiento al desconectar o reconectar auriculares. Esperado: la lista se actualiza dinámicamente mediante el hook de endpoints.
- [x] V07 — Agente — Comprobación de posición dinámica del toast de captura con controles inactivos. Esperado: cuando los controles están ocultos (`controls-hidden`), el toast se sitúa a `bottom: 28px` evitando el espacio vacío inferior, y transiciona a `136px` al mostrarse los controles.
- [x] V08 — Agente — Compilación limpia de producción (`bun run build`). Esperado: 0 errores, bundle generado exitosamente.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
