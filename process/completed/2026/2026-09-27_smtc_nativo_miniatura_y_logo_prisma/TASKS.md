# Tareas: Integración SMTC Nativa de Windows — Carátula de Álbum y Logo/Identidad de Prisma

- [x] Implementar `NativeSmtcManager` completo en `src-tauri/src/infrastructure/media/smtc.rs` con soporte de miniaturas nativas vía WinRT y `RandomAccessStreamReference`.
- [x] Registrar comandos Tauri (`smtc_update_playback`, `smtc_update_metadata`, `smtc_update_timeline`, `smtc_clear`) y gestionar estado `NativeSmtcState` en `lib.rs`.
- [x] Conectar `useMediaSessionSync.ts` con los comandos nativos de Rust y escuchar `prisma://smtc-action`.
- [x] Retirar el audio silencioso `<audio>` de WebView2 en `App.tsx` para eliminar la sesión de Edge WebView2.
- [x] Ejecutar comprobación con `cargo check` y `bun run build`.
- [x] Probar reproducción y verificar que el flyout de volumen muestra la carátula y la identidad de Prisma.
- [x] Documentar evidencia en `VALIDATION.md` y `APPROVAL.md`.
- [x] Mover proceso a `process/completed/2026/` y registrar commit de resguardo.
