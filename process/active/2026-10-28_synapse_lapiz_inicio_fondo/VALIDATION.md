# Validación

- [x] Pruebas Bun de arrastre mouse/lápiz y destinos de Synapse: 14 correctas, 0 fallos (incluye cuatro pruebas duplicadas por coincidencia con una copia en temp).
- [x] `bun run build`: TypeScript y Vite correctos; aviso de tamaño de chunks.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml features::wallpapers::startup::tests --lib`: compilación nativa correcta, tres pruebas correctas (estabilidad, pérdida del shell y cancelación al cerrar).
- [x] `git diff --check`: sin errores de espacios; solo avisos de conversión LF/CRLF.
- [ ] Probar arrastre real con la tableta y el controlador utilizado por Biglex.
- [ ] Probar un inicio de Windows y confirmar el tamaño del fondo sin detenerlo manualmente.

No se ha reemplazado el ejecutable instalado. La espera es una mitigación de la inicialización, no prueba de que Windows sea la causa exacta. No implementa recuperación automática de un render defectuoso que ocurra después de la espera.

## Segunda corrección del arrastre

Biglex instaló posteriormente la compilación nueva y reportó fallo con lápiz; mouse correcto. No confundir las primeras pruebas unitarias con aceptación nativa.

- [x] Primera revisión: 11 pruebas frontend y cinco pruebas Rust correctas. Biglex volvió a confirmar fallo real con lápiz; la espera de mousemove compatible en el DOM fue retirada.
- [x] Revisión actual: `bun test ./tests/native-drag-pen.test.ts ./test/nativeDragGesture.test.ts ./tests/synapse-notch.test.ts ./test/nativeDragPreview.test.ts`: 15 correctas; arrastre, cancelación, miniatura, formato cuadrado y archivos propios.
- [x] `bun run build`: TypeScript y Vite correctos en la revisión con miniatura cuadrada.
- [x] Cinco pruebas de importación Rust correctas tras la modificación nativa. El ejecutable de pruebas necesitó incorporar el manifiesto de Common Controls v6 con `mt.exe`: sin él fallaba antes de iniciar con `STATUS_ENTRYPOINT_NOT_FOUND` (`comctl32!TaskDialogIndirect`). Se modificó únicamente el artefacto de prueba en target, no el ejecutable de la app.
- [ ] Arrastre con lápiz real en Dev a una aplicación externa.

Referencia técnica: [DoDragDrop — Microsoft](https://learn.microsoft.com/en-us/windows/win32/api/ole2/nf-ole2-dodragdrop), que exige usar mensajes de mouse sintetizados para contactos de lápiz/touch. El paso DOM → IPC → OLE todavía requiere comprobación con el dispositivo real.

La revisión actual realiza la conversión en `vendor/drag`, en el hilo de OLE y justo antes de DoDragDrop. Usa [ConvertPrimaryPointerToMouseDrag](https://learn.microsoft.com/en-us/windows/win32/winmsg/winuser/nf-winuser-convertprimarypointertomousedrag), resuelta dinámicamente por ordinal para conservar compatibilidad con sistemas que no la ofrecen. El registro `[drag-native] Primary pointer promoted to mouse for OLE` permite observar si Windows convirtió el contacto. FALSE también es normal con mouse o un contacto ya promovido, por lo que no demuestra un fallo por sí solo.

Biglex confirmó que tampoco arrastra con esta conversión. El registro real de Dev mostró `Primary pointer promoted to mouse for OLE: true`, así que la entrada alcanzó el plugin y la conversión devolvió éxito, pero no existe aceptación funcional. Reportó además la barra abierta; una recompilación la cerró antes de verificar Esc. Se añadieron trazas de QueryContinueDrag (estado OLE, estado físico del botón y Escape) y del resultado final de DoDragDrop. Dev recompiló y arrancó correctamente con esas trazas; se espera un único gesto real sin editar código durante la prueba.
