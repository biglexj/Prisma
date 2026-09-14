# Proceso: Distinción de Saltos de Línea y Párrafos en QuickLook Markdown — Tareas

- Proceso: `2026-09-14_formato_parrafos_markdown`
- Estado: `COMPLETED`

## Tareas

- [x] **Tarea 1 — Parser de Párrafos en `QuickLookMarkdown.tsx`**:
  - [x] Implementar buffer `currentParagraphLines` y función `flushParagraph()`.
  - [x] Agrupar líneas consecutivas con saltos `<br />` dentro del mismo `<p>`.
  - [x] Tratar líneas vacías como delimitadores de párrafo con soporte para múltiples líneas vacías consecutivas.
  - [x] Agrupar párrafos en citas (`blockquote`) y alertas.
- [x] **Tarea 2 — Estilos CSS en `quick-look-markdown.css`**:
  - [x] Definir espaciado de párrafos (`margin: 0 0 18px 0`) e interlineado (`line-height: 1.65`).
  - [x] Definir espaciador para líneas vacías explícitas (`.md-empty-line`).
  - [x] Añadir clase `.md-line` con `display: inline`.
- [x] **Tarea 3 — Verificación y Validación**:
  - [x] Compilar con `bun run build`.
  - [x] Documentar evidencia en `VALIDATION.md`.
