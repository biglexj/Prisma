# Propuesta de capacidades adicionales

Ordenado por relación entre valor y esfuerzo. Todas las opciones son compatibles con lo ya construido: no rehacen la grabadora ni la zona de recepción, las amplían.

## Nivel 1 — barato y de alto valor

- **Audio del sistema por WASAPI loopback.** Prisma ya captura el audio del sistema en `audio_relay`: se canaliza ese PCM a FFmpeg por una segunda entrada (`-f s16le -ar 48000 -ac 2 -i pipe:0`) y se mezcla. Es lo que más se parece a Recortes y evita pedir un cable de audio virtual al usuario.
- **Micrófono simultáneo.** Segunda entrada de DirectShow y `amix` con el audio del sistema: ambas fuentes en un solo MP4.
- **Códec de hardware.** El FFmpeg que ya viaja con Prisma incluye `h264_nvenc`, `h264_qsv` y `h264_amf`. Con un selector «Automático / CPU / NVIDIA / Intel / AMD» la grabación deja de consumir CPU y sube de 30 a 60 fps con soltura.
- **Calidad en vez de solo fotogramas.** CRF con tres presets (Alta / Media / Baja) y escala opcional (Original / 1080p / 720p), que es lo que la gente realmente ajusta.
- **Barra flotante de control** como la de Recortes: una ventana pequeña siempre encima, colocada fuera de la región grabada, con cronómetro y «Detener». Hoy el control vive en la ventana principal: si Prisma está en bandeja, no hay forma de detener la grabación.
- **Atajo global para detener** (por ejemplo `Ctrl+Shift+R`) y un segundo atajo de captura (`Ctrl+Shift+Impr Pant`) que abra directamente la grabación, sin pasar por el conmutador.
- **Cuenta atrás de 3 segundos** antes de empezar, y «repetir» la misma región sin volver a seleccionarla.

## Nivel 2 — capacidad de verdad

- ~~**Destinos múltiples en la zona de recepción.**~~ **Hecho, pero con otro forma:** la zona del sistema es ahora una bóveda de tres elementos con acciones por elemento (enviar al teléfono, guardar copia, fijar, quitar) y arrastre hacia fuera. Ver `process/active/2026-10-22_boveda_flotante_del_sistema`.
- ~~**Vista previa al arrastrar.**~~ **Hecho:** miniatura, nombre y tamaño sobre la tarjeta, tanto en la estantería como durante el arrastre.
- **Archivos múltiples y cola.** Aceptar N archivos y enviarlos todos, con progreso, en lugar de tomar solo el primero. La bóveda ya acepta varios; falta la cola de envío con progreso hacia el teléfono.
- **Grabación al terminar en la biblioteca.** El MP4 aparece solo en Prisma → Vídeos, y desde ahí a Super Galería con un clic.
- **Recorte sin recodificar.** Marcar entradas y salidas sobre el MP4 y recortar con `-c copy`: instantáneo y sin pérdida de calidad.
- **Captura por ventana (HWND).** Grabar una ventana concreta por su identificador en vez de por región, con seguimiento si se mueve.
- **Pausa y reanudar** durante la grabación, escribiendo `p` al estándar de FFmpeg.

## Nivel 3 — saltos mayores

- **Windows Graphics Capture** en lugar de GDIGRAB: captura por DWM, más eficiente y con menos desajuste en superficies aceleradas. Es una reescritura del origen de frames, no de la interfaz.
- **Subtítulos automáticos** sobre el MP4, con el modelo de voz que ya usa el proyecto.
- **Marcadores dentro de la grabación** (capítulo) para después recortar por momentos.
- **Zoom en vivo** de la región grabada, al estilo del zoom de OBS.

## Zona de recepción: ajustes

- Posición configurable (arriba centro, abajo centro, esquina) y opción de ocultarla.
- Integración con Quick Look: soltar un archivo abre el visor antes de decidir el destino.
- Arrastrar desde dentro de Prisma hacia la zona: un fotograma de un vídeo, una captura recién hecha, un texto: todo hacia Super Galería sin salir de la aplicación.
