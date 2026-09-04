# 🎯 Prisma — Roadmap

Plan de trabajo, objetivos de producto y hoja de ruta estratégica del proyecto.

> **Regla del roadmap:** El Roadmap reúne los pendientes, prioridades, pausas y logros del producto. La ejecución detallada se registra dentro de `process/active/YYYY-MM-DD_objetivo/`. Cuando un proceso queda aprobado, el elemento correspondiente pasa a **Completado** (`- [x] **vX.X.X**`).

---

## 🔴 Pendientes activos

- [ ] **Expansión de Conversión Multimedia con FFmpeg**: Extracción de audio (Video → MP3, FLAC, AAC, WAV) y transcodificación por lotes de vídeo en `PrismaConvertView`.
- [ ] **Marcadores y Etiquetas de Colección en Galería Visual**: Sistema de etiquetado personalizado (*tags*) y marcadores visuales para organización rápida de ilustraciones y fotos.

---

## 🟡 Intermedio (Prioridad Media/Baja)

- [ ] Atajos de teclado totalmente reconfigurables desde la interfaz de Configuración.
- [ ] Integración de marca de agua por lotes en el Convertidor Prisma.

---

## ⚪ Descartado / En Pausa

- ⏸️ **Cortador de Audio Básico** — Recorte no-destructivo de segmentos de audio con vista de forma de onda, puntos de entrada/salida y exportación del fragmento. Aplazado: alta complejidad, baja urgencia actual.
- ⏸️ Integración con servicios de streaming en la nube (Prisma se mantiene como visor 100% local-first).

---

## 🟢 Completado

- [x] **v1.0.8**
  - **Modo DSP Global de Sistema, Graves Dual-Mono, Ruteo Universal, Descargador de Letras Sincronizadas y Continuidad Acústica**:
    - Motor nativo puro en Rust de captura y renderizado en tiempo real con latencia ultrabaja (~10 ms) mediante WASAPI Loopback para interceptar y procesar el audio de todo Windows (YouTube en Chrome/Edge, Spotify, navegadores y videojuegos).
    - Análisis y calibración matemática inspirada en la arquitectura FxSound con limitador predictivo *lookahead* a -0.17 dBFS y compresión suave RMS sin clipping ni distorsión por sobrecarga.
    - Algoritmo de pegada de graves centrado en fase (*Dual-Mono HyperBass* a 90 Hz $Q=2.5$ y 55 Hz $Q=2.2$ tras el ensanchamiento estéreo), eliminando fugas hacia los laterales.
    - Ruteo universal compatible con `MIXLINE`, DACs, altavoces y auriculares, con exclusión del propio endpoint de Prisma para evitar bucles.
    - Descargador masivo por lotes de letras sincronizadas con timestamps (`.lrc` para Karaoke) vía LRCLIB, con limpieza automática de títulos, omisión de pistas existentes, escritura de archivos compañeros en UTF-8 y panel de monitoreo interactivo.
    - Arquitectura persistente `DspProvider` y sincronización en memoria en Rust (`matches_devices`) para reproducción ininterrumpida sin micro-cortes al navegar entre pestañas.
    - Motor Web Audio API de alta fidelidad conectado al reproductor de vídeo HTML5 con preservación de filtros en modo Picture-in-Picture.
    - Actualización oficial del lema e identidad: *Prisma · Tu espacio de multimedia* y *Prisma Audio Enhancer (Prisma Audio Engine)*.
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
