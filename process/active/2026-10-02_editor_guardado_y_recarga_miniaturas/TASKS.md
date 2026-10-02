# Feedback de Guardado en Editor e Invalidación de Miniaturas — Tareas

- Estado: `COMPLETED`

## Ejecución

- [x] T01 — Implementar estado y animación visual de carga al guardar en `SaveImageDialog.tsx` e `ImageEditor.tsx` (ceder ciclo de pintado antes del renderizado pesado de canvas).
- [x] T02 — Asegurar el flujo de cierre del editor y transición a la vista previa del archivo guardado tanto para sobrescritura como nueva copia.
- [x] T03 — Crear sistema de invalidación de caché reactivo en `VisualThumbnail.tsx` (`invalidateImagePreview`) y `VideoThumbnail.tsx` (`invalidateVideoThumbnail`).
- [x] T04 — Conectar la invalidación en el guardado de `ImageEditor`, `ImageViewer` y en el botón "Recargar" de `VisualLibrary.tsx`.
- [x] T05 — Ajustar `VisualCard` en `VisualLibrary.tsx` para reiniciar `dimensions` ante cambios en `modifiedAtMillis`, recalculando la clase bento (horizontal/vertical/cuadrado) automáticamente.
- [x] T06 — Añadir soporte de revisión de caché en `ImageViewer.tsx` para forzar la recarga del recurso tras sobreescrituras en WebView2.
- [x] T07 — Verificar la compilación del proyecto (`bun run build` / `tsc`).
- [x] T08 — Desacoplar el cierre del editor del escaneo de carpetas en background (evitando que el editor quede visible 2-3s tras guardar) y desplegar overlay de guardado central en el lienzo.
- [x] T09 — Preparar la validación y evidencias en `VALIDATION.md`.
