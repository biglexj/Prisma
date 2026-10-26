# Tareas — Filtrado de inexistentes y carpetas ocultas en Historial y Favoritos

- [ ] Implementar comando nativo en Rust `media_filter_existing_paths` para verificar existencia real de rutas en disco de forma atómica y no bloqueante.
- [ ] Registrar `media_filter_existing_paths` en `src-tauri/src/lib.rs` y exponerlo en el cliente frontend.
- [ ] Añadir helper de detección de carpetas excluidas/ocultas y rutas ocultas (`isPathInExcludedFolder`, `isHiddenPath`) en utilidades compartidas.
- [ ] Extender `HistoryViewProps` y `FavoritesViewProps` para recibir las carpetas excluidas de las bibliotecas desde `App.tsx`.
- [ ] En `HistoryView`:
  - [ ] Filtrar elementos que pertenezcan a carpetas ocultas o que contengan segmentos ocultos.
  - [ ] Para elementos no indexados en la biblioteca, comprobar existencia con `media_filter_existing_paths`.
  - [ ] Purgar del `useHistory` (`localStorage`) las rutas de archivos que ya no existan en disco.
- [ ] En `FavoritesView`:
  - [ ] Filtrar elementos de carpetas ocultas o con segmentos ocultos.
  - [ ] No mostrar tarjetas de elementos cuyos archivos no existan en disco.
- [ ] Ejecutar comprobación de TypeScript (`bun run check`) y pruebas unitarias (`bun test tests`).
- [ ] Validar visualmente en la aplicación que los vídeos huérfanos mostrados en la captura de Biglex ya no aparezcan y el contador se actualice fielmente.
