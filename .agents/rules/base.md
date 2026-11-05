---
trigger: always_on
---

# Instrucciones del proyecto — Prisma

## Documentación Core — entrada compartida

Consultar primero [Documentación Core](../../../Docs/README.md) y seleccionar solo los módulos pertinentes. Los estándares compartidos se mantienen allí; este archivo conserva el alcance y los contratos específicos del proyecto.

- [Calidad y entrega proporcionales](../../../Docs/global/quality/quality-baseline.md): build para ajustes visuales pequeños; pruebas pertinentes para elementos, lógica o páginas nuevos y cambios grandes; revisión acotada para documentación.
- [Procesos según alcance](../../../Docs/global/documentation/process-workflow.md): no añadir fases, archivos ni nuevas aprobaciones por rutina a ajustes pequeños ya autorizados.
- [Diseño común](../../../Docs/global/design/design_system.md) y [textos de interfaz](../../../Docs/global/design/interface-writing.md): contenido preciso, espacio útil, mínimo scroll innecesario, fondo global y presets compartidos, conservando la identidad del producto.
- [Estilo de comunicación](../../../Docs/global/agents/communication-style.md): registro «Scientific Elegant» en resúmenes y cierres; no aplica a los textos de interfaz ni a la documentación entregable.
- [Reglas de trabajo del agente](../../../Docs/global/documentation/agent-working-rules.md): entrada única, límite de 12.000 caracteres por archivo de reglas y commits de resguardo.
- [Comandos mediante Mise](../../../Docs/global/architecture/mise-command-standard.md) y [scripts y alias](../../../Docs/global/architecture/command-scripts-standard.md): Mise es la interfaz de comandos; los scripts de `package.json` son implementación, no interfaz.
- [Base de lanzamientos](../../../Docs/global/releases/release-baseline.md), [protocolo de lanzamiento](../../../Docs/global/releases/protocolo_lanzamiento_actualizacion.md) y [mensaje de release web](../../../Docs/global/releases/web-release-message-standard.md): versionado, inmutabilidad de lo publicado y notas públicas.
- [Soporte oficial y diálogo «Acerca de»](../../../Docs/features/official-support/official-support-baseline.md): autoría, licencia y enlaces oficiales del ecosistema.
- [Modelos de IA](../../../Docs/features/ai-models/README.md): criterio de selección, migración y validación. Prisma no mantiene un registro local de modelos; su configuración ejecutable es la fuente de verdad.
- [Catálogo compartido del ecosistema](../../../Docs/ecosystem/README.md) y [metadatos multimedia](../../../Docs/features/media/media-metadata-baseline.md): consumidos por API versionada, no por listas manuales.
- [Diagnósticos reutilizables](../../../Docs/troubleshooting/README.md) y [promoción a Core](../../../Docs/global/documentation/core-promotion-workflow.md): documentar en Core los fallos confirmados o aprendizajes generalizables y enlazarlos desde el proyecto; mantener locales los detalles exclusivos.

En estos criterios comunes, aplicar las bases vigentes enlazadas en lugar de copias históricas de este archivo. Respetar la dirección actual de Biglex y los contratos específicos del producto; ante una contradicción, comprobar la implementación vigente y resolverla explícitamente. Las skills generales importadas son apoyo técnico, no una autoridad para redefinir estas reglas.

Entrada única de instrucciones: `.agents/rules/base.md`. No se crean `AGENTS.md` ni `agent.md` equivalentes en la raíz.

## Alcance del proyecto

- Prisma es una aplicación de escritorio **Tauri v2 + React + TypeScript** con un backend Rust (`src-tauri/`) y una interfaz web en `src/`.
- Licencia MIT; autoría `biglexj` (2026).
- Documentación funcional: [`docs/`](../../docs), proceso: [`process/`](../../process).

## Contratos locales

### Arquitectura

- [Contexto de arquitectura para agentes](../../docs/architecture/agent-context.md): reglas de organización por features, límites de tamaño de archivo y decisiones de medios propias de Prisma.
- Fuentes de verdad del árbol: [`docs/architecture/folder-structure.md`](../../docs/architecture/folder-structure.md) y los documentos de fase 1 a 4 enlazados desde el contexto de arquitectura.
- El código y la configuración vigentes determinan el comportamiento real; los documentos de fase registran el contrato previsto y se corrigen cuando divergen.

### Catálogo de medios de Aurora

- Consultar wallpapers exclusivamente mediante API versionada (`/api/v1/wallpapers` o `/api/v2/catalog`), validando `isAuthorized !== false` y sin concatenar `object_key` directamente en el cliente.
- Respetar `auroraOnlineServicesEnabled` y los permisos de la cuenta iniciada. La sincronización de fondos vivos es explícita y nunca ocurre durante el build: `bun scripts/sync-aurora-wallpapers.ts`.

### Release y publicación

- [Contrato de publicación de Prisma](../../docs/architecture/release-publication.md): separación entre `release` (prepara) y `publish` (publica), flujo GitHub → Aurora y `user_id` canónico del ecosistema.
- `mise release` prepara el instalador y los artefactos locales; `mise publish` es la única vía de publicación a GitHub y a Aurora.

### Flujo de trabajo

- Rama de trabajo `preview`; el merge a `main` ocurre solo con la instrucción explícita de lanzar versión, conforme al [protocolo de Core](../../../Docs/global/releases/protocolo_lanzamiento_actualizacion.md).
- El trabajo planificado vive en `process/active/YYYY-MM-DD_objetivo/` con `PLAN.md`, `TASKS.md`, `VALIDATION.md` y `APPROVAL.md`; `ROADMAP.md` conserva los pendientes generales.
- Carpetas de trabajo: `temp/` para borradores y tareas puntuales (ignorada), `scratch/` para utilidades de mantenimiento en la raíz, `test/` para pruebas temporales (ignorada).

## Referencias locales especializadas

- [Contexto de arquitectura](../../docs/architecture/agent-context.md)
- [Contrato de publicación](../../docs/architecture/release-publication.md)
- [Estructura real del repositorio y convenciones de nomenclatura](folder_structure.md)
- [Perfil Core del proyecto](core_profile.md)
