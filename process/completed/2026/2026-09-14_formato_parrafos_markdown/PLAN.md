# Proceso: Distinción de Saltos de Línea y Párrafos en QuickLook Markdown

- Proceso: `2026-09-14_formato_parrafos_markdown`
- Fecha: `2026-09-14`
- Solicitante: `biglexj`
- Estado: `IN_PROGRESS`

## Diagnóstico Científico del Problema

1. **Colapso de Párrafos y Falta de Distinción de Saltos**:
   - `QuickLookMarkdown.tsx` convertía cada línea individual en un elemento `<p className="md-paragraph">` independiente.
   - Las líneas vacías (`!trimmed`) se descartaban con `continue;` sin generar separación ni efecto en el DOM.
   - Como resultado, el espacio entre líneas consecutivas de una misma estrofa (salto simple `\n`) era exactamente igual al espacio entre estrofas separadas por una línea en blanco (`\n\n`), dando la apariencia de "un solo párrafo" sin separación visual.

## Objetivos de la Solución

1. **Agrupación Canónica de Párrafos (GFM / CommonMark)**:
   - Acumular líneas consecutivas dentro de un buffer de párrafo (`currentParagraphLines`).
   - Emitir las líneas de una misma estrofa dentro de un único contenedor `<p className="md-paragraph">` separadas por `<br />` y con interlineado compacto.
   - Utilizar las líneas en blanco como delimitador canónico de fin de párrafo (`flushParagraph`), produciendo un margen inferior distintivo (`18px`) entre estrofas o párrafos.
   - Soportar múltiples líneas en blanco consecutivas mediante espaciadores dedicados (`.md-empty-line`).
2. **Citas y Bloques de Texto Estructurados**:
   - Respetar saltos y párrafos internos en citas (`blockquote`) y alertas.
3. **Estilos Material 3 Expressive**:
   - Ajustar `quick-look-markdown.css` para un espaciado nítido y legible.
