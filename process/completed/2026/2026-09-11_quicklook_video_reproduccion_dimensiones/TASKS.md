# QuickLook: Corrección de Dimensiones, Caché y Reproducción de Vídeo Sobrescrito — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Corregir GUID de `PKEY_VIDEO_FRAME_WIDTH`/`HEIGHT` en `src-tauri/src/features/quick_look/model.rs`.
- [x] T02 — Añadir validación de límites (<= 8192) y fallback ffprobe en `model.rs`.
- [x] T03 — Añadir `video_poster_url` al payload nativo en `model.rs` para apertura con poster inmediato.
- [x] T04 — Configurar tamaño discreto fallback en `service.rs` (`560x360`).
- [x] T05 — Actualizar tipos TypeScript en `src/features/quick_look/model/types.ts`.
- [x] T06 — Actualizar `QuickLookVideo.tsx` con cache-busting, poster nativo, liberación de streams y tarjeta de reintento/error.
- [x] T07 — Actualizar `QuickLookWindow.tsx` para remontar por `path + size + modified` y sanear `QuickLookHeader.tsx`.
- [x] T08 — Ejecutar comprobaciones automatizadas (cargo check, cargo test, bun run build).
- [x] T09 — Adoptar regla de Documentación Core (`Docs/stacks/rust` y `target-directory-bloat.md`): `[profile.dev]` ligero y scripts `sweep`.
- [x] T10 — Preparar la validación y actualizar `VALIDATION.md`.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
