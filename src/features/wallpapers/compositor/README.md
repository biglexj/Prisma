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

Vídeos, Imágenes, Ambiente, Dinámicos, Escenarios 3D, Partículas y Parallax tienen pestañas superiores propias.
Cada pestaña muestra solo su catálogo y sus controles. Partículas reúne los selectores 3D y 2D, con ajustes y activación independientes.
No hay galería global Todos ni una segunda fila de categorías. Dinámicos agrupa los cinco fondos procedurales animados de pantalla completa.
