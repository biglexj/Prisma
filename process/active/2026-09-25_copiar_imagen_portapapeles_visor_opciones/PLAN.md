# Plan: Función Copiar Imagen al Portapapeles en Visor y Opciones de Imagen

- Fecha: 2026-09-25
- Rama: `preview`
- Responsable: Antigravity & biglexj

## Objetivo

Permitir copiar imágenes al portapapeles del sistema operativo de manera directa y universal, tanto desde el visor de fotos (`ImageViewer`) como desde los menús contextuales y de opciones de las tarjetas de imágenes en la biblioteca (`VisualLibrary`), posibilitando pegar la imagen como mapa de bits (PNG) en aplicaciones externas (Discord, WhatsApp, Telegram, Paint, Photoshop, Word, etc.).

Además, en la barra superior del visor de imágenes:
- Eliminar el botón de pantalla completa (`fullscreen`).
- Situar en el centro de los controles de acción el botón con el icono de copiar (`copy`).
- Habilitar el atajo de teclado global `Ctrl + C` para copiar la imagen actual mientras se visualiza.

## Componentes y Archivos a Modificar

1. `src/features/visual_library/services/imageClipboard.ts` (Nuevo):
   - Servicio utilitario para exportar la imagen actual (PNG o convertida vía `createImageBitmap` + `OffscreenCanvas` / Canvas a PNG Blob) y escribirla en `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`.
2. `src/features/visual_library/ui/ImageViewer.tsx`:
   - Eliminar el botón de pantalla completa del top-bar derecho.
   - Insertar el botón de copiar (`copy`) con su tooltip `Copiar imagen al portapapeles (Ctrl+C)` y feedback táctil.
   - Integrar atajo de teclado `Ctrl + C` en `handleKeyDown`.
   - Añadir "Copiar imagen (Ctrl+C)" al menú contextual del visor (`buildContextMenuItems`).
   - Conectar con `ViewerToolsMenu` y mostrar toast `📋 Imagen copiada al portapapeles`.
3. `src/features/visual_library/ui/components/ViewerToolsMenu.tsx`:
   - Añadir acción "Copiar imagen" con atajo visual `Ctrl+C` e icono `copy`.
   - Cambiar icono de "Abrir en otra instancia" a `external-link` para evitar colisión semántica.
4. `src/features/visual_library/ui/VisualLibrary.tsx`:
   - Añadir "Copiar imagen" con icono `copy` en el menú de opciones/contextual (`buildMenuItems`).
   - Mostrar toast de confirmación al copiar desde la cuadrícula.
5. `src/features/visual_library/ui/image-viewer.css` & `visual-library.css`:
   - Estilos para botón `.image-viewer-copy-btn` con clase de feedback momentáneo `.is-copied`.
   - Toast flotante centrado superior para feedback táctil en biblioteca visual.
