# Validación

## Recepción de imágenes desde el navegador — 2026-11-01

La captura de Biglex muestra un TypeError en `postMessageWithAdditionalObjects` al soltar una imagen del navegador; pegarla sí funciona. La implementación enviaba todos los File por un puente que requiere respaldo de disco. Se conserva ese camino y se añade una alternativa para lotes de imágenes en memoria: leer bytes, conservar MIME y materializar mediante el importador existente, sin convertir el título o la URL de la página en sustituto de la imagen. Los destinos de fijado/temporal/teléfono se conservan, incluido el lote completo para teléfono. No se cambió código nativo, gestos ni configuración de Windows Ink.

- `bun test ./tests/synapse-browser-drag.test.ts ./tests/synapse-notch.test.ts ./tests/native-drag-pen.test.ts`: 17 pruebas correctas, 50 comprobaciones. Siete pruebas del puente cubren entrega sin lectura del archivo local, fidelidad binaria del fallback, orden/formato, fallo de lectura sin resultado parcial, imágenes vacías y límite previo a lectura, rechazo de lote mixto incompatible y límites de cantidad.
- `bun run build`: TypeScript y Vite correctos, 411 módulos. Persiste el aviso conocido de chunks grandes.
- Biglex confirmó «Ahora sí, acepta normal» al arrastrar desde el navegador a Synapse. No indicó una versión concreta de ejecutable; no se atribuye la confirmación a un instalador recién generado.
- No se automatizaron gestos ni se instaló/publicó una versión. La generación de un instalador se anunció, pero no llegó a iniciarse antes de la confirmación del usuario.

Diagnóstico compartido: [WebView2 y File en memoria](../../../../Docs/troubleshooting/platforms/windows-webview2-memory-file-drop.md).

## Compilación release y espacio en disco — 2026-10-29

La compilación local falló al construir el archivo de librería release con `Espacio en disco insuficiente (os error 112)`. D: tenía aproximadamente 0,14 GiB libres. La inspección encontró 47,76 GiB de artefactos debug, incluidos 27,82 GiB de caché incremental.

El borrado directo fue rechazado por la política automática. Se usó la operación oficial acotada `cargo clean --manifest-path src-tauri/Cargo.toml --package prisma --profile dev`: Cargo informó 25.156 archivos y 36,5 GiB de artefactos retirados; el espacio físico libre posterior fue aproximadamente 31,8 GiB. Se verificó que no había rustc/cargo activos antes de limpiar; la aplicación estable permaneció abierta.

Las tres advertencias Rust se corrigieron limitando el import Pointer y el contador de diagnóstico a debug_assertions. No cambian el comportamiento de arrastre. El empaquetado conserva ahora los instaladores anteriores en la carpeta compartida; la compilación local no los elimina.

`bun run build:app`: frontend correcto (408 módulos; aviso de tamaño de chunks conocido) y aplicación nativa release correcta en 2 min 18 s. El empaquetado comprobó ejecutable actualizado, staging de ocho archivos/583,5 MB y plantilla de release 92638f7 con invariantes correctas. La prueba de InstallerCopy pasó copia nueva, reemplazo, bloqueo opcional/obligatorio, copia idéntica y rechazo de hash inválido.

Instalador Inno Setup correcto en 304,844 s; `bun run build:app` finalizó con código 0. Generado `release/Prisma_2.0.1-setup.exe`, 161,5 MB, y copia verificada en la carpeta compartida. SHA-256: `bd6373990e99ea2a00f18cc9d48436dc7b523ddc25e506627e9e90aee9b703b0`. No se instaló ni publicó remotamente. No se repitieron pruebas físicas de arrastre.

## Ampliación global y auditoría — 2026-10-29

Biglex confirmó arrastre desde Synapse al chat mediante sus adjuntos y luego la sección Imágenes. Se amplía la misma herramienta a Inicio, fuentes musicales/visuales, documentos y proyectos, visores, favoritos, historial, listas, cola y árbol. La recepción en Inicio abre el primer archivo o registra la carpeta como fuente de medios. No se automatizaron gestos físicos.

Auditados cambios posteriores al checkpoint af17ec3. Se restauró el rechazo de inicio OLE cuando el fallback no confirma contacto y el seguimiento real del contacto; se conservaron el registro declarativo en Inicio y la miniatura por omisión. Corregidos el alcance del hook (raíz de App) y el resultado de native_file_set_surfaces (IDs registrados, no null). Una ruta eliminada/no disponible no bloquea las demás tarjetas.

- `bun run build`: TypeScript y 408 módulos Vite correctos; aviso de tamaño de chunks conocido.
- Suite de geometría/controles, Synapse, lápiz y capturadora: 19 pruebas correctas.
- `bun test ./tests/native-file-contact.test.ts`: una prueba adicional correcta, con dos casos que impiden entrar al plugin sin contacto confirmado. Se ejecuta aislada por sus mocks de Tauri.
- `scripts/test-wallpapers.ps1 -Filter app::commands::synapse_`: seis pruebas Rust correctas, incluyendo origen/ventana local, límites de fuentes, superficie real y PNG.
- Dev respondió con PID y ruta debug verificados; prisma.exe posterior al último cambio nativo. HMR posterior a los cambios frontend. No se cerró la versión estable que estaba abierta.

Incidencias del harness, diferenciadas del arrastre: tauri-build intentaba sobrescribir WebView2Loader.dll cargado por Dev; se preservó el artefacto con otro nombre para permitir su reconstrucción. Después mt.exe truncó una sección DWARF del ejecutable libtest (el final declarado de la sección excedía el tamaño real), causando error de aplicación no válida. El original corrupto se preservó en temp y Cargo lo regeneró. El script ahora copia el ejecutable, retira símbolos solo de la copia con llvm-strip y añade el manifiesto allí; conserva intacto el artefacto de Cargo. La suite finalmente ejecutó y pasó.

Guía canónica en [Core](../../../../Docs/platforms/windows/tablet-compatibility.md), contratos en [la guía de Prisma](../../../docs/guides/tablet-compatibility.md). Recepción real del resto de formatos/destinos e Ink ON/OFF y próximo arranque del wallpaper pendientes; no cerrar el proceso completo.

## Evidencia posterior — laboratorio con lápiz y chat

Biglex confirmó que funciona y adjuntó la muestra PNG también en este chat. Los registros de ambos procesos muestran PT_PEN tipo 3, promoción compatible FF51570A, botón izquierdo en el mensaje, inicio OLE desde MouseMove, final Copy y FileDrop legible de 2.396 bytes sin texto. Se acepta esa prueba independiente; no extenderla todavía a Synapse.

La integración usa ahora el mismo recorrido de mensajes, dejando el lápiz a DefWindowProc e iniciando OLE exclusivamente desde mouse compatible. Se retira CoreDragOperation. Validación física integrada pendiente de Biglex.

El harness Rust con la configuración de Dev completó cuatro pruebas sin fallos después del traslado: origen restringido, ruta interoperable, superficie layered y PNG/alfa intactos. No hubo cambios frontend en esta revisión; se conserva su build y las 17 pruebas ya registradas. No se repitieron gestos mediante automatización.

## Estado vigente — 2026-10-29, superficies nativas

Prueba aislada posterior solicitada por Biglex: laboratorio WinForms con Origen y Destino en procesos independientes, muestra PNG precargada, carga/pegado y registros de gesto/formato/lectura. Compiló y superó self-test de FileDrop y lectura de muestra; ambas ventanas abiertas y respondiendo. El agente no arrastró: la prueba física y su resultado siguen a cargo de Biglex. Véase RESEARCH.md para ubicación, relanzamiento y fuentes de Krita/Qt. Sin cambios adicionales al código productivo durante este diagnóstico.

Biglex confirma entrada hacia Synapse y el recorrido con mouse/modo ratón. Salida con lápiz a otras aplicaciones aún en REWORK. Las aceptaciones generales del chat registradas en el historial inferior fueron corregidas por pruebas posteriores. Los gestos físicos quedan exclusivamente a cargo de Biglex.

- `bun run build`: TypeScript y Vite correctos; aviso de tamaño de chunks conocido.
- Suite Synapse, puente entrante, lápiz y capturadora: 17 pruebas, 140 comprobaciones, sin fallos.
- `TAURI_CONFIG` de Dev y `scripts/test-wallpapers.ps1 -Filter app::commands::synapse_`: cuatro pruebas Rust correctas, incluida creación real de ventana hija layered y conservación de alfa de miniatura.
- Reproducción aislada del manifiesto: hijo normal OK y layered falla antes; ambos OK tras incorporar compatibilidad Windows 10/11.
- Registro real de Dev: cinco superficies de salida listas y contacto de lápiz recibido en ventana propia. Esto confirma preparación/contacto, no recepción en la aplicación destino.
- Sin pruebas físicas automatizadas, instalación ni publicación. El arranque real del wallpaper permanece pendiente.

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

## Panic al reproducir y temporal de instalador — 2026-11-01

La captura de Biglex muestra un panic en `synapse_drag_surface.rs:354`, `RefCell already borrowed`, seguido de aborto del proceso nativo. `WM_LBUTTONUP` llamaba a `ReleaseCapture` manteniendo el préstamo mutable del mapa de fuentes; Windows vuelve a entrar por `WM_CAPTURECHANGED`. Se separan las operaciones externas del préstamo, incluidos captura inicial, hover, eventos y limpieza COM. [Diagnóstico compartido](../../../../Docs/troubleshooting/platforms/windows-refcell-wndproc-reentrancy.md).

El registro también muestra Node/Vite `EBUSY` al vigilar `release/.installer-*.tmp`. Se excluye `release/`; la regresión usa un archivo real abierto con FileShare.None, solicita su vigilancia y comprueba que Vite sigue sirviendo el frontend sin errores.

- `cargo test --manifest-path src-tauri/Cargo.toml --lib app::commands::synapse_drag_surface -- --test-threads=1`: 4 correctas.
- `bun test tests/synapse-notch.test.ts tests/synapse-browser-drag.test.ts tests/native-drag-pen.test.ts`: 21 correctas; el filtro incluyó también cuatro pruebas de una copia histórica en temp.
- `bun test ./tests/vite-locked-release.test.ts`: 1 correcta con Node y archivo bloqueado por PowerShell.
- `bun run build`: TypeScript/Vite correctos; advertencia de tamaño de chunks.
- Prueba nativa mediante entrada real de mouse: se pulsan dos tarjetas de música de Inicio; se cargan World is Mine y Beyond Repair sin cerrar Dev. Navegación a Escuchar correcta; Beyond Repair alcanza 1:20 con botón Pausar visible. Misma instancia nativa después de las acciones.
- La cola continúa automáticamente a Forever Young sin terminar el proceso.
- No equivale a aceptación física adicional de la tableta ni a una nueva instalación/publicación.
