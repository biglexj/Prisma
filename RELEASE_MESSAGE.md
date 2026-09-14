# 🚀 Prisma v1.1.3 — Comparativa Cruzada Estricta en Duplicados y Modo Compacto Dual

Llega **Prisma v1.1.3**, una versión de afinamiento y máxima precisión para el **Buscador y Comparador de Duplicados**, implementando la **comparativa cruzada estricta** entre carpetas (Base vs Depurar) para garantizar la protección total de la carpeta base sin falsos positivos internos, junto con la nueva **barra compacta dual** que ahorra más del 60% de espacio vertical para una exploración limpia de duplicados.

---

### ✨ Novedades destacadas

- 🛡️ **Comparativa Cruzada Estricta (Base vs Depurar)**: Al comparar dos carpetas, el motor de búsqueda en Rust compara exclusivamente los archivos de la Carpeta a Depurar contra los de la Carpeta Base protegida. Se eliminan por completo los falsos positivos intra-carpeta (no compara archivos de Base entre sí ni de Depurar entre sí).
- 🔬 **Detección Híbrida Optimizada**: La comparativa cruzada estricta aplica tanto para coincidencia exacta por hash binario (100%) como para similitud perceptual visual (dHash de 64 bits en imágenes/vídeos) y acústica (metadatos Lofty y duración en música).
- 📐 **Barra Compacta Dual (Ahorro de ~85 px Verticales)**: Al seleccionar ambas carpetas, las tarjetas grandes se transforman automáticamente en una barra horizontal elegante de solo 44 px, liberando espacio para visualizar cómodamente las tarjetas de imágenes y duplicados.
- 🎨 **Cápsulas Tonal Material 3 Expressive**: Identificación inmediata con distintivos verde esmeralda para la Base intacta y naranja vibrante para la carpeta a depurar, con rutas en tipografía monoespaciada, cambio rápido y soporte nativo de Arrastrar y Soltar (*Drag & Drop*).
- ⇄ **Intercambio y Expansión Rápida**: Botón de swap instantáneo (`⇄`) para invertir roles y conmutador sutil para expandir o contraer las tarjetas detalladas cuando lo desees.

---

### 💖 Apoyo y comunidad

Si disfrutas usando **Prisma**, considera apoyar el desarrollo continuo:
- ☕ **Buy Me a Coffee**: https://buymeacoffee.com/biglexj
- 💳 **Donaciones directas (Yape / Plin / Web)**: https://www.biglexj.com/donaciones
- 🐙 **GitHub**: https://github.com/biglexj
