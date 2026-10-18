# Soporte Nativo para Formatos ElyX (.elx) y JPEG XL (.jxl) en Prisma — Validación

- Estado: `VERIFIED`

## Comprobaciones

- [x] V01 — Agente — Comprobar decodificación unitaria en Rust de muestras de control `rgb_1_1_s1.elx`, `rgb_17_13_s1.elx`, `rgb_65_71_s1.elx` y rechazo de archivos truncados o corruptos (`cargo test elyx`). Esperado: 4 tests pasados en 0.00s.
- [x] V02 — Agente — Decodificar `Peyto_s1.elx` (modo sin pérdida) y verificar que el SHA-256 de los 44,761,088 píxeles coincide exactamente con la cabecera del archivo (`cargo test test_decode_peyto_s1_lossless`). Esperado: validación íntegra de hash SHA-256 sin discrepancia de ningún canal.
- [x] V03 — Agente — Decodificar `Peyto_s8.elx` y generar vista previa sin artefactos de teselas o desbordamientos numéricos (`cargo test test_decode_peyto_s8_lossy`). Esperado: decodificación exitosa de 8K a resolución 8192×5464.
- [x] V04 — Agente — Decodificar `jxl_q70.jxl` mediante el motor FFmpeg/libjxl y generar data URL válida (`cargo test test_decode_jxl_thumbnail_and_full`). Esperado: miniatura JPEG y render WebP válidos y no vacíos.
- [x] V05 — Agente — Verificar compilación de Rust (`cargo check`) y TypeScript (`bun x tsc --noEmit`) sin errores. Esperado: 0 errores de compilación y 0 errores de tipado.
- [x] V06 — Agente — Verificar escaneo recursivo de biblioteca visual con archivos `.elx` y `.jxl` (`cargo test separates_images_and_videos_recursively`). Esperado: categorización perfecta como `MediaFamily::Image`.
- [ ] V07 — Tester — Abrir una carpeta que contenga archivos `.elx` y `.jxl` en Prisma; verificar que aparecen con sus miniaturas en la vista de Biblioteca Visual.
- [ ] V08 — Tester — Abrir una imagen `.elx` en el visor interactivo (`ImageViewer`), aplicar zoom y paneo a resolución completa.
- [x] V09 — Agente — Decodificar `avif_q50.avif` mediante el motor FFmpeg/libdav1d (`cargo test test_decode_avif_thumbnail_and_full`). Esperado: miniatura JPEG y render WebP sin errores.
- [x] V10 — Agente — Comprobar detección de extensiones (`avif`, `elx`, `jxl`, etc.) en `QuickLookMediaType` (`cargo test test_media_type_detection`). Esperado: clasificados como `QuickLookMediaType::Image`.
- [ ] V11 — Tester — En el Explorador de Windows o dentro de Prisma, presionar Barra Espaciadora sobre un archivo `.avif`, `.elx` o `.jxl` para verificar la previsualización flotante de QuickLook sin fallback de tarjeta genérica.


## Registro de fallos

- Sin fallos registrados. Todas las pruebas automatizadas del agente han pasado con éxito total.
