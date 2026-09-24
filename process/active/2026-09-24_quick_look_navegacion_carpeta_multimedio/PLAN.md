# 2026-09-24_quick_look_navegacion_carpeta_multimedio — Plan

- Estado: `DRAFT`
- Fecha: `2026-09-24`
- Proyecto: `Prisma`

## Objetivo

Permitir que Quick Look (especialmente en su vista expandida/pantalla completa o con foco) descubra automáticamente todos los archivos compatibles de la carpeta (imágenes, vídeos, música, texto/código, markdown, pdf, etc.) y permita avanzar o retroceder continuamente entre ellos mediante atajos de teclado y botones de navegación en la interfaz.

## Alcance

- Incluye:
  - Detección y ordenación natural (Explorer style) de todos los archivos soportados en el directorio del archivo abierto cuando no haya una selección múltiple previa en el Explorer.
  - Población de `selectionTotal` y `selectionIndex` en el payload de Quick Look para reflejar la posición del archivo en su carpeta.
  - Navegación secuencial (`step_selection`) que transiciona suavemente entre cualquier tipo de medio (imagen -> vídeo -> audio -> texto -> pdf, etc.).
  - Atajos de teclado en `QuickLookWindow`: `ArrowLeft` / `ArrowRight` (y `ArrowUp` / `ArrowDown` cuando no esté en scroll de texto) para avanzar y retroceder.
  - Indicador de paginación `< X / Y >` en la barra superior siempre activo y botones flotantes laterales en los bordes de la pantalla (hover) para avanzar y retroceder con el ratón.
  - Invalidación de caché y recarga reactiva inmediata cuando un archivo (imagen, vídeo, etc.) es reemplazado o reescrito en disco con el mismo nombre (ej. tras exportar en Affinity Photo/Designer), evitando que Quick Look retenga la versión antigua en memoria.
  - Al abrir un audio en Prisma (desde Quick Look «Abrir en Prisma» o explorador de archivos externo): escanear automáticamente todas las canciones de la carpeta (ignorando imágenes, vídeos y subcarpetas).
  - La cola recibe el nombre de la carpeta (ej. `Music`).
  - La canción abierta pasa a ser la canción número 1 en la cola (`currentIndex = 0`) y las demás pistas de audio le siguen la corriente correlativamente en rotación circular completa.
- No incluye:
  - Alteración en el comportamiento de apertura de vídeos o imágenes (vídeo actúa como vídeo, imagen actúa como imagen).
  - Escaneo de subcarpetas o carpetas padre en la reproducción de audio externa.

## Enfoque

1. Implementar en `src-tauri/src/features/quick_look/service.rs` la función de resolución de carpeta `resolve_folder_selection` que escanea los archivos compatibles en el directorio padre, los ordena naturalmente con `compare_naturally` y calcula el índice y total.
2. Integrar `resolve_folder_selection` en `show_current_selection`, `show_file_path` y `handle_selection_update` cuando la selección activa no sea múltiple.
3. Incorporar `modifiedMillis` en `QuickLookPayload` en Rust y TypeScript, y configurar cache-busting dinámico en `QuickLookImage` y visores asociados para que cualquier reemplazo o guardado externo refresque la imagen al vuelo.
4. Actualizar `QuickLookWindow.tsx` para interceptar las teclas de dirección (`ArrowLeft`, `ArrowRight`, `PageUp`, `PageDown`) y disparar `quickLookClient.stepSelection`.
5. Añadir controles flotantes laterales de navegación (`<` y `>`) en `QuickLookWindow` que se muestren en hover para facilitar el avance/retroceso tanto en ventana como en pantalla completa.
6. Crear comando Tauri `music_library_scan_folder_tracks` en Rust (`src-tauri/src/app/commands/music_library.rs`) para escanear en segundo plano exclusivamente los archivos de audio de la carpeta contenedora, con sus metadatos básicos y ordenación natural.
7. Crear servicio `folderQueueResolver.ts` en `src/features/playback/services/` para resolver la cola con la canción seleccionada en la posición #1 y las restantes siguiéndole en secuencia natural con ciclo completo.
8. Refactorizar `playMusicItem` en `src/app/App.tsx` para consumir el resolver modular, reduciendo la deuda técnica de líneas de `App.tsx` por debajo del límite recomendado.
9. Verificar compilación de Rust (`cargo check`) y Frontend (`bun run build`).

## Criterios de finalización

- [x] Abrir un archivo en Quick Look carga el conteo total de archivos compatibles de su carpeta.
- [x] La barra superior muestra el paginador `< X / Total >` y permite avanzar/retroceder.
- [x] Los atajos de teclado (`ArrowLeft` y `ArrowRight`) avanzan y retroceden entre archivos compatibles de la carpeta.
- [x] Los botones flotantes laterales permiten avanzar y retroceder con un clic.
- [x] Al maximizar/expandir la ventana de Quick Look a pantalla completa, la navegación funciona sin interrupciones ni desvinculaciones.
- [x] Al sobrescribir o reemplazar un archivo abierto en Quick Look desde una app externa (ej. Affinity), Quick Look muestra inmediatamente la versión nueva y no la versión previa en caché.
- [x] Al abrir un archivo de audio externo (en Quick Look «Abrir en Prisma» o explorador de Windows), se detectan todas las canciones de la carpeta (ignorando imágenes/vídeos/subcarpetas).
- [x] La cola se nombra con la carpeta padre y la canción abierta queda como la #1 en la cola, siguiéndole las demás pistas correlativamente en orden natural.
- [x] La compilación en Rust (`cargo check`) y TypeScript/Vite (`bun run build`) finaliza sin errores.

## Autorización

- [x] Plan aprobado para ejecución.

