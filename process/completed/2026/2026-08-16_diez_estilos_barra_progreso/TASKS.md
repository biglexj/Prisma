# Tareas: Suite de 10 Estilos de Barra de Progreso

- [x] **Fase 1: Tipos y Configuración del Sistema**
  - [x] Extender `ProgressBarStyle` en `src/app/useSystemSettings.ts` con los 10 estilos.
  - [x] Actualizar catálogo y previsualizaciones en `src/app/ui/AppSettings.tsx`.
  - [x] Añadir estilos CSS de previsualización en `src/app/ui/app-settings.css`.

- [x] **Fase 2: Motor Matemático de Renderizado en Canvas**
  - [x] Crear `src/shared/ui/progressRenderers.ts` con los 8 nuevos renderers + wavy/classic.
  - [x] Implementar física de partículas, oscilador elástico y modulación de audio.

- [x] **Fase 3: Integración en `MediaProgressBar.tsx`**
  - [x] Conectar el despachador de renderizado con el bucle desacoplado a 60/120 FPS.
  - [x] Añadir detección de velocidad de arrastre y eventos hover para efectos interactivos.

- [x] **Fase 4: Validación y Verificación**
  - [x] Comprobar `npx tsc --noEmit` y `npm run build`.
  - [x] Probar la selección de los 10 estilos en Ajustes y reproductores.
