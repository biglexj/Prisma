# 🎯 Prisma — Roadmap

Plan de trabajo, objetivos de producto y hoja de ruta estratégica del proyecto.

> **Regla del roadmap:** El Roadmap reúne los pendientes, prioridades, pausas y logros del producto. La ejecución detallada se registra dentro de `process/active/YYYY-MM-DD_objetivo/`. Cuando un proceso queda aprobado, el elemento correspondiente pasa a **Completado** (`- [x] **vX.X.X**`).

---

## 🔴 Pendientes activos

- [x] **Bibliotecas Modulares Personalizables y Quick Look Universal (Documentos, Libros, Proyectos Creativos y Tipos de Archivo Dinámicos)** — `process/active/2026-08-16_bibliotecas_modulares_y_quicklook_universal/`
- [x] **Integración Aurora Synapse Protocol (Handoff LAN, UDP Beacon, Receptor de Archivos y Deep Links)** — `process/active/2026-08-16_aurora_synapse_integration/`
- [ ] **Estandarización Ecosistema biglexj** — `process/active/2026-08-11_estandarizacion_ecosistema_biglexj/`
- [ ] **Modo de Reproducción Flotante (PiP / MiniPlayer)** — `process/active/`
- [x] **Configuración de Quick Look, Atajos, Autorun y Bandeja del Sistema (System Tray)** — `process/completed/2026/2026-08-15_quick_look_configuracion_autorun_tray/`
- [x] **Prisma Quick Look (Previsualización Rápida con Espacio en Explorador y Escritorio)** — `process/completed/2026/2026-08-15_quick_look_vista_previa/`
- [x] **Gestión de Colas, Reproducción Continua, Árbol Jerárquico y Favoritos** — `process/completed/2026/2026-08-14_gestion-colas-reproduccion-arbol/`
- [x] **Auditoría de Rendimiento Multimedia y Memoria** — `process/completed/2026/2026-08-14_auditoria-rendimiento-multimedia/`
- [x] **Optimización de Renderizado de Listas de Fotos Masivas y Memoria WebView** — `process/completed/2026/2026-08-13_optimizacion_memoria_webview/`

---

## 🟡 Intermedio (Prioridad Media/Baja)

- [ ] **Motor de Conversión de Media con FFmpeg (Prisma Convert)** — Integración de FFmpeg como motor backend de conversión unificado para imágenes, audio y vídeo, a la altura de XnConvert:
  - **Conversión de Imágenes**: Conversión por lotes entre formatos (JPG, PNG, WebP, AVIF, HEIC, TIFF, BMP, GIF…), con acciones encadenables: redimensión, recorte, ajuste de calidad, marca de agua, metadatos EXIF.
  - **Video → Audio**: Extracción de pista de audio desde archivos de vídeo (MP4, MKV, AVI…) a formatos como MP3, FLAC, OGG, WAV, AAC.
  - **Conversión de Vídeo**: Transcodificación entre contenedores y codecs (H.264, H.265/HEVC, AV1, VP9) con control de bitrate, resolución y FPS.
  - **Renombrado Global (Batch Rename)**: Reglas de renombrado por expresión regular, numeración secuencial, reemplazo de texto y uso de metadatos como variables — extensión del renombrado actual a todas las bibliotecas (música, imágenes, vídeo).
  - **Cola de Conversión y Progreso**: UI de colas con progreso por ítem, cancelación individual y reporte de errores por archivo.
- [ ] **Editor de Tags de Música (Prisma Tag Editor)** — Panel de edición de metadatos ID3/Vorbis/MP4 directamente desde la biblioteca, al nivel de Mp3tag: título, artista, álbum, año, género, número de pista, carátula embebida, comentarios y tags personalizados. Edición individual y por lotes (multi-selección).
- [ ] **Letras Sincronizadas — Completar y Mejorar** *(base LRC ya existe; falta sincronización activa y editor)* — El backend lee `.lrc` y tags incrustados (`Lyrics` / `UnsyncLyrics`), el frontend muestra `LyricsPreview`, pero falta: (a) resaltado línea activa sincronizado con posición MPV, (b) búsqueda y descarga automática de letras desde proveedores públicos (lrclib.net / Musixmatch), (c) editor visual LRC in-app para ajustar tiempos, (d) escritura de vuelta al tag del archivo.
- [ ] Soporte para listas de reproducción personalizadas y exportación M3U.
- [ ] Búsqueda y filtrado avanzado por metadatos (artista, álbum, formato, fecha).
- [ ] **Visor de Metadatos EXIF** — Panel de inspección de metadatos de imagen (cámara, lente, ISO, apertura, velocidad, GPS, fecha, software) accesible desde el explorador visual y el Quick Look, sin edición destructiva.
- [ ] Ajustes de ecualizador y filtros de audio mediante MPV.
- [ ] Sistema de marcadores y etiquetas en galería visual.

---

## ⚪ Descartado / En Pausa

- ⏸️ **Cortador de Audio Básico** — Recorte no-destructivo de segmentos de audio con vista de forma de onda, puntos de entrada/salida y exportación del fragmento. Aplazado: alta complejidad, baja urgencia actual.
- ⏸️ Integración con servicios de streaming en la nube (Prisma se mantiene como visor 100% local-first).

---

## 🟢 Completado

- [x] **v1.0.2**
  - **Suite de Comparativa de Imágenes, Modo Desarrollo Aislado, Bento Grid 12-Columnas y Suite Musical Aurora Online**: Suite de Comparativa de Imágenes Multimodal (Cortina Deslizante, Lado a Lado, Alternancia Rápida a 60 Hz y Diferencia/Relieve) con zoom pareado al 500%, desacople de ventanas de Quick Look independientes, modo de desarrollo concurrente con aislamiento de perfil (`dev_profile/`), Bento Grid denso adaptable para Wallpapers 4K, suite online desglosada en Música, Instrumentales y Karaokes con test de ping en tiempo real, y optimización de renderizado en `MediaProgressBar` con `ResizeObserver` sin parpadeos ni layout thrashing.
- [x] **v1.0.1**
  - **Ecosistema Luna Fetch & Gallery-DL, Aurora Synapse Apps Hub, Convertidor por Lotes y Álbumes Inteligentes**: Centros de herramientas dedicados para Luna Fetch y Gallery-DL GUI con analizador y envío rápido de enlaces o galerías masivas con 4 estructuras de carpetas, panel de aplicaciones vinculadas en Aurora Synapse con iconos empaquetados y estado de sinergia, integración del Convertidor Prisma con soporte por lotes y carpetas completas, menú contextual para conversión directa, agrupación de música por etiquetas de álbum con vista de detalle dedicada, doble interacción en tarjetas, selector de densidad de altura en configuración y perfeccionamiento de alta precisión en Quick Look para Windows 11 con pestañas.
- [x] **v1.0.0**
  - **Lanzamiento oficial de Prisma**: Estación multimedia local-first integral para Windows. Reproducción de audio de alta fidelidad, reproductor de vídeo con PiP, visor y editor de imágenes, Quick Look universal, **Bibliotecas Modulares Personalizables** con lector y editor interactivo in-app (*Split View*, fuentes y zoom), blindaje universal contra exclusiones, listas universales M3U/PLS/XSPF y control remoto LAN mediante Aurora Synapse.
