# Salidas de Audio Múltiples Simultáneas — Aprobación

- Estado: `PENDING`

## Controles

- [x] Validación técnica del agente.
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

- Plan estructurado para salidas de audio múltiples simultáneas en Windows mediante arquitectura WASAPI / Bridge DSP.
- Interfaz en el Ecualizador, control de ganancia individual y atajo de teclado para alternancia rápida.
- Revisión del 29 de septiembre: se conservan ajustes de salidas ausentes, se sigue la principal base y se aísla el fallo de secundarias. 14 pruebas de TypeScript, 3 de Rust y compilación frontend correctas; recepción física/reconexión audible pendiente.
- Biglex aprobó cambiar el global a Ctrl + Alt + Mayús + P tras identificar que AutoHotkey usa Ctrl + Alt + Mayús + O para `aurora-stop all`. El local permanece Ctrl + Mayús + O. Después confirmó el global desde otra aplicación sin abrir Aurora y el selector sin bloque técnico.
- La validación completa del proceso sigue pendiente de desconexión/reconexión física; Biglex indicó que aún no hizo esa prueba.
