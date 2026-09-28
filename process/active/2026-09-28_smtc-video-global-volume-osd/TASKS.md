# Sincronización SMTC Nativa de Vídeo y OSD de Volumen Global en Prisma — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Extender `load_video_thumbnail_raw_bytes` en `src-tauri/src/infrastructure/media_preview/mod.rs`.
- [x] T02 — Ampliar `NativeSmtcManager` y `smtc_update_metadata` en Rust para soportar tipo `"video"`, metadatos de vídeo y miniaturas nativas.
- [x] T03 — Añadir `--disable-features=HardwareMediaKeyHandling` a `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` en `src-tauri/src/main.rs`.
- [x] T04 — Migrar `VideoPlayer.tsx` de `navigator.mediaSession` a los comandos nativos de SMTC (`smtc_update_metadata`, `smtc_update_playback`, `smtc_update_timeline`) y receptor de `"prisma://smtc-action"`.
- [x] T05 — Ajustar `useMediaSessionSync.ts` para alternancia sin fricción entre música y vídeo.
- [x] T06 — Añadir estilos fijos globales en `volume-osd.css` e instanciar `VolumeOsd` y `useVolumeOsd` en la raíz de `App.tsx` con listener `prisma-global-volume-osd`.
- [x] T07 — Conectar atajos de teclado y eventos en `App.tsx`, `PlaybackPreview.tsx` y controles de volumen.
- [x] T08 — Ejecutar validación de compilación frontend (`tsc`) y backend (`cargo check`).
- [x] T09 — Documentar evidencia en `VALIDATION.md` y actualizar `ROADMAP.md`.
