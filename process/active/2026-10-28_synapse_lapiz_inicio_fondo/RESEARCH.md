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

## REWORK posterior: rutas eliminadas por el receptor Chromium

Biglex aclaró que la misma imagen llega al Explorador pero no al chat; desde el Explorador al chat funciona. La última prueba incluye fallo directo de Synapse tanto con mouse como con lápiz. Se retiró la marca MIME privada de Synapse y el resultado no mejoró. Se revisó de forma solo lectura el receptor instalado y se constató que consume File del DataTransfer; no se modificó Codex ni se automatizó su interfaz.

La preparación real en Synapse entrega File con tamaño distinto de cero, MIME image/png y ocho bytes de cabecera legibles. El receptor nativo había mostrado la marca chromium/x-renderer-taint. [RenderWidgetHostImpl::FilterDropData](https://github.com/chromium/chromium/blob/main/content/browser/renderer_host/render_widget_host_impl.cc) borra filenames si did_originate_from_renderer es true, y [WebContentsViewAura::PrepareDropData](https://github.com/chromium/chromium/blob/main/content/browser/web_contents/web_contents_view_aura.cc) obtiene ese indicador de IsRendererTainted. Esto explica la incompatibilidad de exportar rutas desde el DOM hacia otros receptores Chromium; normalizar la ruta no basta. No se quitan marcas de seguridad del navegador ni se cambian políticas globales.

Nuevo recorrido: restaurar el plugin nativo existente para mouse y usar un DataPackage con StorageFile del host mediante [CoreDragOperation](https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.datatransfer.dragdrop.core.coredragoperation) para el lápiz. [IDragDropManagerInterop::GetForWindow](https://learn.microsoft.com/en-us/windows/win32/api/dragdropinterop/nf-dragdropinterop-idragdropmanagerinterop-getforwindow) permite asociar el gestor al HWND de escritorio en Windows 11. Una prueba aislada en esta máquina creó el gestor y la operación con éxito usando el STA OLE habitual; no inició un gesto y por tanto no demuestra su recepción externa.

El primer intento observaba el contacto mediante subclases de ventanas, pero no obtuvo un contacto nativo utilizable. Ese intento fue sustituido por las superficies descritas a continuación. La operación se inicia en el STA, conserva sus objetos en ese hilo y finaliza con callback; la apertura StorageFile usa un worker MTA y AgileReference para cruzar de forma válida al STA. No hay esperas bloqueantes en la UI ni reintroducción de ConvertPrimaryPointerToMouseDrag. Escape/cancelación los gestiona la API de Windows; existe cancelación por tiempo máximo. Se conserva la miniatura PNG cuadrada con alfa premultiplicado.

Estado: cargo check correcto; frontend compiló y pruebas de regresión correctas. Prueba Rust de la miniatura nativa correcta. Arrastre real con mouse y lápiz hacia chat pendiente de aceptación; no extender la prueba de disponibilidad de API a esa aceptación.

## Superficies de entrada propias y manifiesto de Windows

[GetPointerInfo](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getpointerinfo) exige consultar el mensaje de puntero en el hilo propietario de su ventana. El identificador del DOM no sustituye ese contacto. Se retiró la consulta desde las subclases del WebView y se añadieron ventanas hijas del host sobre la parte superior de cada tarjeta. Los botones conservan su superficie web. La operación del lápiz se inicia directamente desde WM_POINTERUPDATE, sin IPC intermedio ni OLE manual para el lápiz. Mouse conserva drag nativo. Se eliminaron el input oculto y la preparación CDP saliente; se mantiene el puente DOM entrante confirmado por Biglex.

Windows rechazaba CreateWindowExW con WS_EX_LAYERED|WS_CHILD. El manifiesto predeterminado de tauri-build solo incluía Common Controls v6. [Microsoft exige declarar compatibilidad con Windows 8 o posterior para superficies hijas layered](https://learn.microsoft.com/en-us/windows/win32/winmsg/using-windows#using-layered-windows). Un ejecutable aislado reprodujo: ventana hija normal OK, layered falla; al incorporar el manifiesto de Prisma con supportedOS Windows 10/11, ambas se crean. La Dev posterior registró cinco superficies listas y contactos reales de lápiz, sin atribuir a esas trazas la entrega del archivo al destino.

El manifiesto de la app y el harness de pruebas comparten esa declaración y Common Controls v6. Cada superficie pinta una región con alfa 1 para conservar entrada sin ocultar la imagen web y registra exclusivamente su propio receptor OLE, sin reemplazar el de WebView2. Se conserva la recepción sobre esas regiones y el rechazo de archivos propios. Los mensajes de mouse compatibles no reemplazan/cancelan el contacto de lápiz; una actualización de geometría pendiente se difiere mientras exista contacto. No se destruye la superficie propietaria en mitad del gesto por el final de la animación.

Comprobaciones: build frontend correcto; 17 pruebas frontend y cuatro Rust correctas, incluida la creación real de una superficie hija layered con el procedimiento del host y su manifiesto. Una consulta cargo check con configuración distinta a Dev encontró un bloqueo de copia de recursos; el harness con TAURI_CONFIG de Dev compiló y ejecutó correctamente. La Dev recompila automáticamente los cambios nativos. La recepción física de la salida con lápiz sigue a cargo de Biglex y pendiente de aceptación.

## Laboratorio independiente solicitado por Biglex

Se preparó `temp/synapse-pen-diagnostics/isolated/DragLab.cs` y `Run-Lab.ps1`: dos ventanas WinForms, cada una en un proceso propio, sin Synapse, Tauri ni WebView2. Origen carga una muestra PNG creada para la prueba y permite cargar un archivo, pegar una lista de archivos o materializar una imagen del portapapeles solo por acción explícita. Destino registra formatos y abre el archivo recibido para verificar lectura real, tamaño y cabecera. No copia ni modifica el archivo recibido. Se usa FileDrop sin texto y el recorrido OLE estándar iniciado desde MouseMove con botón izquierdo. La observación de mensajes de lápiz no los consume, dejando a Windows generar el mouse compatible; no se convierte ni inyecta entrada.

La prueba separa `mouse.down`, `mouse.firstMove`, `gesture.threshold`, `drag.start`, `drag.end`, `drop.enter` y `drop.received`, además de mensajes de puntero recibidos. Los resultados se añaden a `isolated/results/source.jsonl` y `receiver.jsonl`. No mide los hercios físicos del hardware: el número de mensajes entregados a una ventana no equivale a la frecuencia de muestreo de la tableta.

Compilación C# correcta y self-test local correcto: muestra PNG de 2.396 bytes, cabecera PNG, FileDrop/FileNameW/FileName y ausencia de UnicodeText. Se abrieron Origen y Destino y ambos procesos respondieron. No se automatizó ningún gesto; falta la prueba física de Biglex. Este laboratorio establece una referencia OLE independiente y no valida por sí solo la nueva ruta CoreDragOperation de Synapse.

Fuentes de referencia consultadas:

- [Krita: preferencias de tableta](https://docs.krita.org/en/reference_manual/preferences/tablet_settings.html): WinTab y Windows Ink son rutas de entrada; el probador distingue eventos de mouse y tableta, presión y coordenadas. La documentación sobre frecuencia y suavizado de trazos no demuestra un fallo de arrastre de archivos.
- [Krita: kis_input_manager.cpp](https://github.com/KDE/krita/blob/master/libs/ui/input/kis_input_manager.cpp): trata TabletPress/Move/Release y la duplicación de eventos compatibles de Windows; su lógica de lienzo no se debe confundir con la transferencia de archivos externos.
- [Krita: kis_tablet_debugger.cpp](https://github.com/KDE/krita/blob/master/libs/ui/input/kis_tablet_debugger.cpp): registra por separado origen, botones y eventos de mouse/tableta. Sirvió como referencia conceptual para instrumentar, sin copiar código GPL a Prisma.
- [Qt: QTabletEvent](https://doc.qt.io/qt-6/qtabletevent.html) y [arrastre](https://doc.qt.io/qt-6/dnd.html): distingue aceptación de eventos de tableta, generación de mouse y umbrales de inicio del gesto.
- [Qt, rama dev: qwindowsdrag.cpp](https://github.com/qt/qtbase/blob/dev/src/plugins/platforms/windows/qwindowsdrag.cpp): startDoDragDrop documenta explícitamente un bloqueo con touch/pen hasta mover mouse. Implementa un puente con procesamiento de WM_POINTERUPDATE y SendInput antes de DoDragDrop. Se identificó una pista compatible con el síntoma, no una causa demostrada en la máquina ni una afirmación sobre la versión de Qt usada por Krita instalado. No se incorporó ese puente a Prisma; el experimento previo retirado usaba otra API, ConvertPrimaryPointerToMouseDrag.

La implementación interna de Affinity/Photoshop no se ha inspeccionado ni se presenta como comprobada. La prioridad es obtener un resultado de origen y destino independientes antes de otro cambio productivo.
