# Arrastre con Windows Ink: investigación y límites

## Objetivo vigente

Entrada y salida de archivos reales de Synapse con mouse y lápiz, con Windows Ink activado y desactivado. Desactivar Ink solo fue una prueba diagnóstica. La miniatura saliente debe conservar la imagen en una tarjeta cuadrada.

## Fuentes primarias consultadas

- [Microsoft: DoDragDrop](https://learn.microsoft.com/en-us/windows/win32/api/ole2/nf-ole2-dodragdrop): la llamada desde una entrada pen/touch requiere el recorrido de mensajes de mouse sintetizados. La conversión manual ya ensayada en Prisma bloqueó la interfaz y permanece retirada.
- [Microsoft: WebView2 browser flags](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags): sin DragAndDropJSFileObjects, los File construidos desde JavaScript pueden exportarse solo como nombre de texto. El flag está limitado a imágenes y Microsoft desaconseja usar estos flags en producción. No se añadió ese flag.
- [Chromium: DataObject::ToWebDragData](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/clipboard/data_object.cc): la rama HasBackingFile exporta FilenameItem con GetPath; la rama sin respaldo ni URL del sistema de archivos puede convertirse en text/plain con el nombre.
- [Microsoft: WebMessageObjects](https://github.com/MicrosoftEdge/WebView2Feedback/blob/main/specs/WebMessageObjects.md): intercambio de referencias File/handles mediante mensajes WebView2, sin convertir el contenido a base64.
- [Microsoft: CallDevToolsProtocolMethod](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2#calldevtoolsprotocolmethod) y [Chrome DevTools Protocol: DOM](https://chromedevtools.github.io/devtools-protocol/tot/DOM/): selección de archivos para un input nativo mediante DOM.setFileInputFiles y consulta de su respaldo mediante DOM.getFileInfo.
- [Microsoft: DragStarting](https://github.com/MicrosoftEdge/WebView2Feedback/blob/main/specs/DragStarting.md): evento de CompositionController; no es una sustitución inmediata para el WebView en modo ventana de Prisma.

## Intentos y evidencia actual — 2026-10-29

Se dejó que WebView2 gestione el gesto DOM y su ciclo de arrastre, en lugar de iniciar DoDragDrop desde el manejador React. Se retiró la sustitución del receptor nativo de la ventana de Synapse, conservando la del resto de Prisma.

Primer puente: un FileSystemFileHandle de solo lectura preparado desde Rust y getFile() en JavaScript. Biglex confirmó que podía moverlo con el lápiz pero el chat insertaba únicamente el nombre. Ese recorrido no superó la aceptación.

Segundo puente: input file oculto por petición; Rust selecciona exclusivamente la ruta de una tarjeta existente, mediante DOM.setFileInputFiles, y comprueba DOM.getFileInfo contra la ruta canónica original antes de habilitar el arrastre. No acepta rutas arbitrarias de JavaScript, no abre un puerto de depuración y no lee vídeos enteros a memoria. Solo opera en system_drop_zone y su URL local zone.html.

Dev recompiló el segundo puente y registró cinco archivos preparados mediante entrada nativa. Biglex sigue reportando ausencia de recepción en el chat. El resultado dragend=copy no demuestra aceptación del archivo. Falta observar los formatos nativos entregados al destino; se creó un receptor WinForms local temporal para inspeccionarlos, sin subir ni copiar los archivos.

El helper de Computer Use no admite terminar un drag fuera de los límites de la ventana origen; se solicitó a Biglex un gesto físico hacia el receptor. No se atribuye a la automatización una prueba externa que no pudo ejecutar.

## Validación

- TypeScript/Vite: compilación correcta del recorrido DOM y puente de archivos.
- 13 pruebas frontend correctas: carga File al DataTransfer, miniatura, puente de entrada, rechazo de propios archivos y contacto de capturadora.
- Rust: cargo check correcto; Dev recompiló el comando con selección nativa y comprobación de ruta.
- Prueba Rust de restricción por origen/ventana correcta en el harness con manifiesto Common Controls v6.
- Pendiente: formatos nativos reales y acceso al contenido en destino; aceptación con lápiz Ink ON/OFF, mouse y recepción entrante.

No publicar ni cerrar la incidencia basándose en builds o dropEffect. El próximo arranque real de Windows sigue pendiente para la incidencia independiente del fondo.

## Formato de ruta observado y corrección

El receptor local registró CF_HDROP/FileDrop y una ruta nativa con prefijo de dispositivo `\\?\C:\...`, sin texto. DragQueryFileW devolvió el archivo, pero el acceso estándar WinForms devolvió null/lista vacía. Esto demuestra que el segundo puente conservaba la referencia, pero la forma exportada de la ruta tenía un problema de interoperabilidad. El dispositivo usado para ese gesto no se deduce del registro.

Se añadió shell_drag_path: quitar únicamente VerbatimDisk o convertir VerbatimUNC al formato Shell habitual; conservar sin cambios las rutas DOS/UNC normales y los otros espacios de dispositivo. La identidad se sigue comprobando mediante canonicalize contra el archivo original. Dos pruebas Rust correctas cubren estas variantes, Unicode y equivalencia real con un archivo existente.

Se corrigió además una carrera al instalar el receptor entrante: setup podía observar about:blank antes de terminar la navegación inicial e impedir el registro. La instalación ahora comprueba la ventana; cada mensaje comprueba estrictamente el origen local y su igualdad con el documento actual.

El primer compilado del receptor temporal provocó EBUSY en el watcher Vite. Se excluyeron temp/test/scratch de ese watcher y se restableció el ciclo Dev completo. El error del receptor de prueba por asumir una lista no nula fue corregido; no se atribuye a Prisma.

La entrega posterior al receptor (2026-10-29 00:26:35 -05:00) ya contiene una ruta normal, un FileDrop con un archivo existente de 453.695 bytes y texto null; DragQueryFileW devuelve la misma ruta sin error. Se superó la lectura estándar que antes devolvía una lista vacía. Falta la aceptación final en el chat y con el lápiz en ambos modos; el registro por sí solo no identifica el dispositivo empleado.

Resultado posterior: Biglex confirmó que la imagen aparece adjunta al soltarla desde Synapse en el chat con el lápiz, con Windows Ink activado. La ruta sin prefijo de dispositivo supera esa aceptación. La entrada y la regresión completa permanecen abiertas.
