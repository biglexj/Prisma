# Soporte Nativo para Formatos ElyX (.elx) y JPEG XL (.jxl) en Prisma — Plan

- Estado: `DRAFT`
- Fecha: `2026-10-17`
- Proyecto: `Prisma`

## Objetivo

Dotar a Prisma del primer visor e indexador nativo de imágenes con códec propio para el formato experimental **ElyX (`.elx`)** y soporte completo para **JPEG XL (`.jxl`)**, permitiendo la detección en la biblioteca visual, generación de miniaturas bajo demanda y visualización a resolución completa en el visor interactivo.

## Alcance

- Incluye:
  - Implementación en Rust del códec decodificador nativo de **ElyX 0.1 (`.elx`)** según la especificación binaria formal (`ELYX\r\n\x1a\n`, cabecera JSON UTF-8, teselas independientes, YCoCg-R reversible, wavelet entera CDF 5/3 de 3 niveles, zigzag16, planos de bytes y descompresión zlib/DEFLATE con validación CRC32).
  - Integración del decodificador de **JPEG XL (`.jxl`)** mediante el motor FFmpeg con `libjxl` ya compilado y presente en `src-tauri/vendor/ffmpeg/`.
  - Integración en `classifier.rs` y `file_associations.rs` de las extensiones `.elx` y `.jxl` para la exploración de archivos y carpetas de biblioteca visual.
  - Generación de miniaturas optimizadas para `.elx` y `.jxl` en `media_preview/mod.rs` y `visual_library_image_preview`.
  - Implementación del comando Tauri `visual_library_image_render` para servir la imagen decodificada de alta fidelidad al frontend cuando el motor WebView2 carece de decodificador web nativo.
  - Adaptación en frontend (`useRenderableImage.ts`, `ImageViewer.tsx`, `VisualThumbnail.tsx` y regexes de extensiones) para cargar y renderizar fluidamente `.elx` y `.jxl`.
  - Pruebas de verificación de integridad matemática contra las variantes reales de prueba de `D:\Imágenes\ELYX_nativo_20261017_181309` y `D:\Imágenes\ELYX_resultados_20261017_174854`.

- No incluye:
  - Codificador de guardado/exportación a ElyX en el editor (el alcance actual se enfoca en lectura, indexación, miniaturas y visualización nativa).
  - Modificación de formatos AVIF (descartado explícitamente según la directriz del usuario).

## Enfoque

1. **Módulo de Códec ElyX en Rust (`src-tauri/src/infrastructure/codecs/elyx.rs`)**:
   - Crear el decodificador matemático completo en Rust seguro, verificando firma, cabecera JSON, checksums CRC32, planos de bytes, inversión CDF 5/3 por lifting entero y espacio de color YCoCg-R.
   - Añadir tests unitarios en Rust con las muestras de prueba de `D:\Imágenes\ELYX_nativo_20261017_181309\pruebas`.
2. **Decodificador JPEG XL (`src-tauri/src/infrastructure/codecs/jxl.rs`)**:
   - Extraer fotogramas/thumbnails de `.jxl` a través del binario FFmpeg interno con `libjxl`.
3. **Canal de Miniaturas y Renderizado Completo**:
   - Extender `load_image_data_url` en `media_preview/mod.rs` para soportar `.elx` y `.jxl`.
   - Implementar y registrar el comando `visual_library_image_render` en `visual_library.rs` y `lib.rs`.
4. **Clasificación y Registro de Extensiones**:
   - Agregar `"elx"` a `IMAGE_EXTENSIONS` en `classifier.rs`.
   - Agregar `"elx"` y `"jxl"` a `file_associations.rs`.
   - Actualizar filtros en frontend (`App.tsx`, `useRenderableImage.ts`, etc.).
5. **Comprobación Visual y Validación de Rendimiento**:
   - Abrir y verificar visualmente las imágenes reales `Peyto_s1.elx`, `Peyto_s8.elx` y `jxl_q70.jxl` dentro de Prisma.

## Criterios de finalización

- [ ] El códec Rust decodifica exitosamente los archivos `.elx` de prueba sin error de CRC32 y preserva la exactitud pixel a pixel en modo sin pérdida (`step = 1`).
- [ ] La biblioteca visual lista los archivos con extensión `.elx` y `.jxl`.
- [ ] Las miniaturas de `.elx` y `.jxl` se generan y visualizan correctamente en la cuadrícula.
- [ ] Al hacer clic en un archivo `.elx` o `.jxl`, el visor interactivo de Prisma (`ImageViewer`) lo abre a resolución completa con soporte para zoom, paneo e información EXIF/metadatos.
- [ ] `cargo check` y compilación de TypeScript pasan al 100% sin advertencias ni regresiones.

## Autorización

- [ ] Plan aprobado para ejecución.
