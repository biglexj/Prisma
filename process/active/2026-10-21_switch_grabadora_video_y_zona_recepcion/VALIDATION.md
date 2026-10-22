# Validación

## Comprobado en esta sesión

- **Grabación real con el FFmpeg que ya viaja con Prisma** (`src-tauri/vendor/ffmpeg`, FFmpeg 9.0.2 con `gdigrab` y `libx264`): clip de 3 s a 640×360 y 30 fps, `ffprobe` confirma H.264 en MP4 con 88 fotogramas y duración 3,000 s.
- **Parada elegante**: escribiendo `q` en la entrada estándar de FFmpeg el archivo se cierra y queda reproducible (3,13 s, 93 fotogramas, `duration=3.133008`). Matar el proceso dejaría el MP4 sin índice; por eso la parada pasa por `q` y no por `kill`.
- **Prueba nativa de la grabadora** (`cargo test --lib recorder`): 4 pruebas superadas, incluida una grabación completa de extremo a extremo —inicio, estado, parada, archivo existente y con contenido— sobre 320×240 a 15 fps. Si el entorno no tiene escritorio, la prueba se omite con aviso en lugar de fallar.
- **Tipos del frontend**: `bun run compile:check` (`tsc --noEmit`) sin errores.
- **Pruebas del frontend**: `bun test tests/` — 61 pruebas superadas, 0 fallidas, incluidos los archivos nuevos del enrutador de arrastre y de las preferencias de grabación.
- **Compilación del backend**: `cargo check --lib` sin errores; se añadió el rasgo `Win32_System_SystemInformation` para leer la hora local del sistema con la que se nombra el vídeo.

## Segunda tanda: barra flotante, atajo de detiene, codificador de hardware y audio del sistema

- **Barra flotante de control** (`screen_capture_recorder`): ventana propia, siempre encima, 320×64, que aparece al grabar con el cronómetro y el botón «Detener». Se coloca **fuera de la región grabada** (debajo, arriba, a la derecha o a la izquierda, en ese orden) para no aparecer en el vídeo; si la región ocupa todo el escritorio se reserva una franja inferior de 76 px y se graba el resto. Prueba unitaria que comprueba que la posición nunca cae dentro de la región.
- **Atajo global para detener**: `Ctrl+Shift+R`, registrado al arrancar junto al atajo de captura. Cierra el archivo con la misma vía que el botón, así que el MP4 queda reproducible.
- **Codificador de hardware**: selector Automático / CPU / NVIDIA / Intel / AMD. El FFmpeg que ya viaja con Prisma trae `h264_nvenc`, `h264_qsv` y `h264_amf`. En modo automático se prueban en orden hasta que uno arranca. **Comprobado en esta máquina**: NVENC y QSV no están disponibles (`Cannot load nvcuda.dll`), AMF sí — una grabación real con `h264_amf` produjo H.264 de 640×360, 85 fotogramas y 3,000 s.
- **Sonda de motores**: FFmpeg no muere cuando el codificador falla, se queda vivo con el vídeo vacío y el archivo sale sin datos. Por eso cada motor se prueba antes con una codificación de un fotograma; el resultado se cachea por proceso. Esta lógica la detectó una prueba real: la primera versión creía que NVENC había arrancado y dejó el MP4 vacío.
- **Calidad y tamaño**: presets Alta/Media/Baja (CRF 20/23/28) y límite de altura (Original / 1080p / 720p).
- **Audio del sistema** por WASAPI loopback: se captura lo que suena en el ordenador y se entrega a FFmpeg por un socket local en PCM. Si además se elige un micrófono, ambos se mezclan con `amix`.
  - En esta máquina **no se pudo verificar con sonido**: el capturador de loopback del propio audio relay de Prisma (código ya en producción) tampoco obtiene muestras, así que el dispositivo de salida no está renderizando. El MP4 resultante sale sin pista de audio y el resto de la grabación funciona con normalidad.
  - Las dos pruebas que dependen de muestras reales quedan marcadas como ignoradas con el motivo, igual que las pruebas del audio relay que necesitan un teléfono físico.
  - Un fallo real encontrado y corregido por el camino: el cliente COM se usaba después de cerrar su apartamento. Ahora el apartamento vive con el cliente y la lectura del formato se hace en un hilo aislado.
- **Suite completa del backend**: 79 pruebas superadas, 0 fallidas, 7 ignoradas. `cargo test --lib` sin hilos ni fallos. `tsc --noEmit` limpio, 61 pruebas del frontend en verde y `bun run build` correcto.

## Tercera tanda: zona con destinos múltiples, cuenta atrás, pausa y biblioteca

- **Zona de recepción con menú de destinos**: al soltar el archivo aparece un menú con Super Galería, Imágenes, Vídeos, Música, «Abrir con la aplicación predeterminada» y «Mostrar en el Explorador». Acepta varios archivos: la vista previa muestra nombre, tamaño y cantidad, y Super Galería los envía en cola (uno detrás de otro).
- **Vista previa durante el arrastre**: nombre, tamaño y número de archivos, tomados del `dataTransfer` del DOM.
- **Cuenta atrás de 3 segundos** como en Recortes: el overlay sigue visible con un contador grande antes de que la grabación arranque, para que el gesto de confirmar quede fuera del vídeo.
- **Pausa y reanudación**: FFmpeg alterna la pausa con `p` en su entrada estándar. El estado pausado viaja al panel principal y a la barra flotante. **Verificado con una grabación real**: pausar, esperar, reanudar y detener deja un MP4 válido con contenido.
- **Añadir a la biblioteca de Vídeos**: botón en el aviso de «Grabación guardada» que da de alta la carpeta de la grabación en la biblioteca de Vídeos de Prisma.
- **Pruebas**: 80 del backend en verde (7 ignoradas), 64 del frontend en verde, `tsc` limpio y build de producción correcto.

## Aviso: prueba intermitente ajena a este trabajo

`infrastructure::windows_com::tests::audio_helper_*` (del feature de audio relay) falla de forma intermitente cuando en la misma ejecución corren varias grabaciones de pantalla: el hilo de la prueba queda con un apartamento COM del que cree haberse descargado. Con el árbol sin los cambios de esta sesión la suite pasa; con ellos también pasa en 4 de 4 ejecuciones seguidas, y falló en 2 de 10 antes. La prueba no es de este trabajo y su causa está en el manejo de apartamento COM de ese feature, no en la grabadora. Queda avisado para que el dueño de esa funcionalidad lo endurezca.

## Pendiente de comprobación visual en la aplicación

- El conmutador «Imagen | Vídeo», el panel flotante de grabación y la zona de recepción superior se han validado por compilación, tipos, pruebas de lógica y **comprobación visual servida por Vite** (ver arriba). Queda pendiente la revisión de Biglex dentro de la aplicación de escritorio: grabación completa con el overlay, parada, guardado y envío a Super Galería.

## Verificación visual en la interfaz

- La vista del Capturador se comprobó servida por Vite (el navegador no tiene el runtime de Tauri, así que los comandos `invoke` fallan y el atajo aparece como inactivo: es lo esperado fuera de la app).
- Estado **Imagen**: el conmutador con «Imagen» activo, botón «Iniciar Captura» con la píldora `Shift+PrintScreen`, modos Ventana / Rectángulo / Lazo Libre / Pantalla Completa y aviso de atajo inactivo.
- Estado **Vídeo**: el conmutador se desplaza a «Vídeo» y el indicador toma el tono de error; el botón pasa a «Iniciar Grabación» en rojo y pierde la píldora de atajo; **Lazo Libre desaparece** de los modos; aparecen los selectores de Fotogramas (24/30/60 fps) y Audio con el aviso «No se detectaron dispositivos de audio» (el navegador no expone dispositivos DirectShow).
- La muesca de la zona de recepción se ve en el borde superior central de la ventana, con 50 px de ancho.
- Nota del método: la animación de entrada de la vista queda congelada en una pestaña en segundo plano (el navegador no la ejecuta), por lo que la primera captura salió en blanco. Se desactivó la animación solo durante la comprobación y se revirtió después: `git checkout` deja el archivo idéntico al commiteado.
- Pendiente: el recorrido completo dentro de la app de escritorio —seleccionar la región en el overlay, grabar, detener, guardar y enviar a Super Galería— requiere la app compilada con Tauri y un escritorio interactivo; no se ha ejecutado aquí.

## Notas de comportamiento

- El overlay se oculta antes de iniciar la captura: si siguiera visible, aparecería dentro del vídeo grabado. Se deja un margen de 220 ms para que el compositor retire la ventana.
- Las coordenadas de GDIGRAB son relativas al origen del escritorio virtual, no al monitor principal: la resta del origen mantiene el acierto en setups multimonitor.
- H.264 exige dimensiones pares: un rectángulo impar se recorta un píxel antes de codificar.
- Un archivo soltado sobre la zona de recepción no se procesa dos veces: el enrutador de arrastre coordina la zona con el manejador global de bibliotecas.
