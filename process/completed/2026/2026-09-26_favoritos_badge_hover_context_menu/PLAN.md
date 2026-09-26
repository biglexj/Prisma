# Favoritos Badge Hover y Menú Contextual — Plan

- Estado: `IN_PROGRESS`
- Fecha: `2026-09-26`
- Proyecto: `Prisma`

## Objetivo

Dotar a la vista de Favoritos (`FavoritesView` y `FavoriteFullView`) de badges de corazón interactivos en hover (`corazoncito` para desmarcar directamente) y menú contextual de clic secundario (anticlic) completo para música, imágenes y vídeos, permitiendo gestionar y desmarcar elementos incluso si el archivo se movió o ya no existe en disco.

## Alcance

- Incluye:
  - Botón badge de corazón en hover en todas las tarjetas de la estantería de Favoritos (`FavoritesView`) y vista completa (`FavoriteFullView`), sincronizado con el lenguaje de diseño de `MusicCard` y `VisualCard`.
  - Menú contextual (anticlic) nativo con `ContextMenu` para tarjetas de música, imágenes y vídeos en `FavoritesView` y `FavoriteFullView`.
  - Acciones contextuales: Reproducir/Abrir, Quitar de favoritos (siempre disponible aunque el archivo se haya movido), Mostrar en carpeta, Copiar ruta, Copiar imagen, Añadir a la cola y herramientas de conversión Prisma.
  - Toast de confirmación flotante Material 3 Expressive para acciones realizadas.
  - Estilos CSS en `collections.css` alineados a Material 3 Expressive.
  - Preservación de reproducción continua en modo PiP (Picture-in-Picture) al cerrar o minimizar la ventana principal desde la "X" (pausando únicamente si el vídeo está en modo maximizado / reproductor principal normal).
- No incluye:
  - Modificación del esquema de almacenamiento SQLite/JSON de favoritos.

## Enfoque

1. Crear el wrapper y el botón badge de corazón flotante para las tarjetas de `FavoritesView`.
2. Integrar el disparador de `onContextMenu` y el menú contextual con `ContextMenu` en `FavoritesView` y `FavoriteFullView`.
3. Conectar la prop `onAddToQueue` desde `App.tsx` a `FavoritesView` y `FavoriteFullView`.
4. Añadir estilos visuales en `collections.css` para el wrapper, badge en hover con estado `.is-favorite` y toast flotante.
5. Probar compilación con `bun run build` o `cargo check` / TypeScript check.

## Criterios de finalización

- [ ] Las tarjetas en `FavoritesView` muestran el badge de corazón en hover y permiten quitar de favoritos con un solo clic.
- [ ] El clic secundario (anticlic) despliega el menú contextual con opciones completas y "Quitar de favoritos".
- [ ] Elementos cuyos archivos fueron movidos o eliminados de disco pueden desmarcarse sin bloqueos tanto por badge hover como por menú contextual.
- [ ] Verificación de TypeScript y build exitosa sin errores de tipado o regresiones.

## Autorización

- [x] Plan aprobado para ejecución.
