# QuickLook: Soporte de Tablas Markdown y Reajuste de Anchura — Plan

- Estado: `COMPLETED`
- Fecha: `2026-09-13`
- Proyecto: `Prisma`

## Objetivo

Incorporar soporte completo para renderizado de tablas en Markdown y optimizar la anchura de ventana de documentos en QuickLook al 60% de la pantalla para eliminar espacios en blanco laterales excesivos.

## Alcance

- Incluye:
  - Soporte de sintaxis de tablas Markdown GFM en `QuickLookMarkdown.tsx` (encabezados, alineación de columnas `:---`, `:---:`, `---:`, filas de datos, renderizado con elementos React nativos e inmunes a XSS).
  - Soporte mejorado de elementos inline dentro de celdas de tabla (código inline, enlaces formateados como `[`code`](url)`, negrita, cursiva, tachado).
  - Estilos Material 3 Expressive en `quick-look-markdown.css` para tablas (`.md-table`, `.md-table-wrapper`, scroll horizontal, bordes tonales, encabezado elevado, hover sutil).
  - Reducción del ancho ergonómico de documentos en `src-tauri/src/features/quick_look/service.rs` y `quick_look.rs` de 70% a 60% (`screen_w * 0.60`), conservando la altura intacta al 80%.
  - Ajuste del contenedor `.markdown-rendered-content` para ceñirse elegantemente al ancho de la ventana sin bandas vacías a los costados.
- No incluye:
  - Modificaciones a los tipos multimedia de Audio, Video o Imagen en QuickLook (sus dimensiones especializadas se mantienen).
  - Dependencias externas pesadas de npm.

## Enfoque

1. Crear el parser de tablas y mejoras inline en `QuickLookMarkdown.tsx`.
2. Añadir reglas CSS de alta fidelidad para tablas y contenedor Markdown en `quick-look-markdown.css`.
3. Ajustar la dimensión base de ancho para documentos en `resolve_media_size` dentro de `src-tauri/src/features/quick_look/service.rs` y en `quick_look.rs`.
4. Validar compilación (`bun run check`, `bun run build:web`, `cargo test`).
5. Verificar visualmente y documentar en `VALIDATION.md` y `APPROVAL.md`.

## Criterios de finalización

- [x] Las tablas de Markdown (como las de `Aurora---Blog/README.md`) se renderizan como tablas HTML semánticas completas con encabezado, alineaciones y celdas legibles.
- [x] Enlaces con código anidado (ej. `[`frontend/package.json`](...)`) se renderizan como enlaces funcionales con estilo de código dentro.
- [x] La anchura de la ventana en modo documento se reduce del 70% al 60% de la pantalla sin alterar la altura (80%).
- [x] El contenido de Markdown se ajusta armónicamente sin dejar grandes espacios en blanco a los laterales.
- [x] `bun run check` y el build de TypeScript se ejecutan sin errores.

## Autorización

- [x] Plan aprobado para ejecución.
