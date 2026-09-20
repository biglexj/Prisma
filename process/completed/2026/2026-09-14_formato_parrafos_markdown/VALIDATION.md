# Proceso: Distinción de Saltos de Línea y Párrafos en QuickLook Markdown — Validación

- Proceso: `2026-09-14_formato_parrafos_markdown`
- Estado: `PASSED`

## Pruebas Ejecutadas

### 1. Distinción entre Salto Simple y Doble Salto
- **Saltos simples dentro de una estrofa**: Agrupados en el mismo contenedor `<p className="md-paragraph">` con separadores `<span className="md-line">{line}<br /></span>`. Mantiene un flujo continuo y un interlineado unificado sin crear márgenes de bloque entre versos.
- **Dobles saltos de línea (párrafos / estrofas)**: Cada línea vacía invoca `flushAll()`, cerrando el párrafo actual. Los párrafos se renderizan con `margin: 0 0 18px 0`, logrando una separación nítida e inequívoca entre estrofas.
- **Múltiples líneas vacías consecutivas**: Se contabilizan con `consecutiveBlankLines` y, cuando hay más de una línea vacía consecutiva, se inserta un `<div className="md-empty-line" />` (`height: 16px`) para reflejar espaciado vertical adicional.

### 2. Integridad de Bloques, Citas y Listas
- Encabezados (`#`, `##`, etc.), listas (`ul`/`ol`), bloques de código, tablas y alertas vacían automáticamente el acumulador de líneas mediante `flushAll()`.
- En citas (`> `), las líneas vacías internas separan adecuadamente múltiples párrafos dentro del `<blockquote>`.

### 3. Compilación Global
- **Comando**: `bun run build` (`tsc --noEmit && vite build`)
- **Resultado**: Código de salida `0` (exitoso)
- **Tiempo**: `3.37s`
- **Módulos transformados**: 226 módulos sin errores de tipado TypeScript ni fallos de empaquetado.
