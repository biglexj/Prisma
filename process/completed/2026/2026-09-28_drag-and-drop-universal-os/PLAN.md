# Arrastre Nativo Universal hacia Aplicaciones Externas (Drag & Drop OS) — Plan

- Estado: `COMPLETED`
- Fecha: `2026-09-28`
- Proyecto: `Prisma`

## Objetivo

Habilitar el arrastre nativo de archivos desde Prisma hacia cualquier aplicación externa del sistema operativo (DaVinci Resolve, Affinity Photo/Designer/Publisher, Krita, Photoshop, Explorador de Windows, etc.) manteniendo presionado y arrastrando cualquier medio (vídeos, fotos, pistas de música, documentos PDF o archivos del catálogo).

## Alcance

- Incluye:
  - Integración de `tauri-plugin-drag` en Rust (`src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` / `main.rs`) y `@crabnebula/tauri-plugin-drag` en el frontend.
  - Habilitación de permisos `"drag:default"` en `src-tauri/capabilities/default.json`.
  - Creación de una utilidad transversal `src/shared/useNativeFileDrag.ts` que implementa `startNativeFileDrag` y `handleNativeDragStart` con badge de arrastre violeta en base64 de 32x32 incrustado para total resiliencia sin dependencias de disco.
  - Integración en componentes clave de Prisma:
    - Tarjetas de la Galería Visual ([VisualLibrary.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/visual_library/ui/VisualLibrary.tsx)).
    - Visor de imágenes ([ImageViewer.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/visual_library/ui/ImageViewer.tsx)) y Reproductor de vídeo ([VideoPlayer.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/visual_library/ui/VideoPlayer.tsx)).
    - Pistas de la Biblioteca de Música ([MusicCard.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/music_library/ui/MusicCard.tsx), [FolderManager.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/music_library/ui/FolderManager.tsx), [MediaTreeView.tsx](file:///d:/Proyectos/biglexj/Prisma/src/shared/ui/MediaTreeView.tsx), [PlaybackPreview.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/playback/ui/components/PlaybackPreview.tsx) y [PlaybackQueuePanel.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/playback/ui/components/PlaybackQueuePanel.tsx)).
    - Colecciones y Vistas Rápidas ([FavoritesView.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/collections/ui/FavoritesView.tsx) y [HomeDashboard.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/home/ui/HomeDashboard.tsx)).
  - Asegurar que no interfiera con el arrastre de archivos *hacia adentro* de Prisma (`tauri://drag-drop` / `useGlobalFileDrop`).
  - Verificación de compilación de Rust y TypeScript.
- No incluye:
  - Modificación de la estructura de base de datos ni persistencia de archivos.

## Enfoque

1. **Instalación y Registro de Dependencias**:
   - `cargo add tauri-plugin-drag` en `src-tauri`.
   - `bun add @crabnebula/tauri-plugin-drag` en la raíz.
   - Registrar `.plugin(tauri_plugin_drag::init())` en el builder de Tauri.
   - Añadir `"drag:default"` en `src-tauri/capabilities/default.json`.
2. **Hook / Helper Frontend**:
   - Crear `src/shared/useNativeFileDrag.ts` que ejecute `startDrag` usando OLE `CF_HDROP` y badge PNG embebido en memoria.
3. **Integración en Componentes**:
   - `draggable={true}` con `onDragStart={(e) => handleNativeDragStart(e, path)}`.
4. **Validación**:
   - `bun run build` y `cargo check`.

## Criterios de finalización

- [x] `tauri-plugin-drag` registrado y compilando limpiamente en Rust y TypeScript.
- [x] Al mantener presionado y arrastrar una imagen o vídeo en Prisma, el sistema operativo reconoce el archivo y permite soltarlo en DaVinci Resolve, Affinity, Krita, Photoshop o el Explorador.
- [x] Al mantener presionado y arrastrar una canción o documento, se emite igualmente la ruta real del archivo.
- [x] No hay conflictos con la recepción de archivos arrastrados hacia Prisma (`useGlobalFileDrop`).
