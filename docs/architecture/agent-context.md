# Contexto de arquitectura para agentes — Prisma

- Ámbito: decisiones y restricciones propias de Prisma que no pertenecen a Core.
- Puente: [`.agents/rules/base.md`](../../.agents/rules/base.md) es la entrada de instrucciones; este documento amplía el bloque de arquitectura.

## Fuente de verdad

Antes de modificar la estructura del proyecto, leer:

- [Estructura modular de Prisma](folder-structure.md)
- [Fase 1 — Viabilidad](phase-1-feasibility.md)
- [Fase 2 — Núcleo de sesión](phase-2-core-session.md)
- [Fase 3 — Fuentes musicales](phase-3-music-folders.md)
- [Fase 4 — Fuentes visuales](phase-4-visual-folders.md)

El código y la configuración vigentes determinan el comportamiento real. Estos documentos registran el contrato previsto; si divergen de la implementación, prevails el código y la divergencia se corrige en el documento.

## Reglas obligatorias

- Organizar por features del producto, no por tipos técnicos globales.
- Una feature expresa comportamiento de Prisma; `infrastructure` aporta mecanismos reemplazables.
- `shared` no puede utilizarse como carpeta de descarte.
- No crear carpetas para features que todavía no existen.
- Límite de tamaño de archivo y convenciones de nomenclatura: [estructura del repositorio](../../.agents/rules/folder_structure.md).
- Preservar un único coordinador de reproducción compartido por todas las ventanas.
- No introducir SQLite, biblioteca, letras ni metadata durante la Fase 1.
- Mantener Imágenes y Vídeos en `visual_library`; no incorporar sus reglas dentro de `music_library`.
- Las fuentes de música persisten solo rutas y conteos en JSON; no crean todavía un índice multimedia.

## Decisiones de medios

- Las carátulas se leen bajo demanda y no se persisten ni se escanean anticipadamente.
- Las vistas previas visuales se leen bajo demanda, con límites estrictos de memoria, y nunca se persisten.
- No convertir vídeos completos a base64 ni precargarlos en el WebView.

## Catálogo de medios de Aurora (wallpapers)

- Consultar el catálogo exclusivamente mediante API versionada (`/api/v1/wallpapers` o `/api/v2/catalog`), validando `isAuthorized !== false` y sin concatenar `object_key` directamente en el cliente.
- Respetar el interruptor `auroraOnlineServicesEnabled` y los permisos de la cuenta iniciada.
- La sincronización de fondos vivos con Aurora es explícita y nunca ocurre durante el build: `bun scripts/sync-aurora-wallpapers.ts` (ver [README del compositor](../../src/features/wallpapers/compositor/README.md)).

## Catálogo compartido del ecosistema

- `src/shared/ecosystem.json` es una **vista generada** del catálogo maestro de Core; no se edita a mano. Se regenera con `D:\Proyectos\biglexj\Scripts\sync-ecosystem.ps1` y se consume desde `src/shared/ecosystemApps.ts`.
- No crear listas manuales paralelas de aplicaciones del ecosistema ni inventar versiones, enlaces o estados: consultar [catálogo compartido](../../../Docs/ecosystem/README.md).

## Estado actual

Prisma mantiene pendiente la validación del renderizado nativo de vídeo de la Fase 1, cuenta con el núcleo de sesiones de la Fase 2, fuentes musicales de la Fase 3 y una base funcional de fuentes visuales de la Fase 4. Música, Imágenes y Vídeos comparten navegación e Inicio, pero conservan módulos y persistencia responsables. La interfaz sigue en evolución y no representa todavía el diseño final del producto.

## Referencias relacionadas

- [Contrato de publicación con Aurora](release-publication.md)
- [Estructura modular de Prisma](folder-structure.md)
- [Especificación de efectos de la barra de progreso](progress-bar-effects-specification.md)
