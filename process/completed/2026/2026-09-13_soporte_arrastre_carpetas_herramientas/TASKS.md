# Soporte Universal de Arrastre de Carpetas en Herramientas — Tareas

- Estado: `DONE`

## Tareas de Ejecución

- [x] T01 — Asegurar `dragover` global con `e.preventDefault()` en toda la aplicación para evitar el icono de bloqueo (🚫) de Windows en cualquier vista.
- [x] T02 — Refactorizar la recepción de rutas nativas en el Renombrador (`useRenamer.ts`), escuchando `tauri://drag-drop` y `onDragDropEvent` para carpetas y archivos.
- [x] T03 — Mejorar la detección de carpetas en el Conversor (`useMediaConverter.ts`): al soltar una carpeta, auto-detectar el tipo de medio (audio/video/imagen) e incorporar los archivos a la cola.
- [x] T04 — Eliminar la dependencia rota de `e.dataTransfer.files` (sin `File.path` en WebView2) en `PrismaConvertView.tsx` y `DuplicatesScannerModal.tsx`.
- [x] T05 — Conectar la asignación de carpetas en Duplicados (`DuplicatesScannerModal.tsx`) con el canal de eventos nativo de Tauri v2.
- [x] T06 — Validar con chequeo de tipos (`bun run check`), build web, `cargo check` y 29 pruebas nativas.
- [x] T07 — Registrar comprobaciones en `VALIDATION.md` y preparar `APPROVAL.md`.
- [x] T08 — Sustituir la falsa dependencia del `dragover` HTML por un receptor nativo OLE/Win32 que acepta `CF_HDROP` y conserva el cursor de copia.
- [x] T09 — Volver a registrar el receptor nativo cuando la ventana principal recupera el foco, cubriendo el inicio oculto por `--autostart` y la recreación interna de superficies WebView2.
- [x] T10 — Recibir la validación manual de Biglex en Renombrador, Conversor y Duplicados.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
