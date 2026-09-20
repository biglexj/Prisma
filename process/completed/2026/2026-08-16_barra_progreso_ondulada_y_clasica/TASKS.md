# Tareas del Proceso: Barra de Progreso Ondulada y Clásica

- [x] **Fase 1: Configuración del Sistema (`useSystemSettings` y `AppSettings`)**
  - [x] Añadir `progressBarStyle: "wavy" | "classic"` (default: `"wavy"`) en `src/app/useSystemSettings.ts`.
  - [x] Añadir sincronización de eventos para cambios en tiempo real.
  - [x] Añadir tarjeta/selector interactivo de Barra de Progreso en `src/app/ui/AppSettings.tsx`.
  - [x] Añadir estilos para el selector de barra de progreso en `src/app/ui/app-settings.css`.

- [x] **Fase 2: Componente Reutilizable `MediaProgressBar`**
  - [x] Crear `src/shared/ui/MediaProgressBar.tsx` con soporte para `<canvas>` ondulado y modo clásico.
  - [x] Crear `src/shared/ui/media-progress-bar.css` con variables CSS de Material 3 Expressive.
  - [x] Implementar gestos de arrastre (scrubbing), clic directo, soporte táctil/ratón y accesibilidad de teclado.

- [x] **Fase 3: Integración en Reproductores de Prisma**
  - [x] Integrar en `src/features/playback/ui/components/PlaybackPreview.tsx` (Música).
  - [x] Integrar en `src/features/visual_library/ui/VideoPlayer.tsx` (Vídeos).
  - [x] Integrar en `src/features/quick_look/ui/QuickLookMusic.tsx` (Quick Look Música).
  - [x] Integrar en `src/features/quick_look/ui/QuickLookVideo.tsx` (Quick Look Vídeo).

- [x] **Fase 4: Validación y Cierre**
  - [x] Verificar tipos con `npx tsc --noEmit`.
  - [x] Verificar empaquetado con `npm run build`.
  - [x] Completar `VALIDATION.md` y `APPROVAL.md`.
