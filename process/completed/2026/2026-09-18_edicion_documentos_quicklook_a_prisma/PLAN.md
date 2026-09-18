# Plan — Delegación de Edición de Documentos desde QuickLook a Prisma

## Contexto y Diagnóstico
En QuickLook, al visualizar archivos de texto o Markdown (ej. `bilibili.md 0 B`), el botón de edición en la barra de herramientas ejecutaba un comando nativo `quick_look_edit_file` con el verbo `edit` de ShellExecute en Windows. En Windows, las extensiones `.md` carecen de una asociación registrada para `edit`, resultando en un fallo silencioso. Asimismo, QuickLook es por diseño un visor liviano de solo lectura (sin `<textarea>` ni soporte de entrada/pegado de texto).

Prisma ya cuenta en su ventana principal con `DocumentViewer`, un editor completo de documentos y Markdown con vista dividida (split-screen), previsualización reactiva en tiempo real, conteo de líneas/caracteres, indentación de tabulaciones, selección de tipografía, zoom y persistencia segura en disco con `Ctrl+S`.

El objetivo es conectar elegantemente el flujo de edición: al pulsar «Editar» en QuickLook (o en documentos vacíos), QuickLook cede el paso y transfiere el archivo a la ventana principal de Prisma, abriendo `DocumentViewer` directamente en modo edición (`split` para Markdown, `code` para texto), con el foco inmediato en el área de texto para escribir y pegar contenido.

## Objetivos
1. **Canal de transferencia con modo edición en Rust**: Extender el payload de `prisma://open-media` con `editMode: Option<bool>` en `quick_look_service.rs` y `quick_look.rs`.
2. **Cliente frontend de QuickLook**: En `client.ts` y `QuickLookWindow.tsx`, redirigir la acción de edición a `quickLookClient.openInMain(targetPath, undefined, true)`.
3. **Acciones de edición integradas en QuickLook**:
   - Actualizar tooltip del botón en `QuickLookHeader.tsx` a *"Editar en Prisma (Editor de documentos)"*.
   - Integrar botón de *"Editar"* en la barra de herramientas y estado vacío de `QuickLookMarkdown.tsx` y `QuickLookText.tsx`.
4. **Recepción en ventana principal (`App.tsx`)**: Propagar `editMode` en `handleOpenFile` y pasar `initialMode` a `DocumentViewer`.
5. **Editor `DocumentViewer.tsx`**:
   - Respetar `initialMode` (`split` o `code`).
   - Foco automático en el `<textarea>` para permitir tipeo y pegado inmediato de texto.
   - Placeholder descriptivo e intuitivo.
   - Estado amigable en vista previa para documentos vacíos con botón directo para comenzar a editar.
   - Asegurar persistencia fluida con `Ctrl+S` y botón Guardar.
