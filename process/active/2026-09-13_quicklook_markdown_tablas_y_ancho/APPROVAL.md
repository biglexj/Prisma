# QuickLook: Soporte de Tablas Markdown y Reajuste de Anchura — Aprobación

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

- Soporte nativo de tablas Markdown GFM en QuickLook con alineaciones, encabezados y celdas estilizadas.
- Enlaces con código y formato enriquecido anidado resueltos sin rotura.
- Ancho de ventana para documentos al 60% de pantalla (`screen_w * 0.60`), conservando el padding superior compacto de 14px y reduciendo el padding lateral a 16px alineado con la barra de herramientas.
- Auto-cierre inteligente al deseleccionar (clic en punto vacío en Explorer/Escritorio), al hacer clic en otra app o al teclear fuera de QuickLook, preservando navegación continua al pulsar o hacer clic en otros archivos.
- Aislamiento estricto de la pestaña activa en Explorer de Windows 11: si la pestaña activa no tiene selección, no se realiza fallback a pestañas inactivas que contenían selecciones obsoletas de otras carpetas.
- Inmunidad total para herramientas de captura de pantalla (tecla `PrintScreen`/`Impr Pant`, atajo `Win+Shift+S`, y procesos `SnippingTool.exe`/`ScreenClippingHost.exe`), permitiendo capturar QuickLook sin que se cierre.

## Destino

- `APPROVED` con todos los controles completos → `process/completed/YYYY/`.
- `CANCELLED`, `SUPERSEDED` o cierre incompleto → `process/archive/YYYY/`.
- `REWORK` → permanece en `process/active/`.

Mueve la carpeta completa y no conserves una copia duplicada en `active`.
