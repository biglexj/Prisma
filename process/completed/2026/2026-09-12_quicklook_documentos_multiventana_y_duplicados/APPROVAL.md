# Aprobación: QuickLook Refinement, Multi-ventana Desacoplada y Motor de Duplicados

- Estado: `APPROVED`
- Fecha: `2026-09-12`

## Decisiones registradas

1. **QuickLook Dimensions**: Se incrementan los tamaños de documentos (Markdown, texto, EPUB, archivos comprimidos) para mejorar la lectura y no requerir maximización forzada.
2. **Multi-ventana sin duplicación en bandeja**: Prisma mantiene un único icono en la bandeja del sistema; las previsualizaciones desacopladas son ventanas hijas de WebView gestionadas por el mismo proceso.
3. **Escaneo de Duplicados**: Se modela una arquitectura híbrida en Rust (Hash exacto + Perceptual Hash dHash) con UI interactiva inspirada en dupeGuru y conectada con `ImageComparisonModal`.
4. **Sanitización de URLs (`toSafeAssetUrl`)**: Preserva la integridad literal del sistema de archivos local y compatibilidad nativa con Tauri v2 y WebView2 sin alterar caracteres `@`.
5. **Dimensionamiento Dinámico por Porcentaje de Monitor**: Se establece como estándar de producto que los documentos en QuickLook se abran al 70% de ancho y 80% de alto del monitor activo, asegurando proporciones ergonómicas universales en cualquier resolución o escala de pantalla.
6. **Tokens M3 y Visor de Documentos Profesional**: Se incorporan los tokens `--surface-container-lowest` y `--surface-dim` a la base de diseño, dotando a `DocumentViewer` de una estética de hoja de documento elevada con legibilidad óptima en modos claro y oscuro.
7. **Buscador de Duplicados Multimodal y Scoring Hi-Res de Música**: Se integra soporte nativo en Rust para detección por hash exacto y metadatos inteligentes normalizados con Lofty, priorizando formatos sin pérdida (FLAC/WAV/ALAC) y bitrates de 320 kbps para reemplazo de base y depuración de copias comprimidas.
8. **Hero Dropzone Central y Optimización de Altura Vertical**: Se eliminan las barras superiores pesadas cuando no hay selección, transformando el centro vacío en un receptor interactivo de clic y soltado, reduciendo la cabecera a una barra compacta de 36 px al cargar resultados y maximizando el espacio vertical para explorar duplicados e ítems del convertidor.
9. **Centralización en Herramientas y Modularidad de UI**: Pestaña «Herramientas» en Configuración para controlar la visibilidad de utilidades secundarias y acceso de primer nivel a Duplicados en la barra lateral, extrayendo subcomponentes (`DuplicateGroupCard`, `DuplicatesEmptyState`) para mantener los archivos por debajo del límite de 1200 líneas normativas.
10. **Restauración de Arrastrar y Soltar Universal**: Aislamiento de eventos de arrastre y eliminación de interceptores de captura destructivos en `useGlobalFileDrop.ts`, devolviendo el soporte fluido en todas las herramientas.
