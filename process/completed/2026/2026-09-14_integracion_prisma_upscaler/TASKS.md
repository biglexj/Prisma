# Proceso: Integración de Prisma Upscaler en el Ecosistema Aurora y Suite de Herramientas — Tareas

- Proceso: `2026-09-14_integracion_prisma_upscaler`
- Estado: `COMPLETED`

## Tareas

- [x] **Tarea 1 — Iconografía**: Copiar activos desde `assets/icons/prisma-upscaler/` a `public/icons/prisma-upscaler/`.
- [x] **Tarea 2 — Backend Nativo (Rust)**:
  - [x] Implementar comando `launch_prisma_upscaler` en `src-tauri/src/app/commands/synapse.rs`.
  - [x] Registrar comando en `src-tauri/src/lib.rs`.
- [x] **Tarea 3 — Configuración y Sinergia Synapse**:
  - [x] Registrar `prisma-upscaler` en `ECOSYSTEM_APPS` en `src/app/ui/SynapseSettingsPanel.tsx`.
  - [x] Registrar `prisma_upscaler` en `useSystemSettings.ts` (`ToolKey`, `defaultSettings`).
- [x] **Tarea 4 — Suite de Herramientas y Navegación**:
  - [x] Agregar definición de herramienta en `src/app/ui/ToolsSettingsPanel.tsx`.
  - [x] Añadir `"prisma_upscaler"` a `AppView` y `TOOL_ENTRIES` en `src/app/ui/AppSidebar.tsx`.
  - [x] Registrar vista en `src/app/App.tsx` (`VIEW_TITLES`, render condicional).
- [x] **Tarea 5 — Vista de Herramienta `PrismaUpscalerView`**:
  - [x] Crear componente `src/features/prisma_upscaler/ui/PrismaUpscalerView.tsx`.
  - [x] Crear hoja de estilos `src/features/prisma_upscaler/ui/prisma-upscaler.css` con estética Material 3 Expressive.
- [x] **Tarea 6 — Integración Contextual en Visor de Fotos**:
  - [x] Agregar opción de *"Escalar con Prisma Upscaler"* en `src/features/visual_library/ui/components/ViewerToolsMenu.tsx` y conectar en `ImageViewer.tsx`.
- [x] **Tarea 7 — Verificación y Compilación**:
  - [x] Validar con `bun run build`.
  - [x] Validar backend Rust con `cargo check`.
  - [x] Documentar evidencia en `VALIDATION.md` y solicitar aprobación final.
