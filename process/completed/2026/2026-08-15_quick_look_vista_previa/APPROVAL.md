# Aprobación: Prisma Quick Look (Previsualización Rápida con Espacio)

- **Fecha de Conclusión**: 2026-08-15
- **Responsable**: biglexj
- **Estado**: `APPROVED`
- **Decisión**: Aprobado e implementado al 10,000 millones por ciento.

## Decisiones y Alcance
- [x] Hook global de teclado seguro en Windows (`WH_KEYBOARD_LL`) con filtro estricto para no interceptar texto durante renombramientos o en cajas de entrada.
- [x] Extracción ultraligera de selección en Explorador de Windows (`CabinetWClass`) y Escritorio (`Progman`/`WorkerW`) vía COM (`IShellWindows`, `IFolderView`).
- [x] Ventana secundaria `quicklook` en Tauri v2 (`transparent: true`, `decorations: false`, `alwaysOnTop: true`) precargada en memoria.
- [x] Visores dedicados y minimalistas para los 3 medios soportados:
  - **Música**: Carátula cuadrada, metadatos, transporte, volumen y paleta tonal adaptativa.
  - **Imagen**: Auto-fit de alta resolución, badge de dimensiones y zoom suave.
  - **Vídeo**: Reproducción instantánea con controles mínimos sobrepuestos.
- [x] Botón *"Abrir en Prisma"* para transferir el archivo a la ventana completa.
- [x] Cierre automático y liberación total de recursos en `Espacio`, `Esc` o pérdida de foco.
