# Corrección Arrastre Nativo Universal hacia Apps Externas — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Neutralizar colisión OLE en `src/shared/useNativeFileDrag.ts` invocando `preventDefault()` y `stopPropagation()` para anular el drag interno HTML5 de Chromium y habilitar el control exclusivo a Windows OLE `DoDragDrop`.
- [x] T02 — Desbloquear `pointer-events: auto` y asignar cursores `grab`/`grabbing` en `.video-player-title` (`video-player.css`) y `.image-viewer-title` (`image-viewer.css`).
- [x] T03 — Diseñar e insertar píldoras táctiles de arrastre `.video-drag-handle-pill` y `.image-viewer-drag-pill` con micro-animaciones Material 3 Expressive en las cabeceras de ambos visores.
- [x] T04 — Incorporar detección de arrastre por desplazamiento de ratón (`Math.hypot > 10`) en `.video-stage` de `VideoPlayer.tsx`, cancelando automáticamente el temporizador de avance rápido (2x) si el usuario desplaza el cursor mientras mantiene presionado.
- [x] T05 — Blindar cuadrícula visual: transformar `visual-media-card` a `div role="button"` accesible, deshabilitar arrastre espurio de imágenes en `VisualThumbnail.tsx` y `VideoThumbnail.tsx` (`draggable={false}`, `user-drag: none`).
- [x] T06 — Ejecutar validación técnica integral (`bun run check` y `cargo test --features mpv`).

Las pruebas se documentan en `VALIDATION.md`.
