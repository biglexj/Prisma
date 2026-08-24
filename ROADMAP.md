# 🎯 Prisma — Roadmap

Plan de trabajo, objetivos de producto y hoja de ruta estratégica del proyecto.

> **Regla del roadmap:** El Roadmap reúne los pendientes, prioridades, pausas y logros del producto. La ejecución detallada se registra dentro de `process/active/YYYY-MM-DD_objetivo/`. Cuando un proceso queda aprobado, el elemento correspondiente pasa a **Completado** (`- [x] **vX.X.X**`).

---

## 🔴 Pendientes activos

- [ ] **v1.0.5 — Visor Despejado, Herramientas Modulares y Nueva Identidad**: menús desplegables en imagen y vídeo, zoom ultra amplio (5%), comparativa A/B unificada, integración con explorador y multiventana, e icono nativo de alto contraste; quedan pendientes la instalación limpia y la publicación remota.
- [ ] **Expansión de Conversión Multimedia con FFmpeg**: Extracción de audio (Video → MP3, FLAC, AAC, WAV) y transcodificación por lotes de vídeo en `PrismaConvertView`.
- [ ] **Ecualizador y Procesamiento DSP de Audio**: Panel de ecualización gráfica de 10 bandas y presets acústicos integrados con el motor MPV nativo.
- [ ] **Marcadores y Etiquetas de Colección en Galería Visual**: Sistema de etiquetado personalizado (*tags*) y marcadores visuales para organización rápida de ilustraciones y fotos.

---

## 🟡 Intermedio (Prioridad Media/Baja)

- [ ] Soporte para descarga automática de letras desde proveedores públicos en línea (lrclib / Musixmatch fallback).
- [ ] Atajos de teclado totalmente reconfigurables desde la interfaz de Configuración.
- [ ] Integración de marca de agua por lotes en el Convertidor Prisma.

---

## ⚪ Descartado / En Pausa

- ⏸️ **Cortador de Audio Básico** — Recorte no-destructivo de segmentos de audio con vista de forma de onda, puntos de entrada/salida y exportación del fragmento. Aplazado: alta complejidad, baja urgencia actual.
- ⏸️ Integración con servicios de streaming en la nube (Prisma se mantiene como visor 100% local-first).

---

## 🟢 Completado

- [x] **v1.0.4**
  - **Inicio Estable, Wallpapers Aurora Adaptables y Música Consistente**: carga inicial escalonada, posiciones estables en Inicio, visor de wallpapers proporcional, defensas para recursos no autorizados, metadatos musicales respetados, colas refinadas y estados interactivos coherentes. Publicación confirmada por Biglex el 24 de agosto de 2026.
- [x] **v1.0.3**
  - **Wallpapers Bento con Títulos en Hover, Visor Maximizado 80%x90%, Micro-interacciones Táctiles y Contraste Adaptativo**: Perfeccionamiento visual del catálogo de Wallpapers Aurora con tarjetas limpias en reposo y títulos/metadatos animados en hover, visor modal maximizado al 80% de ancho y 90% de alto de pantalla sin franjas residuales, físicas de resorte en transporte multimedia, corrección integral de contraste e inversión cromática de textos en botones para modo Claro y Oscuro, transiciones asíncronas de vídeo sin pausas ni desaparición de cursor, simplificación del visor de letras y centralización de versión.
- [x] **v1.0.2**
  - **Suite de Comparativa de Imágenes, Modo Desarrollo Aislado, Bento Grid 12-Columnas y Suite Musical Aurora Online**: Suite de Comparativa de Imágenes Multimodal (Cortina Deslizante, Lado a Lado, Alternancia Rápida a 60 Hz y Diferencia/Relieve) con zoom pareado al 500%, desacople de ventanas de Quick Look independientes, modo de desarrollo concurrente con aislamiento de perfil (`dev_profile/`), Bento Grid denso adaptable para Wallpapers 4K, suite online desglosada en Música, Instrumentales y Karaokes con test de ping en tiempo real, y optimización de renderizado en `MediaProgressBar` con `ResizeObserver` sin parpadeos ni layout thrashing.
- [x] **v1.0.1**
  - **Ecosistema Luna Fetch & Gallery-DL, Aurora Synapse Apps Hub, Convertidor por Lotes y Álbumes Inteligentes**: Centros de herramientas dedicados para Luna Fetch y Gallery-DL GUI con analizador y envío rápido de enlaces o galerías masivas con 4 estructuras de carpetas, panel de aplicaciones vinculadas en Aurora Synapse con iconos empaquetados y estado de sinergia, integración del Convertidor Prisma con soporte por lotes y carpetas completas, menú contextual para conversión directa, agrupación de música por etiquetas de álbum con vista de detalle dedicada, doble interacción en tarjetas, selector de densidad de altura en configuración y perfeccionamiento de alta precisión en Quick Look para Windows 11 con pestañas.
- [x] **v1.0.0**
  - **Lanzamiento oficial de Prisma**: Estación multimedia local-first integral para Windows. Reproducción de audio de alta fidelidad, reproductor de vídeo con PiP, visor y editor de imágenes, Quick Look universal, **Bibliotecas Modulares Personalizables** con lector y editor interactivo in-app (*Split View*, fuentes y zoom), **Editor de Tags ID3/Metadatos (Prisma Tag Editor)**, **Editor Visual y Sincronizador de Letras LRC (LyricsEditor)**, **Visor de Metadatos EXIF fotográfico**, listas universales M3U/PLS/XSPF y control remoto LAN mediante Aurora Synapse.
