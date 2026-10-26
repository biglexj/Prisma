# Plan — Filtrado y depuración de archivos inexistentes y carpetas ocultas en Historial y Favoritos

## Diagnóstico y Causa Raíz
1. **Archivos inexistentes tras eliminación o traslado externo**:
   - Al reproducir o abrir archivos, sus rutas se persisten en `localStorage` (`prisma_history_v1`) y en `favorites.json`.
   - Si dichos archivos se mueven o eliminan externamente (vía Explorador de Windows, TikTok, etc.), ya no forman parte de las colecciones activas (`videos`, `images`, `musicItems`) escaneadas por Rust.
   - En `HistoryView.tsx` y `FavoritesView.tsx`, cuando una ruta no se encuentra en el mapa (`vidMap.get(...) === undefined`), el código recurre a `synthesizeVisualItem(item.path)` y evalúa `return real ? !real.isExcluded : true;`.
   - Al ser `real === undefined`, retorna `true` incondicionalmente, generando tarjetas fantasmas con iconos de marcador roto y títulos de archivos que ya no existen en disco, inflando además los contadores (e.g. «Ver todo (54)»).

2. **Carpetas Ocultas (Excluidas) visualizadas indebidamente**:
   - En Prisma, las carpetas excluidas de la línea de tiempo se denominan y gestionan como «Carpetas Ocultas» (`excludedFolders`).
   - Ni `HistoryView` ni `FavoritesView` recibían `excludedFolders` para filtrar rutas que pertenezcan o desciendan de dichas carpetas.
   - Si un archivo procedía de una carpeta oculta o externa excluida, `real` era `undefined`, evadiendo la exclusión y mostrándose en pantalla.

## Objetivos
1. **Exclusión estricta de carpetas ocultas**:
   - Propagar `excludedFolders` (música, imágenes, vídeos) a `HistoryView` y `FavoritesView`.
   - Filtrar de forma rigurosa cualquier elemento cuya ruta coincida o descienda de una carpeta oculta/excluida o de segmentos ocultos del sistema (e.g. `.nombre`).
2. **Filtrado y saneamiento de archivos inexistentes**:
   - En `HistoryView`, solo considerar válidos inmediatamente aquellos ítems presentes en las colecciones escaneadas por el sistema (`videos`, `images`, `musicItems`).
   - Para ítems externos que no formen parte de la biblioteca indexada, verificar su existencia real en disco mediante un comando batch en Rust (`media_filter_existing_paths`).
   - Purgar automáticamente del historial en `localStorage` (`prisma_history_v1`) las rutas que ya no existan en disco o que correspondan a carpetas excluidas, evitando acumulación de referencias huérfanas.
3. **Mismo rigor en Favoritos**:
   - En `FavoritesView`, excluir elementos de carpetas ocultas y filtrar elementos inexistentes para no mostrar tarjetas rotas.
4. **Validación visual y de compilación**:
   - Verificar con `bun test tests`, `bun run check` y compilación de la suite.
