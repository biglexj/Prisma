# Validación: QuickLook Refinement, Multi-ventana Desacoplada y Motor de Duplicados

- Estado: `VALIDATED`
- Fecha: `2026-09-12`

## Pruebas automatizadas

- [x] TypeScript check (`bun run tsc --noEmit`): Ejecutado con éxito (0 errores).
- [x] Rust check (`cargo check --manifest-path src-tauri/Cargo.toml`): Ejecutado con éxito (0 errores).

## Comprobaciones manuales y de comportamiento

- [x] Apertura de documentos en QuickLook: tamaño visiblemente más holgado (+5% alto, +8-10% ancho: 830x630 para MD/Texto/EPUB, 740x580 para archivos comprimidos, 880x750 para PDF).
- [x] Botón «Editar»: abre el archivo en el editor predeterminado de Windows mediante `ShellExecuteW` con verbo "edit" (y fallback a "open").
- [x] Botón «Abrir»: abre el documento completo en `DocumentViewer` dentro de la ventana principal de Prisma, eliminando el rebote vacío en la pantalla de inicio.
- [x] Imagen con `@` en ruta (ej. `@ely_vtuber/bg-404.png`): sanitizada con `toSafeAssetUrl` codificando `@` como `%40` para evitar parsing erróneo de credenciales de host en WebView2.
- [x] Ventana desacoplada: aísla estado de maximizado/límites por `window.label()` y cierra al instante con `window.close()` al pulsar `✕` o `Esc`.
- [x] Sin menú contextual de WebView2 en ventanas de previsualización (`preventDefault` en `contextmenu`).
- [x] Escaneo de duplicados: motor en Rust puro con detección por tamaño/hash BLAKE3/SHA-256 (Nivel 1 exacto) y perceptual dHash 64-bit con similitud porcentual (Nivel 2), modal interactivo con selección por lote, envío seguro a papelera (`trash`) y botón directo para «Comparar» en `ImageComparisonModal`.
- [x] Carga de imágenes PNG en rutas con `@` (ej. `YouTube/@ely_vtuber/01_Brand/Logo/Ely Vtuber 2.png`): resuelta al evitar codificación destructiva en `toSafeAssetUrl`.
- [x] Dimensionamiento de QuickLook para documentos por porcentaje de pantalla: 70% de ancho y 80% de alto calculado reactivamente contra el monitor actual de Windows.
- [x] DocumentViewer: contraste de alta legibilidad en modo claro y modo oscuro, eliminación del texto negro sobre fondo negro, contenedor centrado con estilo de hoja elevada M3, números de línea perfectamente alineados y tamaño real del archivo en disco en lugar de `0 B`.
- [x] Comparativa cruzada de 2 carpetas (Base vs Depurar): selección nativa de carpetas, botón de inversión rápida de roles (`⇄`), designación de la carpeta base como original a conservar intacta y de la carpeta a depurar como duplicados para limpieza.
- [x] Priorización de mayor resolución (Upgrade HD/4K): detección de píxeles ($W \times H$), insignia visual de mejora de calidad, reemplazo atómico en disco (copia segura temporal, envío de versión antigua de baja resolución a papelera de reciclaje y eliminación del duplicado de la carpeta origen).
- [x] Acciones flexibles de depuración: eliminación directa a papelera de Windows, reemplazo masivo de versiones base para todas las mejoras HD/4K detectadas, y traslado de duplicados a otra carpeta de respaldo o cuarentena sin borrarlos.


