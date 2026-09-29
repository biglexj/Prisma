# Validación

- `bun run build`: correcto; TypeScript y Vite compilaron el frontend.
- `bun run check`: correcto (0 errores de TypeScript con `tsc --noEmit`).
- `bun test test/nativeDragPreview.test.ts`: 4 pruebas pasadas al 100% (19 aserciones). Valida proporciones fijas cuadradas para música, 16:9 y 9:16 para vídeo/imágenes, escalado cover centrado en el lienzo y recuperación ante fallbacks.
- `cargo check --offline --manifest-path src-tauri/vendor/drag/Cargo.toml`: correcto con `$env:CARGO_TARGET_DIR="temp/drag-check-target"`.
- `crColorKey`: configurado a `COLORREF(0xFFFFFFFF)` (`CLR_INVALID`), eliminando la clave de color negro transparente que provocaba que Windows Shell recortara los píxeles oscuros de la miniatura.
- `crossOrigin="anonymous"`: añadido a los visores y componentes de miniaturas (`VisualThumbnail`, `VideoThumbnail`, `MusicArtwork`, `ImageViewer`) garantizando que `canvas.toDataURL()` no sea bloqueado por *tainted canvas*.
- `VideoPlayer.tsx`: depurado el selector `.video-stage-surface`, permitiendo que el arrastre obtenga limpiamente el icono o miniatura de la biblioteca.
- Pendiente: observación interactiva en Windows del arrastre de imagen, música y vídeo hacia el escritorio u otras aplicaciones como DaVinci Resolve o Affinity.
