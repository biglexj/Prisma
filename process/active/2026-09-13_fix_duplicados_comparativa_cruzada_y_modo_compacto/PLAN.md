# Plan: Fix Buscador de Duplicados — Comparativa Cruzada Estricta y Modo Compacto

## Contexto & Requerimiento del Usuario
El usuario identificó dos necesidades clave en la herramienta **Buscador y Comparador de Duplicados**:
1. **Modo Compacto de Carpetas Seleccionadas**:
   En el modo *"Comparar 2 Carpetas (Base vs Depurar)"*, las tarjetas actuales de selección de carpetas ocupan demasiado espacio vertical (~130px+), restando visibilidad para inspeccionar los grupos de duplicados encontrados. Cuando ambas carpetas ya han sido seleccionadas, la interfaz debe condensarse a una barra/cápsula compacta (reduciendo la altura a menos de la mitad), manteniendo la posibilidad de cambiar las carpetas, arrastrar/soltar o intercambiar roles (`⇄`).
2. **Comparativa Cruzada Estricta (Base vs Depurar)**:
   Al comparar dos carpetas, los archivos de una carpeta **NO deben compararse consigo misma** (ni entre sus subcarpetas). La comparación debe ser **estrictamente cruzada**: los archivos de la Carpeta a Depurar deben compararse exclusivamente contra los de la Carpeta Base. Si una carpeta tiene duplicados internos entre sí pero no coinciden con la otra carpeta, no deben reportarse como duplicados en este modo. Todo grupo debe tener como original un archivo de la Carpeta Base y como duplicados archivos de la Carpeta a Depurar.

## Alcance Técnico
1. **Backend Rust (`src-tauri/src/features/visual_library/duplicates.rs` y `src-tauri/src/features/music_library/duplicates.rs`)**:
   - Clasificación precisa de rutas mediante `FolderOrigin::Base`, `FolderOrigin::Target` o `FolderOrigin::Neither` manejando subcarpetas y posibles anidamientos.
   - En **Nivel 1 (Hash exacto 100%)**: Filtrar clusters para requerir obligatoriamente al menos un archivo de Base y al menos un archivo de Target. El original se extrae de Base y los duplicados de Target. Se descartan clusters intra-Base o intra-Target.
   - En **Nivel 2 (Perceptual / dHash / Metadatos)**: Bucle cruzado `base_items` vs `target_items`. Se evita comparar pares Base-Base o Target-Target.
2. **Frontend React (`src/features/visual_library/ui/duplicates/DuplicatesScannerModal.tsx` y `duplicates-scanner.css`)**:
   - Implementar vista compacta para *"Comparar 2 Carpetas"* cuando `baseFolder && targetFolder` están seleccionadas.
   - Cápsulas estilizadas con Material 3 Expressive para Base (verde esmeralda) y Target (naranja vibrante), mostrando icono, ruta legible con tooltip, botón compacto de cambio y botón swap central.
   - Permitir soporte de Drag & Drop sobre las cápsulas compactas.
   - Botón opcional para alternar entre vista compacta y detallada si el usuario desea expandir las tarjetas.

## Criterios de Aceptación
- La altura del panel de selección de carpetas pasa de ~130px a ~44px cuando están seleccionadas, ganando ~80px de altura para la lista de duplicados.
- Ningún duplicado intra-carpeta es reportado en modo cruzado; solo coincidencias Base vs Depurar.
- Los modos de "1 Carpeta" y "Toda la biblioteca" mantienen su funcionamiento íntegro.
- Compilación de TypeScript y Rust (`cargo check`) sin errores.
