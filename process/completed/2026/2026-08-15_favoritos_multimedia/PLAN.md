# Plan: Corrección y Sincronización de Favoritos Multimedia (Música, Imágenes y Vídeos)

## Contexto y Causa Raíz
1. **Desajuste de Parámetros en Tauri**: `client.ts` enviaba `{ itemPath, mediaType }` en vez de `{ path, mediaType }` a `favorites_toggle` y `favorites_is_favorite`, lo que provocaba rechazos de deserialización en el backend Rust (`missing field path`).
2. **Clasificación por defecto de Tipo de Medio**: Lugares como `PlaybackPreview` y `MediaTreeView` invocaban `toggleFavorite` sin especificar `mediaType`, cayendo en el valor por defecto `"music"`. Por ello, vídeos como `.mp4` e imágenes como `.png` terminaron almacenados erróneamente en el array `"music"` de `favorites.json`.
3. **Dualidad de Hooks de Favoritos**: `shared/useFavorites.ts` y `features/collections/useFavorites.ts` manejaban estados y eventos separados, lo que provocaba falta de reactividad entre la galería visual y la vista de Favoritos.
4. **Filtro Estricto en Vista de Favoritos**: `FavoritesView` consulta `isFavorite("image", path)` e `isFavorite("video", path)` contra `store.images` y `store.videos`. Al estar guardados en `music`, ni imágenes ni vídeos aparecían (mostraba 0 Imágenes y 0 Vídeos).

## Solución Propuesta
1. **Backend Rust (`src-tauri/src/infrastructure/favorites/mod.rs` & `commands/favorites.rs`)**:
   - Agregar auto-detección inteligente de tipo de medio (`image`, `video`, `music`) a partir de la extensión del archivo.
   - Implementar sanitización/migración automática en `FavoritesState::load` para mover ítems existentes mal clasificados a sus listas correspondientes (`images`, `videos`, `music`).
   - Normalizar los comandos Tauri para aceptar `path` y `media_type` opcional (con fallback a detección por extensión).
2. **Frontend Tauri Client (`src/features/collections/tauri/client.ts`)**:
   - Corregir el objeto enviado al invoke: `{ path: itemPath, mediaType }`.
3. **Unificación y Sincronización React (`src/shared/useFavorites.ts` & `src/features/collections/useFavorites.ts`)**:
   - Centralizar la reactividad global con almacenamiento estructurado (`FavoritesStore`) y Set plano optimizado.
   - Propagar cambios bidireccionales instantáneos a todos los componentes suscriptores.
   - Añadir detección inteligente por extensión de fallback en frontend.
4. **Corrección de Invocaciones UI**:
   - `PlaybackPreview.tsx`: Pasar el `mediaType` dinámico (`video`, `image` o `music`) según la sesión activa.
   - `MediaTreeView.tsx`: Pasar la prop `mediaType` correspondiente.
