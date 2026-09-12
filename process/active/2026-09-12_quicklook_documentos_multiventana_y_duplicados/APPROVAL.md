# Aprobación: QuickLook Refinement, Multi-ventana Desacoplada y Motor de Duplicados

- Estado: `APPROVED`
- Fecha: `2026-09-12`

## Decisiones registradas

1. **QuickLook Dimensions**: Se incrementan los tamaños de documentos (Markdown, texto, EPUB, archivos comprimidos) para mejorar la lectura y no requerir maximización forzada.
2. **Multi-ventana sin duplicación en bandeja**: Prisma mantiene un único icono en la bandeja del sistema; las previsualizaciones desacopladas son ventanas hijas de WebView gestionadas por el mismo proceso.
3. **Escaneo de Duplicados**: Se modela una arquitectura híbrida en Rust (Hash exacto + Perceptual Hash dHash) con UI interactiva inspirada en dupeGuru y conectada con `ImageComparisonModal`.
4. **Sanitización de URLs (`toSafeAssetUrl`)**: Sustitución sistemática de `convertFileSrc` para codificar caracteres reservados URI como `@`, garantizando compatibilidad con rutas de usuarios y canales de YouTube en Windows WebView2.

