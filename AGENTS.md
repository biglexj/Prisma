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

## Publicación de Releases (Prisma → GitHub + Aurora metadata)

Prisma es un proyecto **no privado**. El flujo de release está definido en `scripts/release/build-release.ps1` y se compone de:

1. **Compilar** el instalador Tauri v2 (`.exe` + `.msi`) localmente.
2. **Publicar el binario en GitHub Releases** (`gh release create`). El binario vive exclusivamente en GitHub.
3. **Calcular el SHA-256** del instalador.
4. **Notificar a Aurora** (`PUT /api/admin/developer-apps`) con la URL del asset en GitHub como `downloadUrl`, más `versionName`, `versionCode`, `releaseNotes` y `sha256Checksum`. Aurora solo recibe metadata; **no** se sube el EXE a Cloudflare R2.

`user_id` canónico del ecosistema Aurora: `e7918151-8a32-4413-be32-a35866e2fb4e` (`biglexj`).

Documentación completa de la regla en `Aurora---Blog/docs/es/guides/Protocolo de Actualizaciones y Versionado.md` (sección 6).
- Las carátulas se leen bajo demanda y no se persisten ni se escanean anticipadamente.
- Las vistas previas visuales se leen bajo demanda, con límites estrictos de memoria, y nunca se persisten.
- No convertir vídeos completos a base64 ni precargarlos en el WebView.

## Estado actual

Prisma mantiene pendiente la validación del renderizado nativo de vídeo de la Fase 1, cuenta con el núcleo de sesiones de la Fase 2, fuentes musicales de la Fase 3 y una base funcional de fuentes visuales de la Fase 4. Música, Imágenes y Vídeos comparten navegación e Inicio, pero conservan módulos y persistencia responsables. La interfaz sigue en evolución y no representa todavía el diseño final del producto.
