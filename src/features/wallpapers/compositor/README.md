# Composición Aurora en Prisma

El catálogo incluye los 25 efectos de Aurora y dos sistemas de partículas independientes.
La galería usa miniaturas estáticas; el escritorio mantiene un único contexto WebGL y un lienzo Canvas2D superpuesto.
La interfaz principal carga metadatos; las fábricas de efectos se importan al seleccionarlas.

## Capas

1. Vídeo o imagen local, reproducidos por libmpv.
2. Ambiente: por sí solo es un fondo; también se combina sobre la base. Incluye paletas procedurales, color sólido y degradado. Estos últimos tienen colores y opacidad ajustables.
3. Fondos dinámicos planos.
4. Escenarios 3D.
5. Partículas volumétricas.
6. Partículas 2D de Aurora, con forma, dirección, tamaño, densidad, velocidad, color y opacidad propios.

Parallax actúa sobre las capas con cámara y, opcionalmente, sobre el medio base mediante desplazamiento y un pequeño zoom. Lee posición del cursor sin instalar hooks ni capturar clics.
No requiere una imagen, vídeo o escenario para activar ambiente o partículas.
Cambiar de categoría no detiene los motores. Se puede quitar solo el medio base o detener toda la composición.

## Procedencia y mantenimiento

`aurora/` procede de `Aurora---Blog`, no de `antwny/aura`.
`provenance.json` registra SHA-256 de 46 originales del motor y del componente de partículas 2D.
Actualizar explícitamente con `bun scripts/sync-aurora-wallpapers.ts`, teniendo Aurora al lado de Prisma.
Las adaptaciones se mantienen en ese script; los builds no leen el repositorio vecino.
Three.js conserva su aviso en `THREE-LICENSE.txt`.

Los ajustes se guardan en `live_wallpapers.json`, separados por efecto y capa.
La composición se activa manualmente; no se restaura automáticamente al arrancar.
La pausa cancela los bucles de animación y el cierre libera recursos y listeners.
No se captura audio ni se fabrica un nivel reactivo. Ecualizador real, recuperación de Explorer,
políticas automáticas de pausa y medición sostenida de consumo siguen pendientes.

## Capturas

Con Vite iniciado, `scripts/render-wallpaper-previews.cjs` genera imágenes del motor real.
Admite `--width=1920 --height=1080 --format=png --out=assets/wallpapers/scenes-1080`.
`PRISMA_PLAYWRIGHT_ROOT` permite señalar una instalación externa de Playwright.
Las miniaturas distribuidas están en `public/wallpapers/scenes`; los originales reutilizables a 1080p,
en `assets/wallpapers/scenes-1080`, fuera del paquete web de producción.

## Navegación

Vídeos, Imágenes, Ambiente, Escenarios 3D, Partículas y Parallax tienen pestañas propias.
Escenarios 3D contiene los 25 elementos en los grupos y orden definidos por DYNAMIC_BACKGROUND_GROUPS de Aurora: Escenarios 3D (17) y Efectos 3D (8). El sincronizador registra uiGroup, sin inferir categorías de interfaz de las capacidades de cámara.
Partículas contiene las partículas superpuestas independientes. Elegir un escenario reemplaza el anterior y conserva el medio, ambiente y partículas superpuestas. Los controles y sus ajustes se conservan por efecto.
Los campos internos dynamic/scenario/particle mantienen compatibilidad con la configuración anterior y encaminan el renderizado; no definen pestañas ni grupos visuales.

## Reproducción y aplicación

Las tarjetas de ambiente, escenario y partículas guardan la selección antes de activar la superficie si estaba apagada. La creación muestra explícitamente la ventana Tauri y su WebView2. WebGL tiene un límite de 30 fps; la cadencia de mpv es independiente. La migración de perfiles del modelo anterior evita escenarios simultáneos ocultos.
GIF pertenece a Imágenes y reproduce su animación en bucle durante la duración elegida; no se congela al terminar su primer ciclo. El motor lee archivos originales y conserva resolución de decodificación; spline36/mitchell mejoran el escalado sin reconstruir detalle inexistente.

## Clics en efectos interactivos

Burbujas Explosivas reacciona al punto del clic; cada clic cambia la forma de Nexo Cuántico. La implementación reutiliza onClick de Aurora. Windows entrega una copia de la entrada de ratón al host mediante Raw Input, sin desactivar los mensajes normales. Se filtra por superficie de escritorio de Explorer, se descartan arrastres y los clics sobre otras aplicaciones, y se retira el registro al pausar/cambiar/cerrar.
La cola está limitada a 32 clics; solo se consulta para los dos efectos interactivos visibles y sin pausa. El adaptador convierte coordenadas normalizadas a un punto 3D. La adaptación del pulso de clic se conserva en el sincronizador, sin modificar las fábricas generadas a mano.
