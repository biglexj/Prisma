# Validación

## Resultado vigente — 2026-10-28

Biglex confirmó que, después de desactivar Windows Ink en XPPen, funcionan el arrastre con lápiz entre carpetas del Explorador y hacia Synapse. En una comprobación adicional confirmó también la salida desde Synapse hacia otra aplicación. Posteriormente aclaró que desactivar Ink no satisface el requisito: debe funcionar con ambos estados. Se restauró Windows Ink activado y se verificó visualmente la casilla en XPPen. La conversión nativa que produjo el bloqueo permanece retirada.

Solo queda validada la mitigación con Ink desactivado. La compatibilidad con Ink activo no está resuelta. No atribuir una solución completa al controlador de contactos extraído de la capturadora: también fallaba en el Explorador y la recuperación ocurrió tras el ajuste de XPPen. No se ha probado presión/inclinación en aplicaciones de dibujo ni persistencia tras reiniciar Windows.

El proceso sigue activo por el arrastre con Windows Ink activado, la comprobación del tamaño del fondo durante un nuevo inicio real de Windows y cualquier aceptación visual aún no confirmada explícitamente.

Diagnóstico reutilizable: [Windows/XPPen y Windows Ink](../../../../Docs/troubleshooting/platforms/windows-xppen-ink-file-drag.md).

## Historial técnico y de pruebas

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

## Retirada del experimento nativo

La prueba posterior quedó pegada y Biglex reportó ventana blanca/sin responder. El registro terminó en `Primary pointer promoted to mouse for OLE: true`, sin ninguna llamada registrada de QueryContinueDrag ni retorno de DoDragDrop. Esto acota el bloqueo al inicio de OLE, sin demostrar todavía su causa interna.

Se cerró mediante PID y ruta exacta solamente `src-tauri/target/debug/prisma.exe` (PID 29840) y se retiró toda la conversión y las trazas experimentales de vendor/drag, restaurándolo desde el checkpoint 99bd1f4. Se bloqueó preventivamente el arrastre saliente con lápiz solo en Synapse; sus botones siguen disponibles y el mouse conserva su recorrido.

- [x] Repetición de las 15 pruebas frontend: correctas tras retirar la ruta experimental.
- [x] Compilación frontend de la contención: TypeScript y Vite correctos.
- [x] Dev reiniciada con `bun run tauri:dev`: recompiló drag, tauri-plugin-drag y Prisma; inició servidor, atajos y compositor sin la conversión experimental. No equivale a aceptación funcional del lápiz.
- [ ] Soporte funcional de arrastre con lápiz: pendiente, actualmente deshabilitado en Synapse.

## Reintento autorizado con el controlador de la capturadora

Biglex pidió reutilizar el código que resolvió contactos perdidos en la capturadora. Se extrajo sin cambiar su lógica a `shared/pointerContact.ts`; la capturadora mantiene su export CapturePointer mediante alias. Synapse comparte ahora esa clase y deja de tratar `buttons=0` de un movimiento de lápiz como liberación automática. Se mantienen pointerup, pointercancel, pérdida de captura y blur como finales del gesto.

Se retiró el bloqueo fijo del lápiz en Synapse y se añadió `native_drag_mouse_contact_active`: consulta el bit alto de GetAsyncKeyState(VK_LBUTTON) antes de solicitar el arrastre del plugin. Si Windows no confirma pulsación, se muestra un aviso y no se entra en OLE. No vuelve la conversión nativa retirada ni se inyecta entrada.

- [x] 20 pruebas correctas: seis de la capturadora, cinco del lápiz, cuatro del mouse y cinco de Synapse.
- [x] `bun run build`: TypeScript y Vite correctos; solo aviso de tamaño de chunks.
- [ ] Aceptación real con tableta: todavía no demostrada. La comprobación de entrada evita un inicio sin pulsación confirmada, pero no equivale a una garantía general contra bloqueos de OLE.

## Entrada a Synapse y alcance del fallo

Biglex confirmó que al soltar sobre Temporal tampoco se importaba el archivo y que el arrastre con lápiz también falla entre carpetas del Explorador, fuera de Prisma. El mouse funciona. Esto demuestra que no es exclusivo de Synapse; no demuestra aún qué ajuste o componente externo lo causa.

La Dev respondió a la consulta del sistema. El registro de cuatro intentos salientes devolvió `Contacto de mouse disponible para arrastre con lápiz: false`; esos intentos no llegaron a solicitar OLE. Se corrigió la persistencia del aviso anterior: un arrastre entrante nuevo limpia error/mensaje. Se añadieron trazas solo de diagnóstico para enter/leave/drop nativos, recepción UI e importación (cantidades y estados, sin contenido ni nombres de archivos). Build frontend correcto.

Se detectó XPPenTablet 4.0.18.260720 y se abrió su panel: dispositivo Deco 01 V3, perfil global seleccionado, Windows Ink activado y modo de ratón desactivado. Para una prueba temporal se desmarcó únicamente Windows Ink desde la UI. Pendiente comparar Explorador y Synapse; si no mejora, restaurar la casilla original. No considerar este cambio del controlador una solución aceptada hasta tener el resultado real.

## WebView2 y formato de archivo — 2026-10-29

Estado posterior: Windows Ink fue restaurado activado y el requisito vigente incluye los dos modos. Véase RESEARCH.md para las fuentes e intentos del nuevo recorrido DOM.

El FileSystemFileHandle inicial permitió iniciar el gesto, pero Biglex reportó solo nombre de archivo en el chat. Se sustituyó por un input file preparado desde el host y una comprobación de DOM.getFileInfo. Esa segunda ruta conservaba el archivo, pero exportaba el prefijo interno de canonicalize.

El receptor de diagnóstico registró una ruta CF_HDROP con prefijo de dispositivo y una lista FileDrop estándar vacía. Tras normalizar la ruta de exportación, una entrega real posterior devolvió FileDrop con Imagen.png existente, 453.695 bytes, text=null y la misma ruta en DragQueryFileW. Se confirma entrega local interoperable; el dispositivo usado no se deduce del registro. Aceptación final del chat y lápiz Ink ON/OFF pendiente.

También se corrigió el registro entrante durante la navegación inicial about:blank, manteniendo la validación estricta del origen de cada mensaje. Dev recompiló sin error del puente y sigue respondiendo. El watcher de Vite ignora temp/test/scratch tras el EBUSY causado por el compilado del receptor temporal.

- `bun run build`: TypeScript/Vite correctos; aviso de tamaño de chunks conocido.
- `bun test ./tests/synapse-browser-drag.test.ts ./tests/synapse-notch.test.ts ./tests/capture-pointer.test.ts`: 13 correctas.
- `scripts/test-wallpapers.ps1 -Filter app::commands::synapse_browser_drag::tests`: dos correctas, incluyendo equivalencia de ruta de un archivo real y restricción de origen.
- Sin instalación, publicación ni aceptación del siguiente inicio de Windows.

Aceptación manual posterior: Biglex respondió «Sí, aparece la imagen adjunta» a la prueba de soltar desde Synapse al chat con el lápiz. Se acepta esa salida con Windows Ink activado. Se cerró solo el receptor temporal tras guardar el registro; Dev continúa abierta. Entrada hacia Synapse, otros tipos y la matriz completa de regresión siguen pendientes.
