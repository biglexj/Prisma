# Tareas: Suite de Comparativa de Imágenes, Modo Desarrollo, Bento Grid y Optimización de Progreso

- [x] **Fase 1: Backend Nativo, Cierre Seguro y Permisos Tauri**
  - [x] Añadir permisos de ventana en `src-tauri/capabilities/default.json`.
  - [x] Implementar comando `quick_look_close_window` en `src-tauri/src/app/commands/quick_look.rs`.
  - [x] Registrar comando en `src-tauri/src/lib.rs`.

- [x] **Fase 2: Robustez de Cierre en QuickLook y Ventanas Desacopladas**
  - [x] Actualizar cliente en `src/features/quick_look/tauri/client.ts`.
  - [x] Actualizar manejo de cierre en `src/features/quick_look/ui/QuickLookWindow.tsx` evitando pantalla vacía.
  - [x] Mejorar cabecera en `src/features/quick_look/ui/QuickLookHeader.tsx` con botón de desacople.

- [x] **Fase 3: Modo Desarrollo Aislado y Concurrencia de Instancias**
  - [x] Bypass de bloqueo single-instance para builds debug / flags `--dev` / `--multi-instance` / `PRISMA_DEV=1`.
  - [x] Aislamiento de perfil de datos local (`dev_profile/`) y título distintivo `"Prisma (Dev)"`.

- [x] **Fase 4: Suite de Comparativa de Imágenes Multimodal**
  - [x] Añadir iconos de comparativa en `src/shared/ui/Icon.tsx`.
  - [x] Crear selector de imágenes `ImageComparisonSelector.tsx` en `src/features/visual_library/ui/comparison/`.
  - [x] Crear modal `ImageComparisonModal.tsx` con 4 modos (Cortina Deslizante, Lado a lado, Alternancia Rápida, Diferencia/Relieve) y zoom sincronizado 500%.
  - [x] Crear estilos `image-comparison.css`.
  - [x] Integrar botón de Comparativa en `ImageViewer.tsx` (atajo `C`) y QuickLook.

- [x] **Fase 5: Bento Grid Adaptativo y Suite Musical Aurora Online**
  - [x] Layout Bento Grid de 12 columnas denso (`grid-auto-flow: dense`) para Wallpapers 4K en `wallpapers.css` y `WallpapersView.tsx`.
  - [x] Panel interactivo de prueba de servidor con ping/latencia y chips de acceso rápido en `AppSettings.tsx`.
  - [x] Interruptor M3 Expressive para activar/desactivar catálogo de Wallpapers.
  - [x] Suite Musical Aurora dividida en 3 vertientes: Explorar Música (Audio HD), Instrumentales (Off-Vocal) y Karaokes (LRC / Sing).

- [x] **Fase 6: Estabilización de Barras de Progreso y Eliminación de Parpadeos**
  - [x] Migración del bucle canvas a `ResizeObserver` en `MediaProgressBar.tsx` (cero layout thrashing).
  - [x] Eliminación de colapsos de altura y rebote de hover en `quick-look.css`, `video-player.css` y `styles.css`.
  - [x] Inmutabilidad de altura a 28px en el área de interacción.

- [x] **Fase 7: Verificación y Compilación**
  - [x] Compilación frontend con `bun run build` exitosa (0 errores).
  - [x] Verificación de inmutabilidad y versionado limpio.
