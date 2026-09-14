# QuickLook: Soporte de Tablas Markdown y Reajuste de Anchura — Plan

- Estado: `COMPLETED`
- Fecha: `2026-09-13`
- Proyecto: `Prisma`

## Objetivo

Incorporar soporte completo para renderizado de tablas en Markdown, optimizar la anchura de ventana de documentos en QuickLook al 60% de la pantalla y añadir auto-cierre inteligente al hacer clic en un punto vacío, en otra ventana o al teclear fuera de QuickLook, preservando la selección y cambio de archivo con clic o flechas.

## Alcance

- Incluye:
  - Soporte de sintaxis de tablas Markdown GFM en `QuickLookMarkdown.tsx` (encabezados, alineación de columnas `:---`, `:---:`, `---:`, filas de datos, renderizado con elementos React nativos e inmunes a XSS).
  - Soporte mejorado de elementos inline dentro de celdas de tabla (código inline, enlaces formateados como `[`code`](url)`, negrita, cursiva, tachado).
  - Estilos Material 3 Expressive en `quick-look-markdown.css` para tablas (`.md-table`, `.md-table-wrapper`, scroll horizontal, bordes tonales, encabezado elevado, hover sutil).
  - Reducción del ancho ergonómico de documentos en `src-tauri/src/features/quick_look/service.rs` y `quick_look.rs` de 70% a 60% (`screen_w * 0.60`), conservando la altura intacta al 80%.
  - Ajuste del contenedor `.markdown-rendered-content` para ceñirse elegantemente al ancho de la ventana sin bandas vacías a los costados.
  - Auto-cierre en `service.rs` cuando el usuario hace clic en un espacio vacío ("punto vacío" sin selección en Explorer o Escritorio) o enfoca otra aplicación ajena.
  - Preservación de la vista previa cuando el usuario hace clic sobre otro archivo o navega con flechas (cambia de archivo sin cerrarse).
  - Auto-cierre en `keyboard_hook.rs` cuando el usuario teclea fuera de QuickLook (teclas alfanuméricas, enter, etc.), permitiendo que las teclas de navegación actualicen la vista previa.
- No incluye:
  - Modificaciones a los tipos multimedia de Audio, Video o Imagen en QuickLook (sus dimensiones especializadas se mantienen).
  - Dependencias externas pesadas de npm.

## Enfoque

1. Crear el parser de tablas y mejoras inline en `QuickLookMarkdown.tsx`.
2. Añadir reglas CSS de alta fidelidad para tablas y contenedor Markdown en `quick-look-markdown.css`.
3. Ajustar la dimensión base de ancho para documentos en `resolve_media_size` dentro de `src-tauri/src/features/quick_look/service.rs` y en `quick_look.rs`.
4. Implementar en `service.rs` la detección de punto vacío (deselección) y foco exterior para cerrar QuickLook automáticamente tras el período de gracia.
5. Implementar en `keyboard_hook.rs` el cierre al teclear fuera de QuickLook (excluyendo flechas de navegación y modificadores).
6. Validar compilación (`bun run check`, `bun run build:web`, `cargo test`).
7. Verificar y documentar en `VALIDATION.md` y `APPROVAL.md`.

## Criterios de finalización

- [x] Las tablas de Markdown se renderizan como tablas HTML semánticas completas con encabezado, alineaciones y celdas legibles.
- [x] Enlaces con código anidado se renderizan como enlaces funcionales con estilo de código dentro.
- [x] La anchura de la ventana en modo documento se reduce del 70% al 60% de la pantalla sin alterar la altura (80%).
- [x] El contenido de Markdown se ajusta armónicamente sin dejar grandes espacios en blanco a los laterales.
- [x] Al hacer clic en un punto vacío en Explorer/Escritorio, QuickLook se cierra.
- [x] Al hacer clic en otra imagen o archivo en Explorer, QuickLook NO se cierra y actualiza la vista previa al nuevo archivo.
- [x] Al hacer clic en otra aplicación ajena (ej. Chrome, Word, barra de tareas), QuickLook se cierra.
- [x] Al teclear fuera de QuickLook (que no sean flechas de navegación ni modificadores), QuickLook se cierra.
- [x] `bun run check` y `cargo test` se ejecutan sin errores.

## Autorización

- [x] Plan aprobado para ejecución.
