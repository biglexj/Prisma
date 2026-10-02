# Feedback de Guardado en Editor e Invalidación de Miniaturas — Plan

- Estado: `EN CURSO`
- Fecha: `2026-10-02`
- Proyecto: `Prisma`
- Autorización: Petición directa de Biglex (audio/captura 2026-10-02).

## Objetivo

Implementar retroalimentación visual clara (animación/spinner y estado de guardado) durante el procesamiento y guardado en el editor de imágenes, y corregir la sincronización e invalidación de caché de miniaturas y dimensiones en el catálogo/galería para que cualquier edición sobrescrita o guardada (así como la recarga manual) actualice inmediatamente las tarjetas bento y la vista previa sin mostrar miniaturas desactualizadas.

## Alcance

- Incluye:
  1. **Animación y estado de guardado en el editor**:
     - Spinner Material 3 Expressive y estado activo ("Guardando cambios...") en el botón y diálogo `SaveImageDialog`.
     - Overlay de guardado visual en `ImageEditor` para que el usuario perciba inmediatamente que el procesamiento está en marcha.
     - Ceder tiempo al ciclo de eventos (`requestAnimationFrame` / `setTimeout`) antes del procesamiento pesado del canvas de alta resolución y codificación base64, garantizando que el navegador pinte la animación de carga antes de que comience el trabajo intensivo.
     - Cerrar el editor al culminar y abrir/enfocar la vista previa del archivo guardado (tanto en nueva copia como en sobrescritura).
  2. **Invalidación de caché de miniaturas e higiene de dimensiones**:
     - Sistema de invalidación de caché en `VisualThumbnail.tsx` (`invalidateImagePreview(path?)`) con eventos y limpieza reactiva.
     - Soporte para que `VisualThumbnail` detecte cambios por `modifiedAtMillis` o evento de invalidación.
     - En `VisualCard` (`VisualLibrary.tsx`), resetear el estado local de `dimensions` cuando `item.path` o `item.modifiedAtMillis` cambian, de modo que la tarjeta bento recalcula su aspecto de inmediato (ej. pasar de horizontal 16:9 a vertical 9:16 / 3:4) al recibir la nueva miniatura.
     - En `VisualLibrary.tsx`, hacer que el botón "Recargar" purgue completamente la caché de miniaturas en memoria (`invalidateImagePreview()` e `invalidateVideoThumbnail()`) además de re-escanear desde el disco.
     - En `ImageViewer.tsx`, incorporar control de revisión/timestamp al cargar la imagen (`?v=${revision}`) para prevenir que el WebView2 sirva la imagen antigua desde su caché interna HTTP tras una sobreescritura.
- No incluye:
  - Modificaciones a los filtros o herramientas internas de recorte en sí (la lógica geométrica funciona bien).

## Criterios de finalización

- [ ] Al pulsar "Guardar" / "Sobrescribir" en el editor, se despliega una animación de carga inmediata, evitando la sensación de congelamiento.
- [ ] Al completarse el guardado, el editor se cierra y se abre/actualiza la vista previa con el resultado.
- [ ] La miniatura en el catálogo se actualiza automáticamente con la nueva imagen y adopta la proporción de aspecto correcta (ej. vertical 9:16).
- [ ] El botón "Recargar" del catálogo refresca con certeza las miniaturas desde el disco.
- [ ] Verificación de compilación TypeScript (`bun run build` o `tsc`) sin errores.
