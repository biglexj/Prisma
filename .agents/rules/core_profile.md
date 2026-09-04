---
trigger: always_on
---

# Perfil de Documentación Core — Prisma

- Última revisión: 2026-08-11
- Tipo principal: `desktop` (`Docs/types/desktop`)
- Plataformas: `windows` (`Docs/platforms/windows`)
- Stack: `react`, `typescript`, `tauri`, `rust` (`Docs/stacks/react`)
- Funciones activas: `playback`, `music_library`, `visual_library`, `design-system`, `storage`, `single-instance`, `aurora-synapse`

## Regla de selección

Antes de aplicar la Documentación Core, consultar únicamente:

1. Las reglas globales pertinentes (`Docs/global`).
2. El tipo principal en `Docs/types/desktop`.
3. La plataforma distribuida en `Docs/platforms/windows`.
4. El stack utilizado en `Docs/stacks/react`.
5. Las funciones realmente adoptadas en `Docs/features`.

No aplicar una capacidad por semejanza. Instancia única, bandeja, autoactualización, instalador, IA y otras funciones deben figurar expresamente como activas.

## Documentos Core seleccionados

- `Docs/global/agents`
- `Docs/global/architecture`
- `Docs/global/documentation`
- `Docs/global/design`
- `Docs/global/quality`
- `Docs/global/releases`
- `Docs/types/desktop`
- `Docs/platforms/windows`
- `Docs/stacks/react`
- `Docs/features/design-system`
- `Docs/features/storage`
- `Docs/features/aurora-synapse`

## Excepciones locales

- **Ubicación de Icono**: El icono principal de la aplicación reside y se mantiene en la carpeta raíz `icon/` (`icon/icon.png`), preservando su ruta original para la configuración de Tauri y frontend.
