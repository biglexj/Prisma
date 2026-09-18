# Tareas — Delegación de Edición de Documentos desde QuickLook a Prisma

- [x] 1. **Rust Backend**
  - [x] 1.1 Extender `OpenMediaPayload` con `edit_mode: Option<bool>` en `src-tauri/src/features/quick_look/service.rs`.
  - [x] 1.2 Actualizar `open_in_main` para recibir y emitir `edit_mode`.
  - [x] 1.3 Actualizar comando Tauri `quick_look_open_in_main` en `src-tauri/src/app/commands/quick_look.rs`.

- [x] 2. **QuickLook Client y Handlers**
  - [x] 2.1 Actualizar `client.ts` para enviar `editMode`.
  - [x] 2.2 Actualizar `handleEdit` en `QuickLookWindow.tsx` para llamar a `openInMain` con `editMode: true`.
  - [x] 2.3 Pasar `onEdit={handleEdit}` a `QuickLookMarkdown` y `QuickLookText`.
  - [x] 2.4 Actualizar tooltip en `QuickLookHeader.tsx` a *"Editar en Prisma (Editor de documentos)"*.

- [x] 3. **UI QuickLook (Markdown y Texto)**
  - [x] 3.1 Añadir botón de acción *"Editar"* en la barra de herramientas de `QuickLookMarkdown.tsx` y en el estado de documento vacío.
  - [x] 3.2 Añadir botón de acción *"Editar"* en la barra de herramientas de `QuickLookText.tsx`.
  - [x] 3.3 Agregar estilos en `quick-look-markdown.css`.

- [x] 4. **Ventana Principal (`App.tsx`) y `DocumentViewer`**
  - [x] 4.1 Escuchar `editMode` en el listener `prisma://open-media` de `App.tsx`.
  - [x] 4.2 Almacenar `activeDocumentInitialMode` y propagarlo a `<DocumentViewer />`.
  - [x] 4.3 Soportar `initialMode` en `DocumentViewer.tsx` y sincronizar `viewMode`.
  - [x] 4.4 Enfocar automáticamente el `<textarea>` en modo `split` o `code`.
  - [x] 4.5 Agregar placeholder en `<textarea>` y estado vacío amigable con botón de edición en vista previa.
  - [x] 4.6 Asegurar atajo `Ctrl+S` para guardar de inmediato.
  - [x] 4.7 Agregar estilos en `document-viewer.css`.

- [x] 5. **Verificación y Pruebas**
  - [x] 5.1 Ejecutar `cargo check` y verificar ausencia de advertencias.
  - [x] 5.2 Ejecutar `bun run build` y validar compilación TypeScript / Vite.
