# Separar Quick Look y Doble Clic en Prisma — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Refactorizar manejo de argumentos iniciales y single-instance en `src-tauri/src/lib.rs` para que el archivo abra en Prisma y no intercepte Quick Look por defecto.
- [x] T02 — Ajustar `App.tsx` y `VideoPlayer.tsx` para reemplazo instantáneo y fluido de vídeos cuando se recibe `prisma://open-media` durante reproducción activa.
- [x] T03 — Comprobar compilación en Rust (`cargo check`) y frontend (`bun run check`).
- [x] T04 — Preparar y documentar la validación en `VALIDATION.md`.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
