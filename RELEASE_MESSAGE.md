# 🚀 Prisma v1.0.8 — Modo DSP Global de Sistema (YouTube, Spotify, Juegos), Graves Dual-Mono y Ruteo Integral

Llega **Prisma v1.0.8** (Versión 0.8 del motor de audio), la actualización que expande la experiencia acústica más allá de la aplicación: ahora el motor de ecualización y procesamiento DSP de alta fidelidad se ejecuta de **forma global en todo Windows** (procesando en tiempo real YouTube en Chrome/Edge, Spotify, Discord, videojuegos y reproductores externos), con latencia ultrabaja mediante WASAPI Loopback nativo en Rust puro.

---

### ✨ Novedades destacadas

- 🌐 **Modo DSP Global de Sistema (WASAPI Loopback Capture & Render)**: Motor nativo en Rust puro que captura el flujo de audio de Windows en modo compartido a 48 kHz / 32-bit float, aplica la cadena completa de ecualización de 10 bandas y procesadores acústicos, y renderiza con latencia ultrabaja (~10 ms) directamente a tus altavoces o auriculares físicos sin depender de software de terceros.
- 🎚️ **Ruteo Integral de Dispositivos (DACs, Auriculares)**: El selector de salida en el ecualizador lista todos los dispositivos y líneas de ruteo de Windows (incluyendo `MIXLINE` para streaming/OBS, altavoces, auriculares y monitores), excluyendo únicamente el canal de captura de Prisma para prevenir bucles de retroalimentación.
- ⚡ **Continuidad Acústica Sin Pausas entre Pestañas**: Arquitectura de audio persistente con sincronización en memoria (`matches_devices`). Cambia con total fluidez entre Inicio, Escuchar, Ecualizador, Música y Vídeos sin micro-cortes ni reinicios del motor de audio.
- 🎬 **DSP Nativo en Vídeo y Picture-in-Picture (Web Audio API)**: Cadena completa de procesamiento integrada al reproductor de vídeo HTML5 de Prisma, conservando ecualización y refuerzo dinámico incluso en ventana flotante PiP.
- 🎯 **Graves Sólidos, Secos y Centrados (Dual-Mono HyperBass)**: Calibración matemática exacta de los filtros de pegada (90 Hz, $Q = 2.5$) y sub-bajos (55 Hz, $Q = 2.2$) ejecutados tras el ensanchamiento estéreo. Elimina fugas laterales y mantiene los graves contundentes en el centro acústico exacto.
- 🎛️ **Banner Interactivo y Monitoreo de Estado**: Barra de control en el ecualizador con switch rápido "Activar en todo Windows", indicador de estado en vivo, medición de latencia en milisegundos, selector de salida y memoria de persistencia.
- 🎤 **Descargador de Letras Sincronizadas (.lrc para Karaoke)**: Búsqueda automatizada por lotes para carpetas y álbumes completos (LRCLIB). Limpia títulos automáticamente, omite pistas con letras preexistentes y guarda archivos `.lrc` compañeros en UTF-8 listos para cantar en modo karaoke en Prisma y reproductores externos.
- 🛡️ **Refuerzo Dinámico Predictivo Cero Distorsión**: Compresión ascendente RMS de codo suave combinada con limitador *lookahead* a -0.17 dBFS para máxima sonoridad sin saturación.
- 🏷️ **Identidad Oficial**: Actualización del lema a *«Prisma · Tu espacio de multimedia»* e integración del controlador virtual bajo la denominación *«Prisma Audio Enhancer (Prisma Audio Engine)»*.

---

### 💖 Apoyo y comunidad

Si disfrutas usando **Prisma**, considera apoyar el desarrollo continuo:
- ☕ **Buy Me a Coffee**: https://buymeacoffee.com/biglexj
- 💳 **Donaciones directas**: https://www.biglexj.com/donaciones
- 🐙 **GitHub**: https://github.com/biglexj
