# 🎯 Prisma — Roadmap

Plan de trabajo, objetivos de producto y hoja de ruta estratégica del proyecto.

> **Regla del roadmap:** El Roadmap reúne los pendientes, prioridades, pausas y logros del producto. La ejecución detallada se registra dentro de `process/active/YYYY-MM-DD_objetivo/`. Cuando un proceso queda aprobado, el elemento correspondiente pasa a **Completado** (`- [x] **vX.X.X**`).

---

## 🔴 Pendientes activos

- [x] **Investigación y Calibración del Motor DSP de Audio (Algoritmo FxSound sin Distorsión)**:
  - Descargar y analizar el repositorio de código abierto de FxSound (`temp/fxsound`) para estudiar su arquitectura de procesamiento de señal (Dynamic Boost `Maximizer`, `Aural` exciter, `Wide` 3D surround, ecualización y limitador transparente).
  - Implementar en `mpv.rs` la cadena de ganancia y limitación dinámica avanzada en 2 fases (*soft-knee upward compression + lookahead peak limiter a -0.17 dBFS con ventana de 7 ms*) y reordenar las etapas para lograr aumento de volumen y pegada cristalina sin clipping ni distorsión por sobrecarga.
- [ ] **Modo DSP Global de Sistema (Adaptación de `audiopassthru` / WASAPI Loopback para la siguiente versión)**:
  - Adaptar el módulo `audiopassthru` analizado en FxSound (`temp/fxsound/audiopassthru`) para interceptar y procesar el audio de todo el sistema Windows (YouTube en Chrome/Edge, Spotify, navegadores y videojuegos).
  - Implementar un backend en Rust con captura WASAPI Loopback / Virtual Device Endpoint para alimentar la cadena DSP de Prisma en tiempo real desde la bandeja del sistema (*System Tray*).
- [ ] **Expansión de Conversión Multimedia con FFmpeg**: Extracción de audio (Video → MP3, FLAC, AAC, WAV) y transcodificación por lotes de vídeo en `PrismaConvertView`.
- [x] **v1.0.7 — Ecualizador y Procesamiento DSP de Audio**: Suite de ecualización gráfica de 10 bandas con curva spline interactiva, 5 procesadores de señal DSP (Claridad, Ambiente, Sonido Envolvente, Refuerzo Dinámico y Graves), selector de dispositivos de salida de audio y acceso rápido desde System Tray y Reproductor (estilo FxSound).
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

- [x] **v1.0.7**
  - **Renombrador Masivo con Reglas Apiladas, Sincronización Synapse LAN/P2P, Motor Nativo Rust y Estandarización de Scripts**: Rediseño ergonómico del Renombrador Masivo con disposición "un elemento por línea", menús desplegables de ancho completo y panel de plantillas; soporte integral de deep links y Handoff móvil en Aurora Synapse con balizas UDP automáticas; motor de conversión de imágenes nativo en Rust puro (`Lanczos3`) para WebP/PNG/JPG; iconografía oficial actualizada y adopción del estándar universal de scripts y alias de compilación en `package.json`.
- [x] **v1.0.6**
  - **Quick Look Multiformato, Inspector EXIF Nativo, EPUB/ZIP y Visor Enriquecido**: Navegación continua con flechas sin robo de foco (`SW_SHOWNOACTIVATE`), previsualización estructurada de archivos ZIP/7Z/RAR con búsqueda, soporte de libros EPUB con portada 3D y capítulos, motor nativo puro de EXIF fotográfico, panel lateral de información técnica en el visor de fotos (`I`), alternancia reactiva de colas musicales y renderizado fluido sin recortes artificiales.
- [x] **v1.0.5**
  - **Menús de Herramientas Modulares, Zoom Ultra Amplio (5%), Suite de Comparativa A/B e Integración Nativa**: Menús desplegables con diseño glassmorphic en imágenes y vídeos, persistencia inteligente de controles en pantalla, zoom fotográfico desde el 5% con desplazamiento suave, alineación compacta en comparativa A/B, comando nativo de selección en el Explorador de Windows y nuevo icono de alto contraste con fondo blanco.
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
