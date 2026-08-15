# Plan de Implementación: Mover a la Papelera de Reciclaje (Imágenes, Vídeos y Música)

## Objetivo
Implementar y perfeccionar de manera integral y elegante la funcionalidad de **Mover a la Papelera de Reciclaje** en todo el ecosistema de Prisma:
1. Dentro del **Visor de Imágenes (`ImageViewer`)** con la tecla Suprimir (`Delete` / `Supr`), menú contextual de clic derecho y botón directo en la barra superior.
2. Dentro del **Reproductor de Vídeo (`VideoPlayer`)** con la tecla Suprimir, menú contextual de clic derecho y botón directo en la barra de herramientas.
3. Respetar estrictamente la **Configuración de Confirmación de Eliminación (`confirmDeletion`)**:
   - Si está **activada** (`true`): Mostrar el modal `ConfirmDialog` antes de mover a la papelera.
   - Si está **desactivada** (`false`): Mover directamente el archivo a la papelera de reciclaje del sistema operativo sin pedir confirmación ni abrir modal.
4. Ajustar la semántica y capas visuales (Z-Index) para que los modales y menús contextuales aparezcan por encima de los visores de cine (z-index > 99999).
5. Sanitización de rutas UNC de Windows en el backend de Rust para `trash::delete`.

## Componentes Afectados
- `src-tauri/src/app/commands/media.rs`: Limpieza y sanitización de rutas para el crate `trash`.
- `src/shared/ui/media-menu.css`: Ajuste de capas Z-Index para `ConfirmDialog` y `ContextMenu` (> 100000).
- `src/features/visual_library/ui/ImageViewer.tsx`: Manejo de tecla Suprimir con dependencias reactivas estables, menú contextual de clic derecho, botón de papelera en barra superior y diálogo de confirmación.
- `src/features/visual_library/ui/VideoPlayer.tsx`: Integración de `useMediaDelete`, atajo tecla Suprimir, menú contextual de clic derecho, botón de papelera en barra superior, salto automático al siguiente vídeo al borrar y diálogo de confirmación.
- `src/app/App.tsx`: Propagación de `confirmDeletion` y `onRefresh` a `VideoPlayer`.
- `src/features/visual_library/ui/VisualLibrary.tsx` y `src/features/music_library/ui/MusicLibrary.tsx`: Textos y coherencia con "Mover a la papelera".

## Criterios de Verificación
1. Pulsar `Supr` o `Delete` en `ImageViewer` abre el modal cuando `confirmDeletion` es `true`.
2. Con `confirmDeletion` en `false`, pulsar `Supr` en `ImageViewer` mueve la imagen a la papelera y pasa a la siguiente foto de inmediato sin modal.
3. Clic derecho en `ImageViewer` abre menú contextual con "Mover a la papelera".
4. Pulsar `Supr` o `Delete` en `VideoPlayer` abre el modal cuando `confirmDeletion` es `true`.
5. Con `confirmDeletion` en `false`, pulsar `Supr` en `VideoPlayer` mueve el vídeo a la papelera y pasa al siguiente vídeo de inmediato sin modal.
6. Clic derecho en `VideoPlayer` abre menú contextual con "Mover a la papelera".
7. Compilación exitosa de frontend (TypeScript / Vite) y backend (Rust / Cargo).
