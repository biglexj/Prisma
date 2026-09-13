# QuickLook: Soporte de Tablas Markdown y Reajuste de Anchura — Tareas

- Estado: `DONE`

## Ejecución

- [x] T01 — Implementar parser y renderizado de tablas GFM en `QuickLookMarkdown.tsx` con soporte de alineaciones y formato inline en celdas.
- [x] T02 — Refinar precedencia de formato inline para soportar enlaces con código anidado (ej. `[`path`](url)`).
- [x] T03 — Diseñar estilos de tablas Material 3 y ajustar ancho/márgenes de `.markdown-rendered-content` en `quick-look.css` y `quick-look-markdown.css`.
- [x] T04 — Ajustar `doc_w` en `service.rs` y `quick_look.rs` de 70% a 60% (`screen_w * 0.60`) para documentos (Markdown, Text, etc.).
- [x] T05 — Ejecutar chequeo de tipos (`bun run check`), build de Vite y pruebas nativas (`cargo test`).
- [x] T06 — Registrar resultados de verificación en `VALIDATION.md` y preparar `APPROVAL.md`.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
