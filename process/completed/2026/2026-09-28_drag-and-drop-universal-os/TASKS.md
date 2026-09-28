# Arrastre Nativo Universal hacia Aplicaciones Externas (Drag & Drop OS) — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Instalar `tauri-plugin-drag` en `src-tauri` y `@crabnebula/tauri-plugin-drag` en el frontend.
- [x] T02 — Registrar el plugin en `src-tauri/src/lib.rs` y configurar permisos en `src-tauri/capabilities/default.json`.
- [x] T03 — Crear utilidad transversal `src/shared/useNativeFileDrag.ts` con manejo de iconos de arrastre y soporte multiformato.
- [x] T04 — Integrar el handler de arrastre nativo en las tarjetas de galería visual (`VisualLibrary.tsx`, `VisualThumbnail.tsx` y `VideoThumbnail.tsx`).
- [x] T05 — Integrar el handler de arrastre nativo en pistas de música (`MusicCard.tsx`, `FolderManager.tsx`, `MediaTreeView.tsx`, `PlaybackPreview.tsx` y `PlaybackQueuePanel.tsx`).
- [x] T06 — Integrar el handler de arrastre nativo en visores completos (`ImageViewer.tsx` y `VideoPlayer.tsx`).
- [x] T07 — Verificar compatibilidad con recepción de archivos (`useGlobalFileDrop.ts`).
- [x] T08 — Ejecutar validación de compilación frontend (`bun run build`) y backend (`cargo check`).
- [x] T09 — Documentar evidencia en `VALIDATION.md`, cerrar `APPROVAL.md` y crear commit de resguardo.
