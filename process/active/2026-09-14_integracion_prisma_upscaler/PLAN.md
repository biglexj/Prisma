# Proceso: Integración de Prisma Upscaler en el Ecosistema Aurora y Suite de Herramientas — Plan

- Estado: `PLANNING`
- Fecha: `2026-09-14`
- Proyecto: `Prisma`
- Propietario: `biglexj`

## Objetivo

Integrar **Prisma Upscaler** (suite de super-resolución neuronal de imágenes por GPU) en Prisma como herramienta oficial de la suite y aplicación vinculada en el Ecosistema Aurora (Synapse), habilitando su acceso desde la barra lateral, el panel de herramientas, la configuración de Synapse y la apertura contextual desde el visor de imágenes.

## Alcance

- Incluye:
  1. **Iconografía oficial**: Sincronización de los iconos de Prisma Upscaler desde `assets/icons/prisma-upscaler/` a `public/icons/prisma-upscaler/`.
  2. **Comando nativo Tauri (Rust)**: Implementación de `launch_prisma_upscaler(filePath: Option<String>)` con detección de ejecutables locales, paquetes instalados y rutas del repositorio en desarrollo (`d:\Proyectos\biglexj\prisma-upscaler`).
  3. **Ecosistema Aurora Synapse**: Registro de Prisma Upscaler en `ECOSYSTEM_APPS` de `SynapseSettingsPanel.tsx` con soporte de apertura en 1 clic y enlace oficial a Releases.
  4. **Panel de Herramientas (`ToolsSettingsPanel.tsx`) y Ajustes (`useSystemSettings.ts`)**: Adición de `prisma_upscaler` a `ToolKey` con interruptor para habilitar/deshabilitar de la barra lateral.
  5. **Navegación y Barra Lateral (`AppSidebar.tsx` y `App.tsx`)**: Integración de la vista `prisma_upscaler` bajo la categoría de Herramientas con icono representativo (`sparkles`).
  6. **Vista de Herramienta (`PrismaUpscalerView.tsx`)**: Pantalla nativa Material 3 Expressive que ofrece lanzador rápido con selección de imágenes, configuración de modelos (`realesrgan-x4plus`, `anime`, etc.), factor de escala (`2x`, `4x`), health-check del daemon Axum (`http://localhost:8085`) y tarjetas del ecosistema.
  7. **Acceso contextual en Visor de Fotos**: Opción en `ViewerToolsMenu.tsx` / `ImageViewer.tsx` para enviar la imagen actualmente abierta directamente a Prisma Upscaler.
- No incluye:
  - Reimplementar los pesos o el motor NCNN Vulkan dentro del binario de Prisma (la inferencia reside en `prisma-upscaler`).

## Enfoque

1. Sincronizar iconos en `public/icons/prisma-upscaler/`.
2. Implementar y registrar el comando `launch_prisma_upscaler` en Rust (`synapse.rs` y `lib.rs`).
3. Registrar la aplicación en `SynapseSettingsPanel.tsx` y `useSystemSettings.ts`.
4. Construir la vista `PrismaUpscalerView.tsx` y sus estilos `prisma-upscaler.css`.
5. Conectar la vista en `AppSidebar.tsx`, `App.tsx` y `ToolsSettingsPanel.tsx`.
6. Enlazar la acción en el menú contextual del visor de imágenes `ViewerToolsMenu.tsx`.
7. Validar compilación (`bun run build`) y verificar enlaces y lanzadores.

## Criterios de finalización

- [ ] Iconos disponibles en `public/icons/prisma-upscaler/icon.webp`.
- [ ] Comando `launch_prisma_upscaler` operativo y registrado en Tauri.
- [ ] Tarjeta de Prisma Upscaler visible y funcional en `SynapseSettingsPanel.tsx`.
- [ ] Herramienta operable en `ToolsSettingsPanel.tsx` con persistencia en ajustes.
- [ ] Vista `PrismaUpscalerView` accesible desde la barra lateral cuando está activa.
- [ ] Lanzamiento de imagen seleccionada hacia Prisma Upscaler funcional.
- [ ] Acceso directo desde el menú de herramientas de `ImageViewer`.
- [ ] Compilación TypeScript y Vite sin advertencias ni errores.

## Autorización

- [ ] Plan aprobado para ejecución por Biglex.
