# 🚀 Prisma v1.0.2 — Suite de Comparativa de Imágenes, Bento Grid y Modo Desarrollo Aislado

Llega **Prisma v1.0.2**, una importante actualización que introduce la nueva **Suite de Comparativa de Imágenes Multimodal** integrada al visor y a QuickLook, soporte para **instancias y ventanas desacopladas en paralelo**, **modo desarrollo aislado** para programar sin bloqueos, rediseño adaptable de fondos de pantalla en **Bento Grid de 12 columnas**, expansión de la **Suite Musical Aurora Cloud** (Música, Instrumentales y Karaokes) con test de ping en tiempo real, y **estabilización de alto rendimiento en las barras de progreso** sin parpadeos ni recálculos continuos de layout.

---

### ✨ Novedades Destacadas

- 🔍 **Suite de Comparativa de Imágenes Multimodal**: Inspecciona y contrasta fotografías con 4 modos visuales: Cortina Deslizante (*Split Slider*), Lado a Lado simétrico, Alternancia Rápida (*Flicker* a 60 Hz para notar microdiferencias) y Mapa de Diferencia matemática, con zoom sincronizado hasta el 500% y atajo rápido (`C`).
- 🪟 **Ventanas Desacopladas en Quick Look**: Desacopla múltiples visores flotantes para mantener abiertas comparaciones de imágenes, vídeos o documentos de forma simultánea.
- ⚡ **Modo Desarrollo Aislado y Concurrencia**: Bypass inteligente de bloqueo para ejecutar Prisma en modo desarrollo concurrentemente con la versión oficial instalada mediante perfiles de datos aislados (`dev_profile/`).
- 🍱 **Bento Grid Adaptativo para Wallpapers Aurora**: Cuadrícula de 12 columnas densa que empaqueta armoniosamente fondos 16:9, 21:9, 9:16 y 1:1 eliminando huecos negros residuales, con botones flotantes de favoritos y tarjetas de cristal esmerilado.
- ☁️ **Suite Musical Aurora Cloud & Test de Servidor**: Panel de configuración con medición de latencia/ping en vivo y catálogo dividido en 3 vertientes: Explorar Música (Audio HD), Pistas Instrumentales (Off-Vocal) y Karaokes con letras dinámicas (LRC / Sing).
- 🎯 **Barras de Progreso Ultra-Estables (Zero Layout Thrashing)**: Migración del motor de canvas a `ResizeObserver`, garantizando una altura inmutable de 28px y eliminando al 100% los saltos de altura y parpadeos al pasar el cursor.
- 🔁 **Autorun Persistente Tras Actualización**: El inicio automático con Windows ya no se desactiva al instalar actualizaciones. Prisma detecta y restablece la entrada del registro silenciosamente en cada inicio si fue limpiada por el instalador.

---

### 💖 Apoyo y Comunidad

Si disfrutas usando **Prisma**, considera apoyar el desarrollo continuo:
- ☕ **Buy Me a Coffee**: https://buymeacoffee.com/biglexj
- 💳 **Donaciones Directas**: https://www.biglexj.com/donaciones
- 🐙 **GitHub**: https://github.com/biglexj
