# Comparador Multimedia (Fotos y Vídeos Sincronizados) — Tareas

- Estado: `PENDING`

## Ejecución

- [ ] T01 — Extender `src/features/comparison/model/types.ts` con tipos de vídeo (`SUPPORTED_VIDEO_EXTENSIONS`, `isVideoPath`, `isSupportedMediaPath`, creación de `VisualLibraryItem` con kind `"video"`).
- [ ] T02 — Actualizar `App.tsx` para inyectar biblioteca de imágenes y vídeos combinada a `ImageComparisonModal`.
- [ ] T03 — Actualizar `ImageComparisonEmptySlot.tsx` e `ImageComparisonSelector.tsx` para admitir drag & drop y selección de vídeos con selector de filtro (Todo / Imágenes / Vídeos).
- [ ] T04 — Crear subcomponente `ComparisonMediaLayer.tsx` para renderizar `<img>` o `<video>` según el tipo de archivo, manteniendo compatibilidad con transformaciones de zoom/pan.
- [ ] T05 — Crear barra de control de transporte de vídeo sincronizado (Play/Pause dual, línea de tiempo/seek sincronizado, tiempo actual/duración).
- [ ] T06 — Implementar el enrutamiento inteligente de audio por cursor (Hover / PointerEnter activa audio en el slot activo y silencia los demás, con indicador 🔊 / 🔇).
- [ ] T07 — Integrar soporte en `DuplicateGroupCard.tsx` para mostrar el botón "Comparar" cuando `activeKind === "video"`.
- [ ] T08 — Auditar límites de longitud de archivos (< 1,200 líneas) y compilar con `bun run build`.
- [ ] T09 — Preparar la validación en `VALIDATION.md`.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
