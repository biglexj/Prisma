# Separar Quick Look y Doble Clic en Prisma — Plan

- Estado: `IN_PROGRESS`
- Fecha: `2026-09-24`
- Proyecto: `Prisma`

## Objetivo

Eliminar la colisión entre el reproductor de Quick Look y Prisma, garantizando que el doble clic en el explorador de archivos (o cualquier apertura de archivo por CLI/single-instance) abra y reproduzca directamente en la ventana principal de Prisma —reemplazando cualquier vídeo o medio en reproducción activa—, y reservando Quick Look de manera exclusiva para la pulsación de la tecla Espacio (o su atajo configurado).

## Alcance

- Incluye:
  - Backend Rust (`src-tauri/src/lib.rs`): Desacoplar `QuickLookState::show_file_path` de la recepción de argumentos de archivo en `tauri_plugin_single_instance` y en el arranque en frío (`setup`).
  - Ocultar limpiamente la ventana de Quick Look (`quick_look.hide()`) si estuviera abierta al momento de recibir un archivo por doble clic en la instancia única.
  - Asegurar que la ventana principal de Prisma (`main`) se restaure (`unminimize`), se muestre (`show`), reciba foco (`set_focus`) y reciba el evento `prisma://open-media`.
  - Frontend (`src/app/App.tsx`, `VideoPlayer.tsx`): Garantizar que cuando un vídeo está reproduciéndose en pantalla y llega un nuevo archivo de vídeo, este reemplace de inmediato al vídeo anterior, cancelando pausas residuales de Quick Look, reseteando la posición a cero o al tiempo inicial y comenzando la reproducción fluida sin colisiones.
  - Compatibilidad: Si se pasa explícitamente el flag `--quicklook` por CLI (`prisma.exe --quicklook <archivo>`), permitir que Quick Look atienda la petición si así se requiere en scripts específicos.
- No incluye:
  - Cambiar los atajos de teclado configurables dentro de Quick Look (Espacio, Alt+Espacio, Shift+Espacio).
  - Modificar el sistema de miniaturas o caché de Quick Look.

## Enfoque

1. En `src-tauri/src/lib.rs`:
   - En el arranque en frío (`run`): eliminar la condición `is_media_initial_file` que ocultaba `main` y abría Quick Look. Ahora todo archivo inicial (`initial_file`) va directamente a `initial_file_for_main` para ser consumido por la ventana principal, y `main_window` se muestra con normalidad.
   - En `tauri_plugin_single_instance`: si el argumento es un archivo existente, verificar si `--quicklook` fue provisto explícitamente. Si no tiene `--quicklook`, cerrar Quick Look si estaba activo (`quick_look.hide()`), restaurar/enfocar la ventana `main` y emitir `prisma://open-media` con la ruta del archivo.
2. En `src/app/App.tsx` y `src/features/visual_library/ui/VideoPlayer.tsx`:
   - En `VideoPlayer.tsx`: al cambiar `path`, reiniciar el estado `paused` a `false`, forzar la reproducción inmediata del nuevo vídeo en `onLoadedMetadata` sin depender del booleano previo de pausa, y asegurar el selector CSS exacto (`video.video-stage-surface, video`).
   - En `App.tsx`: en `playVideoItem`, si la ruta recibida coincide con la ruta activa actual (`activeVideoPath === path`), reiniciar el tiempo a 0 / `initialTime` y asegurar que el elemento de vídeo reanude la reproducción de inmediato.
3. Validación exhaustiva:
   - Compilación con `cargo check` y chequeo de tipos con `bun run check`.
   - Verificación de comportamiento sin colisiones.

## Criterios de finalización

- [ ] Doble clic en explorador abre el archivo directamente en Prisma en ventana principal.
- [ ] Si un vídeo ya se está reproduciendo en Prisma, el doble clic reemplaza el vídeo en reproducción activa de forma fluida.
- [ ] Quick Look solo se activa al pulsar la tecla Espacio en el explorador de Windows.
- [ ] `cargo check` y `bun run check` limpios sin errores ni advertencias regresivas.

## Autorización

- [x] Plan aprobado para ejecución.
