# Validación

- `bun run build`: correcto; TypeScript y Vite compilaron el frontend.
- `bun run check`: correcto (0 errores de TypeScript con `tsc --noEmit`).
- `bun test test/nativeDragPreview.test.ts`: 4 pruebas pasadas al 100% (19 aserciones). Valida proporciones fijas cuadradas para música, 16:9 y 9:16 para vídeo/imágenes, escalado cover centrado en el lienzo y recuperación ante fallbacks.
- `cargo check --offline --manifest-path src-tauri/vendor/drag/Cargo.toml`: correcto con `$env:CARGO_TARGET_DIR="temp/drag-check-target"`.
- `crColorKey`: configurado a `COLORREF(0xFFFFFFFF)` (`CLR_INVALID`), eliminando la clave de color negro transparente que provocaba que Windows Shell recortara los píxeles oscuros de la miniatura.
- `crossOrigin="anonymous"`: añadido a visores y miniaturas. Si el recurso no permite exportar el lienzo, se usa el respaldo; el atributo por sí solo no prueba que toda imagen sea exportable.
- `VideoPlayer.tsx`: depurado el selector `.video-stage-surface`, permitiendo que el arrastre obtenga limpiamente el icono o miniatura de la biblioteca.
- Observación interactiva en Windows: confirmada por Biglex para las miniaturas de imagen, música y vídeo; recepción externa de imagen confirmada en Affinity y en este chat (véase la validación manual al final).

## Reparación de la regresión del 29 de septiembre

- Instrumentación temporal del frontend y plugin: `pointerdown → gesture armed → threshold reached → PNG → plugin` terminaba con `No se puede cambiar el modo de subproceso después de establecerlo. (0x80010106)`.
- Causa encontrada en las consultas COM de audio: había llamadas a `CoUninitialize()` después de intentar inicializar MTA sin comprobar el resultado, además de consultas que dejaban su inicialización sin equilibrar. El guard conserva un STA existente y libera exclusivamente las referencias propias; también cubre retornos anticipados.
- `bun test test/nativeDragGesture.test.ts test/nativeDragPreview.test.ts`: 8 pruebas, 36 aserciones, correctas.
- Pruebas Windows del código real `windows_com.rs`, con un harness temporal fuera de `src-tauri`: 2 correctas. Verifican 20 consultas en un hilo OLE/STA, inicializaciones MTA anidadas y liberación ante retorno anticipado.
- Prueba Windows del código real del bitmap mediante harness temporal: 1 correcta. `GetObjectW` y los píxeles de la sección DIB conservan BGRA, alfa y el orden de las filas.
- `bun run build`: correcto; TypeScript y Vite. Persiste el aviso de tamaño de bundle.
- `cargo check --offline --manifest-path src-tauri/Cargo.toml`: correcto con la implementación final.
- Gesto interactivo real desde Inicio: la traza posterior a la corrección llegó a `OLE initialized → Shell data object ready → bitmap decoded → bitmap helper ready → DoDragDrop`. Desapareció el error `0x80010106`.
- Los gestos observados devolvieron `DRAGDROP_S_DROP` con efecto `0`. Eso confirma que la sesión nativa llegó a ejecutarse; **no prueba que Paint ni otra aplicación hayan aceptado el archivo**. El callback del plugin los denomina `Dropped`, pero esa etiqueta sola no basta para afirmar recepción externa.
- La automatización de Paint no pudo completar la prueba: estaba minimizado y los intentos de restaurarlo se interrumpieron con `user input was detected in this window`. Esa sesión automatizada no aportó prueba de recepción ni de aspecto visual; después Biglex completó la validación manual indicada abajo.
- La instrumentación temporal se retiró después del diagnóstico; su último registro local queda en `temp/native-drag-trace.log`, ignorado por Git.
- Referencias de implementación: [OleInitialize](https://learn.microsoft.com/en-us/windows/win32/api/ole2/nf-ole2-oleinitialize), [InitializeFromBitmap](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-idragsourcehelper-initializefrombitmap), [IDropTargetHelper](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-idroptargethelper).

## Validación manual de Biglex — 29 de septiembre

- Biglex confirmó que aparecen las miniaturas flotantes al arrastrar imágenes, vídeos verticales y horizontales, y música. Dio por terminada la parte visual.
- Tras observar problemas en Paint, probó otra aplicación: aportó una captura de Affinity con `Power.png` recibido y visible en el documento.
- Arrastró la imagen desde Prisma a este chat. Se recibió como adjunto `D:/Imágenes/Prisma/Power.png`, con su contenido visible; esto confirma una entrega externa real del archivo de imagen.
- La recepción en dos destinos confirma el arrastre de imágenes en esos destinos y su vista previa; no permite cerrar la compatibilidad con Paint.
- No se midió el efecto OLE de estos gestos manuales ni se confirmó recepción externa de archivos de música o vídeo; su miniatura flotante sí fue confirmada.

## Comparación posterior con Paint

- Biglex comparó `Power.png` desde el Explorador y Prisma sobre la misma zona del lienzo. El Explorador sí importa y Prisma no. Paint muestra el aviso «Abrir» durante el gesto desde Prisma, pero el archivo no aparece al soltar.
- Registro temporal y prueba nativa del objeto Shell: `QueryGetData(CF_HDROP)` devuelve `S_OK`; `GetData` contiene una ruta, idéntica a la ruta absoluta de `Power.png`; `EnumFormatEtc` ofrece `CF_HDROP`; `IDataObjectAsyncCapability` inicia con modo asíncrono desactivado.
- Esta evidencia descarta una lista de rutas vacía en el objeto probado; aún no identifica la causa de la diferencia con Paint.
- Se amplió la máscara permitida de `COPY` a `COPY | LINK` para negociar apertura. El registro posterior observó un efecto `LINK` durante un gesto, pero no identifica por sí solo el receptor ni demuestra importación en Paint.
- Biglex confirmó posteriormente que la recepción desde Prisma también funciona en Krita. Pidió no prolongar la investigación por Paint; se conserva esa diferencia como límite específico, sin atribuir su causa exclusivamente al receptor.
- El registro temporal se retiró del código al terminar; su historial queda en `temp/native-drag-paint.log`, ignorado por Git.
- Harness temporal `temp/drag-paint-check` con el código real de Windows: 2 pruebas correctas (ruta/formatos Shell y bitmap BGRA). Tras retirar el registro, `cargo check --offline --manifest-path src-tauri/Cargo.toml` y `git diff --check` fueron correctos. Estas comprobaciones no sustituyen la recepción manual en Paint.
