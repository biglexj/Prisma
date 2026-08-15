# Plan: Corrección de Carátulas y Hover Overlay en Biblioteca Musical

## Contexto & Objetivo
El usuario reportó dos aspectos a corregir en la vista de **Biblioteca Musical**:
1. **Carátulas no visibles / colapsadas**: Las tarjetas musicales estaban usando la clase de grilla `bento-grid-layout` con filas de 42px sin definir spans explícitos, provocando que la cubierta (`.music-media-frame`) se colapsara. Se cambiará la grilla a un **Music Grid** responsivo (`grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))`) con aspect ratio 1:1 para las carátulas y un icono/gradiente placeholder tonal elegante.
2. **Hover Overlay con Título y Artista en 1 Línea Cada Uno**: Al pasar el cursor sobre cualquier tarjeta de música, aparecerá un overlay con degradado oscuro y desenfoque de vidrio, desplegando:
   - **Línea 1**: Título de la canción (1 línea con elipsis si es largo).
   - **Línea 2**: Artista / Carpeta (1 línea con elipsis si es largo).
   - Botón de reproducción flotante.

## Cambios Propuestos

### Frontend (`src/features/music_library`)
- **[MODIFY] [MusicLibrary.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/music_library/ui/MusicLibrary.tsx)**:
  - Actualizar `MusicCard` para incluir el placeholder del icono de música, el `MusicArtwork` y la capa `.music-hover-overlay` con `music-hover-title` y `music-hover-artist`.
  - Simplificar la estructura del grid de `bento-grid-layout` a `music-auto-grid` para asegurar que las tarjetas de álbumes sean cuadradas y homogéneas.
- **[MODIFY] [music-library.css](file:///d:/Proyectos/biglexj/Prisma/src/features/music_library/ui/music-library.css)**:
  - Definir `.music-auto-grid` con `repeat(auto-fill, minmax(180px, 1fr))`.
  - Definir `.music-media-frame` con `aspect-ratio: 1` y fondo de gradiente tonal con icono SVG placeholder.
  - Diseñar `.music-hover-overlay`, `.music-hover-title` y `.music-hover-artist` con truncado en 1 línea (`white-space: nowrap`, `text-overflow: ellipsis`) y animación suave de hover.

## Plan de Verificación

### Pruebas Automatizadas
- `bun run check`: Comprobar cero errores de sintaxis o tipos TypeScript.

### Verificación Manual
- Navegar a **Música** en la biblioteca: comprobar que todas las tarjetas se muestran grandes y cuadradas (1:1) con la carátula visible o un placeholder elegante.
- Hacer hover sobre cualquier tarjeta: comprobar que aparece el overlay mostrando el título en 1 línea y el artista/carpeta en 1 línea con elipsis si excede el tamaño.
