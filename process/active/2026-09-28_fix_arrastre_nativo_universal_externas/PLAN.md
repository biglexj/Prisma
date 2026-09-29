# Corrección Arrastre Nativo Universal hacia Apps Externas — Plan

- Estado: `IN_PROGRESS`
- Fecha: `2026-09-28`
- Proyecto: `Prisma`

## Objetivo

Restaurar y perfeccionar la funcionalidad de arrastre nativo de archivos (Drag & Drop OS mediante Windows OLE `CF_HDROP`) desde el reproductor de vídeo, visor de imágenes y cuadrícula de la galería hacia aplicaciones externas (DaVinci Resolve, Premiere, Affinity, Photoshop, Krita, Explorador de Windows), eliminando bloqueos de eventos en CSS/HTML5 y agregando asideros visuales y detección de arrastre por movimiento del ratón.

## Alcance

- Incluye:
  - Desbloqueo de eventos de ratón (`pointer-events: auto; cursor: grab`) en los títulos de `VideoPlayer` e `ImageViewer` que estaban suprimidos por sus contenedores padres.
  - Implementación de píldoras visibles de arrastre (`.video-drag-handle-pill` y `.image-viewer-drag-pill`) para una ergonomía clara y accesible.
  - Detección de arrastre por desplazamiento del ratón en el escenario de vídeo (`.video-stage`) con cancelación automática de avance rápido (2x) si el usuario desplaza el cursor mientras mantiene presionado.
  - Cancelación preventiva del drag HTML5 interno (`e.preventDefault()`, `e.stopPropagation()`) en `handleNativeDragStart` para que Chromium/WebView2 no secuestre la sesión OLE del sistema operativo con datos planos de texto.
  - Conversión del elemento tarjeta de galería en `VisualLibrary.tsx` a un contenedor `div role="button"` accesible y bloqueo del arrastre por defecto de las imágenes en miniatura (`draggable={false}`).
- No incluye:
  - Modificación de la arquitectura central de librerías ni de bases de datos.

## Enfoque

1. Diagnóstico de bloqueos de capas: Resolver la herencia de `pointer-events: none` de los contenedores superiores.
2. Neutralización de colisiones OLE: Detener la sesión interna de Chromium con `preventDefault()` para otorgar prioridad a `DoDragDrop` con `IShellItemArray` y `CF_HDROP`.
3. Ergonomía en reproductores: Píldora de arrastre dedicada y detección de umbral de movimiento del ratón (> 10px) en el reproductor.
4. Robustez en cuadrícula: Miniaturas sin arrastre espurio y tarjetas con comportamiento nativo sin interferencia de `<button>`.

## Criterios de finalización

- [x] Píldora de arrastre visible y responsiva en el reproductor de vídeo y visor de imágenes.
- [x] Los títulos muestran cursor `grab` / `grabbing` y responden al arrastre.
- [x] El escenario de vídeo no queda atrapado en avance rápido al mover el cursor para arrastrar el archivo hacia DaVinci Resolve.
- [x] Las tarjetas de la biblioteca visual inician el arrastre OLE hacia el sistema operativo limpiamente.
- [x] Verificación de TypeScript (`bun run check`: 0 errores) y suite Rust (`cargo test --features mpv`: 35 superados).

## Autorización

- [x] Plan aprobado para ejecución.
