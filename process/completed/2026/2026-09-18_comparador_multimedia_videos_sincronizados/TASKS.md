# Comparador Multimedia (Fotos, Vídeos y Audios Sincronizados) — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Extender `src/features/comparison/model/types.ts` con tipos de vídeo y audio (`SUPPORTED_VIDEO_EXTENSIONS`, `SUPPORTED_AUDIO_EXTENSIONS`, `isVideoPath`, `isAudioPath`, `getMediaType`, `isSupportedMediaPath`, creación de `VisualLibraryItem` con kind `"video"` / `"audio"`).
- [x] T02 — Actualizar `App.tsx` para inyectar biblioteca de imágenes, vídeos y pistas de música combinadas a `ImageComparisonModal`.
- [x] T03 — Actualizar `ImageComparisonEmptySlot.tsx` e `ImageComparisonSelector.tsx` para admitir drag & drop y selección de vídeos y música con selector de filtro adaptativo y restricción estricta por tipo.
- [x] T04 — Crear subcomponente `ComparisonMediaLayer.tsx` para renderizar `<img>`, `<video>` o pista de audio con carátula de Lofty, vinilo animado y ecualizador dinámico manteniendo transformaciones de zoom/pan.
- [x] T05 — Crear barra de control de transporte de vídeo sincronizado (Play/Pause dual, línea de tiempo/seek sincronizado, tiempo actual/duración).
- [x] T06 — Implementar el enrutamiento inteligente de audio por cursor (Hover / PointerEnter activa audio en el slot activo y silencia los demás, con indicador 🔊 / 🔇).
- [x] T07 — Integrar soporte en `DuplicateGroupCard.tsx` para mostrar el botón "Comparar" cuando `activeKind === "video"`.
- [x] T08 — Implementar restricción estricta por tipo de medio (imagen con imagen, vídeo con vídeo, audio con audio) para evitar colisiones y conflictos de formato en ranuras y exploradores.
- [x] T09 — Auditar límites de longitud de archivos (< 1,200 líneas) y compilar con `bun run build`.
- [x] T10 — Preparar la validación en `VALIDATION.md`.

Las pruebas se documentan en `VALIDATION.md`.
