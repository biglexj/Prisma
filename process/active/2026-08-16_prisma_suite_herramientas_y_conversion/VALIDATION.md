# 🧪 Validación — Suite de Herramientas Prisma

## Criterios de Aceptación y Resultados
1. **Motor de Conversión FFmpeg**:
   - Módulo backend `infrastructure/converter/mod.rs` implementado con búsqueda de binarios silenciosa en Windows.
   - Presets completos para imágenes (WebP, JPG, PNG, AVIF, BMP, TIFF, GIF con calidad y resize), Video→Audio (MP3, FLAC, WAV, AAC, OGG), Transcodificación de vídeo (H.264, HEVC, AV1, VP9) y audio.
   - Cola de conversión con renombrado automático y barra de progreso.
2. **Editor de Tags de Música**:
   - Soporte para lectura y escritura atómica con `lofty` en Rust.
   - Modal interactivo Material 3 con pestañas de metadatos, carátula y letras incrustadas.
3. **Letras Sincronizadas y LRCLIB**:
   - Integración con API de LRCLIB para búsqueda automática en un clic.
   - Ajuste de desfase de tiempo milimétrico (+/-0.5s, +/-1s) y guardado a `.lrc` / tags.
4. **Visor EXIF**:
   - Ficha técnica completa de cámara, lente, apertura, velocidad, ISO y resolución en `ExifDetailsModal.tsx`.
5. **Corrección de Listas de Reproducción y Atajos**:
   - Resuelto el error *"El archivo abierto no apareció dentro de su propia carpeta"*: `builder.rs` ahora es insensible a mayúsculas/minúsculas en Windows y `load()` no se interrumpe si la sesión de carpeta no encuentra elementos adyacentes.
   - Habilitados los atajos de teclado interactivos `n` (siguiente), `p` (anterior), `Espacio` (play/pause), `Flechas` (seek y volumen), `l` (letras), `q` (cola) y `m` (mute).
   - Reconocimiento de listas M3U/PLS/XSPF en el explorador de archivos y Quick Look con `QuickLookPlaylist.tsx`.
