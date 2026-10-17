# Soporte Nativo para Formatos ElyX (.elx) y JPEG XL (.jxl) en Prisma — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Incorporar dependencias necesarias (`miniz_oxide = "0.8"`, `crc32fast = "1.5"`) en `Cargo.toml`.
- [x] T02 — Desarrollar el códec decodificador nativo de ElyX (`src-tauri/src/infrastructure/codecs/elyx.rs` y módulo `codecs`).
- [x] T03 — Desarrollar el adaptador de decodificación para JPEG XL (`src-tauri/src/infrastructure/codecs/jxl.rs`).
- [x] T04 — Integrar soporte de `.elx` y `.jxl` en `media_preview/mod.rs` para miniaturas y vistas previas en buffer/base64.
- [x] T05 — Implementar comando Tauri `visual_library_image_render` en `src-tauri/src/app/commands/visual_library.rs` y registrarlo en `lib.rs`.
- [x] T06 — Añadir `"elx"` a `IMAGE_EXTENSIONS` en `classifier.rs` y registrar `"elx"` y `"jxl"` en `file_associations.rs`.
- [x] T07 — Actualizar frontend (`useRenderableImage.ts`, `App.tsx`, `ImageViewer.tsx`) para detección inmediata y renderizado de `.elx` y `.jxl`.
- [x] T08 — Ejecutar tests unitarios de Rust contra los archivos `.elx` de `D:\Imágenes\ELYX_nativo_20261017_181309\pruebas` y variantes reales.
- [x] T09 — Validar la carga visual completa en Prisma y preparar documentación de validación.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
