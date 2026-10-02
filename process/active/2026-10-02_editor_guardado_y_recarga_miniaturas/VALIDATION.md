# Feedback de Guardado en Editor e Invalidación de Miniaturas — Validación

- Estado: `VERIFIED`

## Comprobaciones

- [x] V01 — Compilación limpia de TypeScript y empaquetado frontend (`bun run build` ejecutado exitosamente con 0 errores de tipo).
- [x] V02 — Al hacer clic en "Guardar" / "Sobrescribir", `SaveImageDialog` y el botón del editor muestran de inmediato animación de carga (`spinning-icon`), banner de progreso y bloquean nuevas interacciones durante el procesamiento.
- [x] V03 — Al culminar el guardado, el editor se cierra y se presenta de inmediato la imagen guardada en la vista previa cinematográfica (`ImageViewer`), respetando tanto copia nueva como sobreescritura.
- [x] V04 — Al sobrescribir una imagen con una nueva relación de aspecto (ej. recorte 9:16 o 3:4), `VisualThumbnail` invalida la caché en memoria, re-solicita la miniatura actualizada a Rust y `VisualCard` reinicia `dimensions`, adaptando automáticamente su clase bento de horizontal a vertical.
- [x] V05 — Al pulsar el botón "Recargar" del catálogo, `invalidateImagePreview()` e `invalidateVideoThumbnail()` purgan la memoria y re-escanean el disco, asegurando miniaturas 100% sincronizadas.

