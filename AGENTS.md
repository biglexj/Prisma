# Contexto de arquitectura para agentes

## Fuente de verdad

Antes de modificar la estructura del proyecto, leer:

- `docs/architecture/folder-structure.md`
- `docs/architecture/phase-1-feasibility.md`
- `docs/architecture/phase-2-core-session.md`
- `docs/architecture/phase-3-music-folders.md`
- `docs/architecture/phase-4-visual-folders.md`

## Reglas obligatorias

- Organizar por features del producto, no por tipos técnicos globales.
- Feature expresa comportamiento de Prisma; infrastructure aporta mecanismos reemplazables.
- `shared` no puede utilizarse como carpeta de descarte.
- No crear carpetas para features que todavía no existen.
- Mantener los archivos por debajo de 1000 líneas siempre que exista una separación coherente.
- Tratar 1200 líneas como máximo excepcional y documentado.
- Preservar un único coordinador de reproducción compartido por todas las ventanas.
- No introducir SQLite, biblioteca, letras ni metadata durante la Fase 1.
- Mantener Imágenes y Vídeos en `visual_library`; no incorporar sus reglas dentro de `music_library`.
- Las fuentes de música persisten solo rutas y conteos en JSON; no crean todavía un índice multimedia.
- Las carátulas se leen bajo demanda y no se persisten ni se escanean anticipadamente.
- Las vistas previas visuales se leen bajo demanda, con límites estrictos de memoria, y nunca se persisten.
- No convertir vídeos completos a base64 ni precargarlos en el WebView.

## Estado actual

Prisma mantiene pendiente la validación del renderizado nativo de vídeo de la Fase 1, cuenta con el núcleo de sesiones de la Fase 2, fuentes musicales de la Fase 3 y una base funcional de fuentes visuales de la Fase 4. Música, Imágenes y Vídeos comparten navegación e Inicio, pero conservan módulos y persistencia responsables. La interfaz sigue en evolución y no representa todavía el diseño final del producto.
