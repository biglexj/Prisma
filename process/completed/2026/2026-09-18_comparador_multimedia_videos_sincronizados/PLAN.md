# Comparador Multimedia (Fotos y Vídeos Sincronizados) — Plan

- Estado: `DRAFT`
- Fecha: `2026-09-18`
- Proyecto: `Prisma`

## Objetivo

Evolucionar el Comparador Multimedia para soportar comparación simultánea de vídeos con reproducción sincronizada (Play/Pause, barra de tiempo/scrubber) y gestión inteligente de audio (audio enfocado en el vídeo bajo el cursor hover o seleccionado inicialmente, silenciando el opuesto para evitar cacofonía), extendiendo además la acción "Comparar" en el Buscador de Duplicados para vídeos.

## Alcance

- Incluye:
  - Extensión del modelo de tipos de `comparison` para reconocer y admitir formatos de vídeo (`mp4`, `webm`, `mkv`, `mov`, `avi`, `wmv`, `flv`, `m4v`).
  - Capacidad en `ImageComparisonSelector` y `ImageComparisonEmptySlot` para explorar, arrastrar y seleccionar tanto imágenes como vídeos.
  - Reproducción dual simultánea y sincronizada en el comparador (Play/Pause global, scrub temporal y sincronización de estado).
  - Manejo inteligente de audio: cuando el ratón se posa (`hover`) sobre un vídeo, se activa su sonido y se silencia el otro; si sale del área, mantiene el sonido del vídeo enfocado/reproducido inicialmente con indicador visual de altavoz 🔊 / 🔇 en el badge del slot.
  - Habilitación del botón "Comparar" en `DuplicateGroupCard` para grupos de duplicados de tipo `video` (`activeKind === "video"`).
  - Preservación estricta de límites de longitud (< 1,200 líneas) mediante extracción del reproductor/renderizador a subcomponentes modulares (`ComparisonMediaLayer.tsx` y barra de control de vídeo).
- No incluye:
  - Edición o recorte de vídeo (pertenece a herramientas de exportación/conversión).
  - Escaneo de duplicados por audio acústico (se mantiene el flujo actual de duplicados de vídeo).

## Enfoque

1. **Modelo y Detección Multimedia**: Extender `types.ts` en `src/features/comparison/model/` para tipar soporte de vídeo (`isVideoPath`, `isSupportedMediaPath`) y actualizar `App.tsx` para proporcionar tanto imágenes como vídeos al comparador embebido.
2. **Subcomponente de Capa Multimedia (`ComparisonMediaLayer.tsx`)**: Desacoplar el renderizado del slot (imagen o vídeo HTML5 con `toSafeAssetUrl`) manteniendo el soporte de zoom/pan y gestionando las referencias `<video>` para sincronización de tiempo y estado `muted`.
3. **Barra de Control Sincronizada**: Añadir una barra de transporte inferior/flotante cuando haya al menos un vídeo en comparación (Play/Pause dual, Scrubber de línea de tiempo con `currentTime` / `duration`, control de velocidad y estado de sincronía).
4. **Enrutamiento Inteligente de Audio (Hover Audio Focus)**: Listener de `pointerenter` / `pointerleave` en cada ranura de vídeo para alternar `video.muted = false` en el slot enfocado y `true` en los demás, mostrando feedback visual en la pastilla superior.
5. **Integración con Duplicados**: Habilitar el botón "Comparar" en `DuplicateGroupCard.tsx` para `activeKind === "video"`.

## Criterios de finalización

- [ ] Las ranuras del comparador cargan y reproducen vídeos locales con fluidez.
- [ ] La reproducción y pausa funcionan de forma sincronizada entre ambos vídeos.
- [ ] El audio conmuta elegantemente al pasar el cursor sobre uno u otro vídeo sin generar doble sonido.
- [ ] El Buscador de Duplicados permite comparar vídeos duplicados frente a frente con el botón "Comparar".
- [ ] Compilación limpia con `bun run build` (0 errores) y archivos estrictamente bajo el límite de 1,200 líneas.

## Autorización

- [ ] Plan aprobado para ejecución.
