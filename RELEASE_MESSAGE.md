# 🚀 Prisma v1.0.8 — Modo DSP Global de Sistema, Control de Ganancia, Configuración de Reproducción y Temas Reactivos

Llega **Prisma v1.0.8**, la actualización que expande la experiencia acústica y visual más allá de la aplicación: ahora el motor de ecualización y procesamiento DSP de alta fidelidad se ejecuta de **forma global en todo Windows** (procesando en tiempo real YouTube en Chrome/Edge, Spotify, Discord, videojuegos y reproductores externos), incorpora **Control de Ganancia / Preamp Maestro** de hasta +12 dB, la nueva **Configuración de Reproducción** inspirada en Super Galería, y un renovado **Sistema de Temas Dinámicos y Colores de Énfasis** con contraste WCAG 2.1 matemático.

---

### ✨ Novedades destacadas

- 🌐 **Modo DSP Global de Sistema (WASAPI Loopback Capture & Render)**: Motor nativo en Rust puro que captura el flujo de audio de Windows en modo compartido a 48 kHz / 32-bit float, aplica la cadena completa de ecualización de 10 bandas y procesadores acústicos, y renderiza con latencia ultrabaja (~10 ms) directamente a tus altavoces o auriculares físicos sin depender de software de terceros.
- 🎚️ **Control de Ganancia / Preamp Maestro y Tarjetas Compactas**: Nuevo control deslizante de Ganancia al inicio de "Efectos DSP" con rango de -12.0 dB a +12.0 dB (casi 4x de amplificación lineal de potencia en MPV y WASAPI) con atajo de doble clic para restablecer a 0.0 dB neutro. Todas las tarjetas de efectos han sido adelgazadas y compactadas para caber cómodamente en el panel.
- 🔀 **Botón y Modal de Configuración de Reproducción**: Botón interactivo en la barra de reproducción (`→` secuencial, `🔁` repetición de cola, `🔂` repetición de canción) que abre el nuevo diálogo de configuración con dos pestañas:
  - **Sencillo**: Selección rápida de avance normal, repetición de cola o repetición de pista.
  - **Avanzadas**: Comportamiento al finalizar la canción (detener, cargar pausada o reproducir) y salto automático de colas con sub-opción jerárquica de bucle anidada.
- 🎨 **Sistema de Temas y Colores de Énfasis**: Soporte para seis paletas de acento (destacando Morado Prisma, junto a Rosa Aurora, Azul Eléctrico, Verde Esmeralda, Ámbar Cálido y Cyan Neón) y **Tematizador Reactivo a la Música** con fórmula matemática de luminancia relativa ($L \approx 0.179$) y ponderación de saturación ($\text{sat}^{2.2}$) que garantiza legibilidad y contraste AAA incluso con carátulas luminosas o desaturadas.
- 📐 **Rediseño Equilibrado en Configuración**: Reorganización de "General y Sistema" en columnas balanceadas sin espacios vacíos, cuadrícula simétrica 3x2 para colores de énfasis y separación modular del panel de barra de progreso.
- 🎛️ **Ruteo Integral de Dispositivos (DACs, Auriculares)**: El selector de salida en el ecualizador lista todos los dispositivos y líneas de ruteo de Windows (incluyendo `MIXLINE` para streaming/OBS, altavoces, auriculares y monitores), excluyendo únicamente el canal de captura de Prisma para prevenir bucles de retroalimentación.
- ⚡ **Continuidad Acústica Sin Pausas entre Pestañas**: Arquitectura de audio persistente con sincronización en memoria (`matches_devices`). Cambia con total fluidez entre Inicio, Escuchar, Ecualizador, Música y Vídeos sin micro-cortes ni reinicios del motor de audio.
- 🎬 **DSP Nativo en Vídeo y Picture-in-Picture (Web Audio API)**: Cadena completa de procesamiento integrada al reproductor de vídeo HTML5 de Prisma, conservando ecualización y refuerzo dinámico incluso en ventana flotante PiP.
- 🎯 **Graves Sólidos, Secos y Centrados (Dual-Mono HyperBass)**: Calibración matemática exacta de los filtros de pegada (90 Hz, $Q = 2.5$) y sub-bajos (55 Hz, $Q = 2.2$) ejecutados tras el ensanchamiento estéreo. Elimina fugas laterales y mantiene los graves contundentes en el centro acústico exacto.
- 🎤 **Descargador de Letras Sincronizadas (.lrc para Karaoke)**: Búsqueda automatizada por lotes para carpetas y álbumes completos (LRCLIB). Limpia títulos automáticamente, omite pistas con letras preexistentes y guarda archivos `.lrc` compañeros en UTF-8 listos para cantar en modo karaoke en Prisma y reproductores externos.

---

### 💖 Apoyo y comunidad

Si disfrutas usando **Prisma**, considera apoyar el desarrollo continuo:
- ☕ **Buy Me a Coffee**: https://buymeacoffee.com/biglexj
- 💳 **Donaciones directas**: https://www.biglexj.com/donaciones
- 🐙 **GitHub**: https://github.com/biglexj
