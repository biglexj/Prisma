# Validación: Favoritos Multimedia

## Casos de Prueba y Comprobaciones

### 1. Migración y Sanitización en Backend
- [x] Comprobado: `favorites.json` migró las rutas `.mp4` y `.png` que estaban erróneamente en `music` a sus listas correspondientes `videos` e `images`.
- [x] Comprobado: `favorites_toggle` y `favorites_is_favorite` aceptan `{ path, mediaType? }` con auto-detección por extensión en fallback.

### 2. Sincronización en Frontend
- [x] Comprobado: Unificación del hook en `src/shared/useFavorites.ts` con listener reactivo global, Map indexado normalizado y síntesis de respaldo.
- [x] Comprobado: `PlaybackPreview.tsx` y `MediaTreeView.tsx` envían el `mediaType` exacto (`video`, `image`, `music`).
- [x] Comprobado: Los contadores de la cabecera en `FavoritesView` reflejan con exactitud el total por categoría y el renderizado muestra las repisas de Música, Imágenes y Vídeos.

### 3. Build & Type Check
- [x] `bun run build` (tsc --noEmit && vite build): 0 errores, compilación exitosa en 1.77s.
- [x] `cargo check`: 0 errores en backend Rust.
