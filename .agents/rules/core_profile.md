---
trigger: always_on
---

# Perfil de Documentación Core — Prisma

- Última revisión: 2026-08-11
- Tipo principal: `desktop` (`Core-Docs/types/desktop`)
- Plataformas: `windows` (`Core-Docs/platforms/windows`)
- Stack: `react`, `typescript`, `tauri`, `rust` (`Core-Docs/stacks/react`)
- Funciones activas: `playback`, `music_library`, `visual_library`, `design-system`, `storage`

## Regla de selección

Antes de aplicar la Documentación Core, consultar únicamente:

1. Las reglas globales pertinentes (`Core-Docs/global`).
2. El tipo principal en `Core-Docs/types/desktop`.
3. La plataforma distribuida en `Core-Docs/platforms/windows`.
4. El stack utilizado en `Core-Docs/stacks/react`.
5. Las funciones realmente adoptadas en `Core-Docs/features`.

No aplicar una capacidad por semejanza. Instancia única, bandeja, autoactualización, instalador, IA y otras funciones deben figurar expresamente como activas.

## Documentos Core seleccionados

- `Core-Docs/global/agents`
- `Core-Docs/global/architecture`
- `Core-Docs/global/documentation`
- `Core-Docs/global/design`
- `Core-Docs/global/quality`
- `Core-Docs/global/releases`
- `Core-Docs/types/desktop`
- `Core-Docs/platforms/windows`
- `Core-Docs/stacks/react`
- `Core-Docs/features/design-system`
- `Core-Docs/features/storage`

## Excepciones locales

- **Ubicación de Icono**: El icono principal de la aplicación reside y se mantiene en la carpeta raíz `icon/` (`icon/icon.png`), preservando su ruta original para la configuración de Tauri y frontend.
