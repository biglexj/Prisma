# Soporte Universal de Arrastre de Carpetas en Herramientas — Tareas

- Estado: `DONE`

## Tareas de Ejecución

- [x] T01 — Asegurar `dragover` global con `e.preventDefault()` en toda la aplicación para evitar el icono de bloqueo (🚫) de Windows en cualquier vista.
- [x] T02 — Refactorizar la recepción de rutas nativas en el Renombrador (`useRenamer.ts`), escuchando `tauri://drag-drop` y `onDragDropEvent` para carpetas y archivos.
- [x] T03 — Mejorar la detección de carpetas en el Conversor (`useMediaConverter.ts`): al soltar una carpeta, auto-detectar el tipo de medio (audio/video/imagen) e incorporar los archivos a la cola.
- [x] T04 — Eliminar la dependencia rota de `e.dataTransfer.files` (sin `File.path` en WebView2) en `PrismaConvertView.tsx` y `DuplicatesScannerModal.tsx`.
- [x] T05 — Conectar la asignación de carpetas en Duplicados (`DuplicatesScannerModal.tsx`) con el canal de eventos nativo de Tauri v2.
- [x] T06 — Validar con chequeo de tipos (`bun run check`), build web y pruebas en vivo.
- [x] T07 — Registrar comprobaciones en `VALIDATION.md` y preparar `APPROVAL.md`.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
