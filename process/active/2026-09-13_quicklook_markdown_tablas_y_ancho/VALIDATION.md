# QuickLook: Soporte de Tablas Markdown y Reajuste de Anchura — Validación

- Estado: `PASSED`

## Comprobaciones

- [x] V01 — Agente — Comprobar que tablas Markdown con sintaxis `| col | col |` y separador `|---|---|` se reconozcan y rendericen como elementos `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`.
- [x] V02 — Agente — Comprobar alineaciones de columna (`:---` izquierda, `:---:` centro, `---:` derecha) aplicadas en `style={{ textAlign }}`.
- [x] V03 — Agente — Comprobar que enlaces con código anidado (ej. `[`frontend/package.json`](url)`) se parseen correctamente sin perder el link ni el estilo de código.
- [x] V04 — Agente — Comprobar que `doc_w` en `resolve_media_size` y desmaximización esté configurado en `(screen_w * 0.60).round().max(680.0)`.
- [x] V05 — Agente — Comprobar que `.markdown-rendered-content` y el contenedor no dejen espacios en blanco excesivos y permitan a las tablas ocupar el ancho necesario con scroll horizontal si es necesario.
- [x] V06 — Agente — Ejecución limpia de `bun run check` (TypeScript), build de Vite (`bun run build:web`) y `cargo test` (29 tests exitosos).
- [x] V07 — Agente — Comprobar que en Explorer/Desktop, al hacer clic en punto vacío (deselección), el watcher cierra la ventana QuickLook automáticamente.
- [x] V08 — Agente — Comprobar que al hacer clic en otro archivo (o mover flechas), el watcher actualiza la previsualización al nuevo archivo sin cerrarse.
- [x] V09 — Agente — Comprobar que al teclear fuera de QuickLook (que no sean teclas de navegación ni modificadores), se dispara el cierre inmediato.
- [x] V10 — Agente — Comprobar que en Explorer con múltiples pestañas, la deselección (clic en punto vacío) en la pestaña activa retorne `None` sin hacer fallback a selecciones obsoletas de otras pestañas en segundo plano.
- [x] V11 — Agente — Comprobar que al presionar Impr Pant (`PrintScreen`), `Win+Shift+S` o activar `SnippingTool.exe`/`ScreenClippingHost.exe`, QuickLook permanezca abierto para permitir la captura sin cerrarse.
- [x] V12 — Agente — Comprobar que la ventana de documentos dimensione al 60% de pantalla (`screen_w * 0.60`), conservando el padding superior de 14px y calibrando el padding lateral a 16px alineado con la barra de herramientas.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
