# Aurora Synapse Protocol — Integración en Prisma — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Crear módulo Rust `src-tauri/src/features/synapse/model.rs` con estructuras JSON (Beacon, Handoff, Upload, Status).
- [x] T02 — Implementar emisor UDP Broadcast `beacon.rs` (puerto 49289, intervalo 6s, zero-config).
- [x] T03 — Implementar microservidor HTTP/TCP `server.rs` (puerto 49288) para `/api/v1/synapse/handoff`, `/api/v1/synapse/upload` y `/api/v1/synapse/status`.
- [x] T04 — Implementar registro en Windows Registry y parser de URIs `prisma://` en `deep_link.rs`.
- [x] T05 — Integrar Synapse en el ciclo de vida Tauri (`lib.rs`) y en `tauri_plugin_single_instance`.
- [x] T06 — Ajustar recepción en el frontend (`App.tsx`) para Handoff instantáneo y notificación de archivos LAN.
- [x] T07 — Actualizar `.agents/rules/core_profile.md` y `ROADMAP.md`.
- [x] T08 — Preparar la validación y pruebas de endpoints.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
