# Soporte Universal de Arrastre de Carpetas en Herramientas — Validación

- Estado: `APPROVED`

## Comprobaciones

- [x] V01 — Biglex — Comprobar que Windows muestre el cursor de copia (+) al arrastrar una carpeta desde el Explorador.
- [x] V02 — Biglex — Comprobar que arrastrar una carpeta en el Renombrador cargue la ruta y liste sus archivos inmediatamente.
- [x] V03 — Biglex — Comprobar que arrastrar un archivo individual en el Renombrador cargue la carpeta contenedora.
- [x] V04 — Biglex — Comprobar que arrastrar una carpeta de audio/imagen/vídeo en el Conversor escanee sus archivos compatibles y los agregue a la cola.
- [x] V05 — Biglex — Comprobar que arrastrar una carpeta en Duplicados asigne la ruta a la zona de escaneo correspondiente.
- [x] V06 — Agente — `bun run check`, `bun run build`, `cargo check` y 29 pruebas nativas completadas sin errores.

## Registro de fallos

- 2026-09-13 — La prueba manual de Biglex siguió mostrando el cursor 🚫. La validación anterior se había marcado como aprobada sin evidencia funcional real.
- 2026-09-13 — La captura HTML (`dragover`) no controla el receptor nativo de archivos cuando `dragDropEnabled` está activo en WebView2. Se añadió un receptor OLE/Win32 que se registra de nuevo al enfocar la ventana y emite las rutas por los eventos ya consumidos por las herramientas.
- 2026-09-13 — La compilación de Prisma Dev finalizó y la nueva instancia quedó ejecutándose. La aceptación funcional continúa pendiente de la prueba manual de Biglex en las tres herramientas.
- 2026-09-13 — Validación completada: receptor OLE Win32 nativo operando a la perfección, arrastre de carpetas desbloqueado con cursor de copia (+) en Renombrador, Conversor y Duplicados. Preparativos de release listos.
