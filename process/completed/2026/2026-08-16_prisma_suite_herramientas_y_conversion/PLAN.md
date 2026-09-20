# 📋 Plan de Implementación — Suite de Herramientas Prisma (Prisma Tools & Convert)

## 🎯 Objetivo General

Dotar a **Prisma** de una suite unificada de herramientas multimedia locales de nivel profesional que sustituya aplicaciones externas de conversión y utilidades (tipo XnConvert, Mp3tag, HandBrake básico, extractores y visores EXIF):

1. **Prisma Convert (FFmpeg Engine)**: Motor unificado para conversión por lotes de imágenes (JPG, PNG, WebP, AVIF, HEIC, TIFF, BMP, GIF), extracción de vídeo a audio (MP3, FLAC, WAV, AAC, OGG), transcodificación/compresión de vídeo y transcodificación de audio con colas de progreso.
2. **Editor de Tags de Música (Prisma Tag Editor)**: Lectura y escritura exhaustiva de metadatos ID3/Vorbis/MP4/FLAC con `lofty` en Rust (título, artista, álbum, año, pista, carátula embebida, comentarios, letras) individual y por lotes.
3. **Mejora Integral de Letras Sincronizadas**: Búsqueda/descarga automática online de letras sincronizadas vía LRCLIB, visor interactivo con salto temporal, editor visual de tiempos/offset y persistencia en `.lrc` compañero o tags incrustados.
4. **Visor de Metadatos EXIF / Detalles Fotográficos**: Inspección detallada de datos de cámara, lente, apertura, ISO, velocidad, distancia focal y coordenadas en visor e imágenes.
5. **Renombrado Global por Lotes**: Motor de renombrado con reglas (prefijos, sufijos, reemplazo, numeración `<num:02>`, transformaciones de mayúsculas/minúsculas y variables de metadatos).

---

## 🏗️ Arquitectura y Componentes

### 1. Backend Rust (`src-tauri/`)
- **`infrastructure/converter/mod.rs`**: Detección de binario FFmpeg / FFprobe, invocación con flags silenciosas en Windows, builders de comandos para imágenes, vídeo y audio, streams de progreso y cola asíncrona.
- **`infrastructure/tags/mod.rs`**: Wrapper sobre `lofty` para lectura estructurada de `AudioTagData` y guardado/actualización atómica sin alterar el stream de audio original.
- **`infrastructure/exif/mod.rs`**: Extracción limpia de metadatos EXIF fotográficos.
- **`app/commands/converter.rs`**, **`app/commands/tags.rs`**: Comandos Tauri expuestos a JavaScript.

### 2. Frontend React 19 (`src/`)
- **`features/converter/`**: UI de conversión Material 3 Expressive, selector de archivos/carpetas drag & drop, presets por tipo (Imagen, Video→Audio, Video Compresión, Audio), cola de tareas con barra de progreso, estado por archivo y cancelación.
- **`features/music_library/ui/components/TagEditorModal.tsx`**: Diálogo modal de edición de metadatos individual y por lote con pestaña de carátula embebida y letras.
- **`features/playback/ui/components/LyricsEditorModal.tsx` & `useLyricsSearch.ts`**: Integración con API LRCLIB pública y sincronización en vivo.
- **`features/visual_library/ui/components/ExifDetailsModal.tsx`**: Ficha técnica de cámara, lente, exposición, ISO y dimensiones.

---

## 🛡️ Reglas y Buenas Prácticas
- No superar el límite de 1000 líneas por archivo.
- Estricto uso de Material 3 Expressive.
- Cero dependencias rotas; manejo seguro de errores en Rust y TypeScript.
