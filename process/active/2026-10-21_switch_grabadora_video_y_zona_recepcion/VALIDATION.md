# Validación

## Comprobado en esta sesión

- **Grabación real con el FFmpeg que ya viaja con Prisma** (`src-tauri/vendor/ffmpeg`, FFmpeg 9.0.2 con `gdigrab` y `libx264`): clip de 3 s a 640×360 y 30 fps, `ffprobe` confirma H.264 en MP4 con 88 fotogramas y duración 3,000 s.
- **Parada elegante**: escribiendo `q` en la entrada estándar de FFmpeg el archivo se cierra y queda reproducible (3,13 s, 93 fotogramas, `duration=3.133008`). Matar el proceso dejaría el MP4 sin índice; por eso la parada pasa por `q` y no por `kill`.
- **Prueba nativa de la grabadora** (`cargo test --lib recorder`): 4 pruebas superadas, incluida una grabación completa de extremo a extremo —inicio, estado, parada, archivo existente y con contenido— sobre 320×240 a 15 fps. Si el entorno no tiene escritorio, la prueba se omite con aviso en lugar de fallar.
- **Tipos del frontend**: `bun run compile:check` (`tsc --noEmit`) sin errores.
- **Pruebas del frontend**: `bun test tests/` — 61 pruebas superadas, 0 fallidas, incluidos los archivos nuevos del enrutador de arrastre y de las preferencias de grabación.
- **Compilación del backend**: `cargo check --lib` sin errores; se añadió el rasgo `Win32_System_SystemInformation` para leer la hora local del sistema con la que se nombra el vídeo.

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
