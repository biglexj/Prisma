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

