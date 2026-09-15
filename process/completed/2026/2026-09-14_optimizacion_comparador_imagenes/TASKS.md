# Proceso: Optimización y Corrección del Comparador de Imágenes — Tareas

- Proceso: `2026-09-14_optimizacion_comparador_imagenes`
- Estado: `COMPLETED`

## Tareas

- [x] **Tarea 1 — Optimización del Selector de Comparación (`ImageComparisonSelector.tsx`)**:
  - [x] Implementar agrupación y filtro de carpetas (carpeta de imagen actual por defecto, "Todas las carpetas" y selector/chips).
  - [x] Reemplazar `<img src={toSafeAssetUrl} />` con `<VisualThumbnail />` para miniaturas nativas de alta velocidad y caché LRU.
  - [x] Implementar renderizado progresivo (lote inicial de 60 elementos + scroll infinito/cargar más).
- [x] **Tarea 2 — Sincronización de Slots y Solución al "No actualiza" (`ImageComparisonModal.tsx`)**:
  - [x] Al añadir un nuevo slot en modo `"split"` o `"curtain"`, cambiar automáticamente a modo `"grid"` para que la nueva foto sea visible al instante.
  - [x] Soportar asignación dinámica de `activeSlotAId` y `activeSlotBId` para que las fotos secundarias añadidas puedan alternarse en Lado a lado y Cortinilla.
  - [x] Crear barra flotante de slots (Filmstrip) en la parte inferior para ver todas las fotos en comparativa con badges (A, B, #), reemplazo rápido y botón de eliminar.
- [x] **Tarea 3 — Estilos Material 3 Expressive (`image-comparison.css`)**:
  - [x] Estilizar la barra de carpetas en el selector (`img-compare-folder-tabs`, `img-compare-folder-chip`).
  - [x] Estilizar la tira de slots flotante (`img-compare-filmstrip`, `img-compare-filmstrip-item`).
- [x] **Tarea 4 — Verificación y Validación**:
  - [x] Verificar compilación con `bun run build`.
  - [x] Registrar evidencia en `VALIDATION.md` y solicitar aprobación.
