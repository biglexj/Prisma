# Tareas: Ajuste de Distribución y Barras Flotantes (Sticky)

- [x] **Fase 1: Ajuste de Layout Base y Espaciado Global**
  - [x] Modificar `.studio-content` en `src/app/styles.css` eliminando `padding-top` fijo del scroll container.
  - [x] Añadir `padding-top` proporcional a los encabezados de todas las vistas (`.visual-library-heading`, `.music-library-heading`, `.preview-heading`, `.home-dashboard`, `.collections-view`, `.library-sources`, `.app-settings-page`).

- [x] **Fase 2: Ajuste de Barras de Control Sticky**
  - [x] Actualizar `.visual-controls-bar` en `src/features/visual_library/ui/visual-library.css` (ancho completo, `top: 0`, `z-index: 20`, padding horizontal compensado, sin redondeo flotante desconectado).
  - [x] Actualizar `.music-controls-bar` en `src/features/music_library/ui/music-library.css` (mismo patrón consistente).

- [x] **Fase 3: Barra Lateral y Detalles Contextuales**
  - [x] Ajustar placeholder e icono de búsqueda en `src/app/ui/AppSidebar.tsx` para consistencia contextual transversal.

- [x] **Fase 4: Verificación y Validación**
  - [x] Verificar comportamiento en reposo (scroll = 0) y comportamiento flotante (scroll > 0) en Música, Imágenes y Vídeos.
  - [x] Comprobar compilación TypeScript y ausencia de regresiones (`tsc --noEmit` y `vite build` exitosos).
