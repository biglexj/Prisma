# 🚀 Prisma v1.1.2 — Buscador de Duplicados Multimodal (Música, Imágenes y Vídeos), Hero Dropzone y Quick Look Ampliado

Llega **Prisma v1.1.2**, una entrega colosal que expande la suite con el nuevo **Buscador y Comparador de Duplicados Multimodal** (con detección acústica Hi-Res para música y similitud perceptual para imágenes/vídeos), la arquitectura de **Hero Dropzone Central con optimización vertical**, gestión modular de **Herramientas en Configuración y Barra Lateral**, previsualización de **Documentos en Quick Look al 70-80% de pantalla** y soporte fluido de **Arrastrar y Soltar (Drag & Drop)** en toda la suite.

---

### ✨ Novedades destacadas

- 🎵 **Duplicados de Música con Detección Hi-Res**: Pipeline híbrido por hash binario exacto y metadatos inteligentes (Lofty normalizado + duración), priorizando automáticamente formatos sin pérdida (FLAC, WAV, ALAC) y bitrates de 320 kbps para conservar la mejor versión de audio.
- 🖼️ **Duplicados de Imágenes y Vídeos con Comparador Frente a Frente**: Análisis por hash y similitud perceptual (dHash 64 bits con tolerancia ajustable), con comparativa en pantalla dividida integrada (`ImageComparisonModal`).
- 📂 **Comparativa Cruzada de 2 Carpetas (Base vs Depurar)**: Protege tu carpeta base intacta y limpia o actualiza duplicados desde carpetas externas o de depuración.
- 🎯 **Hero Dropzone Central & Ahorro de Espacio Vertical**: El centro de la pantalla actúa como receptor interactivo de arrastre y clic para examinar carpetas, transformándose en una barra compacta ultra delgada de 36 px al cargar resultados para aprovechar el 100% de la altura de pantalla.
- 🛠️ **Pestaña «Herramientas» en Configuración & Barra Lateral**: Controla la visibilidad de cada utilidad (Conversor, Renombrador, Duplicados, Luna Fetch, Gallery-DL, Wallpapers) y accede a Duplicados directamente desde el menú principal.
- 📑 **Quick Look para Documentos, PDFs y Libros**: Previsualización ampliada y reactiva (70% ancho, 80% alto) para Markdown, Texto, PDF, EPUB y archivos ZIP, con botones directos para «Editar» en tu app predeterminada y «Abrir» en el visor de Prisma.
- 🖐️ **Arrastrar y Soltar Nativo OLE Win32**: Receptor nativo en Rust para soltar carpetas y archivos directamente desde el Explorador en el Renombrador, Conversor y Duplicados, con cursor de copia (+) continuo y re-registro dinámico al enfocar la ventana.

---

### 💖 Apoyo y comunidad

Si disfrutas usando **Prisma**, considera apoyar el desarrollo continuo:
- ☕ **Buy Me a Coffee**: https://buymeacoffee.com/biglexj
- 💳 **Donaciones directas (Yape / Plin / Web)**: https://www.biglexj.com/donaciones
- 🐙 **GitHub**: https://github.com/biglexj
