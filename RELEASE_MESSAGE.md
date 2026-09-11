# 🔄 Prisma v1.1.0 — Convertidor Multimedia por Lotes, Calidad Lossless Dedicada (FLAC/WAV) y Selectores M3 Expressive

Llega **Prisma v1.1.0**, una actualización mayor que potencia tus flujos de trabajo multimedia: ahora cuentas con un **Convertidor por Lotes** impulsado por el motor nativo de FFmpeg (Vídeo a Audio, Transcodificador de Vídeo y Audio), tratamiento especializado de **Audio Lossless** para FLAC (Nivel 8 Bit-Perfect) y WAV (24-bit PCM), y una experiencia de interfaz renovada con el nuevo selector personalizado **CustomSelect (Material 3 Expressive)** en toda la aplicación.

---

### ✨ Novedades destacadas

- 🔄 **Convertidor Multimedia por Lotes con FFmpeg**: Procesa archivos o carpetas completas en segundo plano:
  - **Vídeo a Audio**: Extrae audio a MP3, FLAC, WAV, AAC, OGG y M4A con selección de canales estéreo o mono.
  - **Conversor de Vídeo**: Transcodifica a MP4, MKV o WebM con códecs H.264, HEVC (H.265), AV1 o copia directa de stream sin pérdida de tiempo, más escalado a 1080p, 720p o 480p.
  - **Transcodificador de Audio**: Conversión entre formatos musicales con gestión flexible de calidad.
  - **Reglas de Renombrado en Lote**: Añade prefijos, sufijos o busca y reemplaza texto automáticamente.
- 🎵 **Tratamiento Especializado para Audio Lossless (FLAC y WAV)**: Decimos adiós a los bitrates con pérdida en formatos puros. Al seleccionar **FLAC**, se aplica automáticamente compresión sin pérdida bit a bit (Nivel 8 máximo o Nivel 5 rápido). Al elegir **WAV**, se utiliza codificación PCM sin compresión de hasta 24 bits Hi-Res (calidad de estudio).
- 🎨 **Selectores Personalizados Material 3 Expressive (`CustomSelect`)**: Se eliminaron los selectores desplegables estándar del navegador, reemplazándolos por un componente visual estilizado con esquinas redondeadas, elevación dinámica, micro-animaciones fluidas, indicador visual de selección (`check`), descripciones contextuales y control mediante teclado y clic exterior.
- 🎛️ **Ecualizador DSP & Salida de Audio Unificada en Vídeo**: Control acústico total y conmutación de altavoces o auriculares en tiempo real desde la barra de reproducción de vídeo, con soporte `setSinkId`, elevación visual de capas y sincronización perfecta con el ecualizador musical.
- 🧩 **Componente Centralizado Reutilizable & Mejoras de UI**: Nueva arquitectura modular en `src/shared/ui/` para componentes transversales, reposicionamiento dinámico adaptativo del toast de capturas a 28 px sin controles y mayor robustez en Quick Look.

---

### 💖 Apoyo y comunidad

Si disfrutas usando **Prisma**, considera apoyar el desarrollo continuo:
- ☕ **Buy Me a Coffee**: https://buymeacoffee.com/biglexj
- 💳 **Donaciones directas (Yape / Plin / Web)**: https://www.biglexj.com/donaciones
- 🐙 **GitHub**: https://github.com/biglexj
