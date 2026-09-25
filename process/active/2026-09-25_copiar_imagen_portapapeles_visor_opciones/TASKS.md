# Tareas: Función Copiar Imagen al Portapapeles

## Tareas

- [x] 1. Crear servicio `imageClipboard.ts` con manejo eficiente y robusto de decodificación y escritura en portapapeles (`ClipboardItem`).
- [x] 2. Actualizar `ViewerToolsMenu.tsx` añadiendo "Copiar imagen (Ctrl+C)" y ajustando el icono de "Abrir en otra instancia".
- [x] 3. Modificar `ImageViewer.tsx`:
  - [x] Eliminar botón de fullscreen de la barra superior.
  - [x] Añadir botón de copiar con icono `copy` en el grupo central de acciones (`[Favorito] [Copiar] [Papelera]`).
  - [x] Soporte para atajo `Ctrl + C` en `handleKeyDown`.
  - [x] Añadir "Copiar imagen" al menú contextual de clic derecho.
  - [x] Toast unificado de feedback `📋 Imagen copiada al portapapeles`.
- [x] 4. Modificar `VisualLibrary.tsx`:
  - [x] Añadir "Copiar imagen" en `buildMenuItems` para imágenes.
  - [x] Feedback visual con toast superior al copiar desde la cuadrícula.
- [x] 5. Actualizar hojas de estilos CSS (`image-viewer.css`, `visual-library.css`).
- [x] 6. Comprobación y validación de tipos (`bun run check`).
- [x] 7. Commit de resguardo (checkpoint) en `preview`.
