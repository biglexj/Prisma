# QuickLook: Soporte de Tablas Markdown y Reajuste de Anchura — Tareas

- Estado: `DONE`

## Ejecución

- [x] T01 — Implementar parser y renderizado de tablas GFM en `QuickLookMarkdown.tsx` con soporte de alineaciones y formato inline en celdas.
- [x] T02 — Refinar precedencia de formato inline para soportar enlaces con código anidado (ej. `[`path`](url)`).
- [x] T03 — Diseñar estilos de tablas Material 3 y ajustar ancho/márgenes de `.markdown-rendered-content` en `quick-look.css` y `quick-look-markdown.css`.
- [x] T04 — Ajustar `doc_w` en `service.rs` y `quick_look.rs` de 70% a 60% (`screen_w * 0.60`) para documentos (Markdown, Text, etc.).
- [x] T05 — Ejecutar chequeo de tipos (`bun run check`), build de Vite y pruebas nativas (`cargo test`).
- [x] T06 — Registrar resultados de verificación en `VALIDATION.md` y preparar `APPROVAL.md`.
- [x] T07 — Implementar detección de deselección ("punto vacío") y pérdida de foco hacia apps externas en `service.rs`.
- [x] T08 — Implementar auto-cierre al teclear fuera de QuickLook (alfanuméricos, etc., preservando navegación y modificadores) en `keyboard_hook.rs`.
- [x] T10 — Restringir la consulta COM en Explorer con pestañas exclusivamente a la pestaña activa (`candidates.first()`), eliminando el fallback a pestañas inactivas que recuperaba selecciones obsoletas.
- [x] T11 — Eximir atajos y procesos de captura de pantalla (`PrintScreen`, `Win+Shift+S`, `SnippingTool`, `ScreenClippingHost`) de auto-cierre para capturar QuickLook sin cerrarlo.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
