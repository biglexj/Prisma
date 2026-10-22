# Validación

## Comprobado en esta sesión

- **Grabación real con el FFmpeg que ya viaja con Prisma** (`src-tauri/vendor/ffmpeg`, FFmpeg 9.0.2 con `gdigrab` y `libx264`): clip de 3 s a 640×360 y 30 fps, `ffprobe` confirma H.264 en MP4 con 88 fotogramas y duración 3,000 s.
- **Parada elegante**: escribiendo `q` en la entrada estándar de FFmpeg el archivo se cierra y queda reproducible (3,13 s, 93 fotogramas, `duration=3.133008`). Matar el proceso dejaría el MP4 sin índice; por eso la parada pasa por `q` y no por `kill`.
- **Prueba nativa de la grabadora** (`cargo test --lib recorder`): 4 pruebas superadas, incluida una grabación completa de extremo a extremo —inicio, estado, parada, archivo existente y con contenido— sobre 320×240 a 15 fps. Si el entorno no tiene escritorio, la prueba se omite con aviso en lugar de fallar.
- **Tipos del frontend**: `bun run compile:check` (`tsc --noEmit`) sin errores.
- **Pruebas del frontend**: `bun test tests/` — 61 pruebas superadas, 0 fallidas, incluidos los archivos nuevos del enrutador de arrastre y de las preferencias de grabación.
- **Compilación del backend**: `cargo check --lib` sin errores; se añadió el rasgo `Win32_System_SystemInformation` para leer la hora local del sistema con la que se nombra el vídeo.

## Pendiente de comprobación visual en la aplicación

- El conmutador «Imagen | Vídeo», el panel flotante de grabación y la zona de recepción superior se han validado por compilación, tipos y pruebas de lógica, pero **no se han visto todavía dentro de la aplicación en ejecución**. Queda pendiente la revisión visual del conmutador, de la muesca de 50 × 3 px, de la animación de recepción y del recorrido completo: grabar → detener → guardar → enviar a Super Galería.

## Notas de comportamiento

- El overlay se oculta antes de iniciar la captura: si siguiera visible, aparecería dentro del vídeo grabado. Se deja un margen de 220 ms para que el compositor retire la ventana.
- Las coordenadas de GDIGRAB son relativas al origen del escritorio virtual, no al monitor principal: la resta del origen mantiene el acierto en setups multimonitor.
- H.264 exige dimensiones pares: un rectángulo impar se recorta un píxel antes de codificar.
- Un archivo soltado sobre la zona de recepción no se procesa dos veces: el enrutador de arrastre coordina la zona con el manejador global de bibliotecas.
