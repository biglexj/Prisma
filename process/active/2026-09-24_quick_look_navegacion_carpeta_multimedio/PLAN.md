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
- No incluye:
  - Cambios en el comportamiento de la ventana principal de Prisma al abrir archivos desde fuera (se mantiene el filtrado por tipo en la biblioteca principal según indicación expresa).

## Enfoque

1. Implementar en `src-tauri/src/features/quick_look/service.rs` la función de resolución de carpeta `resolve_folder_selection` que escanea los archivos compatibles en el directorio padre, los ordena naturalmente con `compare_naturally` y calcula el índice y total.
2. Integrar `resolve_folder_selection` en `show_current_selection`, `show_file_path` y `handle_selection_update` cuando la selección activa no sea múltiple.
3. Incorporar `modifiedMillis` en `QuickLookPayload` en Rust y TypeScript, y configurar cache-busting dinámico en `QuickLookImage` y visores asociados para que cualquier reemplazo o guardado externo refresque la imagen al vuelo.
4. Actualizar `QuickLookWindow.tsx` para interceptar las teclas de dirección (`ArrowLeft`, `ArrowRight`, `PageUp`, `PageDown`) y disparar `quickLookClient.stepSelection`.
5. Añadir controles flotantes laterales de navegación (`<` y `>`) en `QuickLookWindow` que se muestren en hover para facilitar el avance/retroceso tanto en ventana como en pantalla completa.
6. Verificar compilación de Rust y Frontend, y comprobar la transición fluida multiformato y la recarga de imágenes reemplazadas.

## Criterios de finalización

- [ ] Abrir un archivo en Quick Look carga el conteo total de archivos compatibles de su carpeta.
- [ ] La barra superior muestra el paginador `< X / Total >` y permite avanzar/retroceder.
- [ ] Los atajos de teclado (`ArrowLeft` y `ArrowRight`) avanzan y retroceden entre archivos compatibles de la carpeta.
- [ ] Los botones flotantes laterales permiten avanzar y retroceder con un clic.
- [ ] Al maximizar/expandir la ventana de Quick Look a pantalla completa, la navegación funciona sin interrupciones ni desvinculaciones.
- [ ] Al sobrescribir o reemplazar un archivo abierto en Quick Look desde una app externa (ej. Affinity), Quick Look muestra inmediatamente la versión nueva y no la versión previa en caché.

## Autorización

- [ ] Plan aprobado para ejecución.
