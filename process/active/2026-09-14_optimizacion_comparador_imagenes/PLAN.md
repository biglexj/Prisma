# Proceso: Optimización y Corrección del Comparador de Imágenes (Rendimiento por Carpetas y Sincronización de Slots)

- Proceso: `2026-09-14_optimizacion_comparador_imagenes`
- Fecha: `2026-09-14`
- Solicitante: `biglexj`
- Estado: `IN_PROGRESS`

## Diagnóstico Científico del Problema

1. **Rendimiento Lento en el Selector de Comparación**:
   - `ImageComparisonSelector.tsx` cargaba todas las imágenes disponibles sin filtro de carpeta (`availableItems`).
   - Usaba `<img src={toSafeAssetUrl(it.path)} loading="lazy" />` cargando archivos crudos a resolución completa (4K/8K) directamente en el DOM en lugar de aprovechar el generador y caché nativo LRU de miniaturas `VisualThumbnail`.
   - Sin paginación/virtualización en el DOM, provocando decodificación masiva de imágenes y congelamiento de WebView2.

2. **Falla de Actualización al Seleccionar/Examinar ("Selecciono, nada. Sigue siendo las mismas fotos")**:
   - Al pulsar "+ Añadir foto" o "Examinar archivo...", se creaba un nuevo slot en `slots` (`slots.length = 3`).
   - Sin embargo, el modo activo era `"split"` (Lado a lado), el cual renderizaba exclusivamente `slots[0]` y `slots[1]`, ignorando por completo el nuevo `slots[2]`.
   - El usuario veía las mismas 2 fotos en pantalla, mientras que al reabrir el selector veía 3 o más fotos marcadas como "En uso", causando la percepción de que la app no actualizaba.

## Objetivos de la Solución

1. **Agrupación y Filtrado por Carpetas en `ImageComparisonSelector`**:
   - Extraer carpetas únicas y seleccionar por defecto la **carpeta de la imagen actual**.
   - Proporcionar barra de filtros/chips de carpetas y opción de "Todas las carpetas".
   - Integrar `VisualThumbnail` para miniaturas nativas ultrarrápidas y caché LRU.
   - Renderizado progresivo por lotes (`visibleLimit = 60` con carga bajo demanda) para fluidez absoluta.

2. **Sincronización Inteligente de Slots en `ImageComparisonModal`**:
   - Al añadir un 3er slot en modo `"split"` o `"curtain"`, cambiar automáticamente a modo `"grid"` (Cuadrícula) para que todas las fotos sean visibles de inmediato.
   - Permitir asignar cualquier slot a A o B de manera dinámica (`activeSlotAId`, `activeSlotBId`).
   - Implementar una barra flotante de slots/tira de comparación (Filmstrip) al pie del visor comparativo que muestre todas las fotos añadidas, sus insignias A/B, botón para cambiar o quitar cada una, y botón de añadir.
