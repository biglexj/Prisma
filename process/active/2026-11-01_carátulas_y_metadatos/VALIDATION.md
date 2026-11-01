# Validación

- [x] `bun test tests/music-metadata.test.ts`: 5 pruebas correctas (limpieza Unicode/versiones, campos vacíos, reemplazo selectivo y ausencia de cambios ajenos).
- [x] `bun run build`: TypeScript y Vite correctos; advertencia de tamaño de chunks.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml`: correcto.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml --lib features::music_library::metadata::tests -- --nocapture`: 3 correctas; consulta real ignorada por defecto y ejecutada por separado.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml --lib features::music_library::metadata::tests::live_catalog_and_hd_cover -- --ignored --nocapture`: consulta real a Apple y Deezer y descarga de JPEG HD correctas (2026-11-01).
- [x] Interfaz en navegador con `tests/fixtures/music-metadata.html`: búsqueda por lote, ausencia de resultados, selección obligatoria, guardado simulado, errores, selección manual de Deezer y detención correctos. Petición de guardado observada: artista/álbum, conservando el título existente.
- [x] Round-trip nativo de carátula y etiquetas sobre FLAC temporal: conserva título, letra, género y número de pista; persiste artista, álbum y JPEG incrustado.
- [x] Revisión React/Material: diálogo modal nativo con foco contenido y restauración, controles etiquetados, opciones bloqueadas durante operaciones, guardado solo por selección explícita y tokens visuales del proyecto. `git diff --check` sin errores.
- [ ] Aceptación en Prisma nativo instalado; no se ha instalado ni publicado una versión.

La documentación oficial de Apple confirma el endpoint y recomienda limitar el ritmo de consultas: [Search API](https://performance-partners.apple.com/search-api). La documentación de Deezer no fue accesible desde el navegador de investigación; el endpoint se comprobó con consulta real.
