# Tareas

- [x] Commit de resguardo del nuevo paradigma, limitado a la línea de captura para no tocar el trabajo en curso de otros agentes.
- [x] Confirmar que el FFmpeg que ya viaja con Prisma graba de verdad en esta máquina (GDIGRAB + libx264) antes de construir encima.
- [x] Backend `recorder.rs`: inicio, parada elegante con «q», estado, cancelación, dispositivos de audio DirectShow y nombres de archivo con hora local.
- [x] Comandos `screen_recorder_start|stop|status|cancel|list_audio_devices` y evento `prisma://recording-state` para todas las ventanas.
- [x] Sesión de captura con `intent` (`image` / `video`); el overlay limita los modos en vídeo.
- [x] Switch «Imagen | Vídeo» en Herramientas → Capturador, con indicador deslizante y ajustes de fotogramas y audio.
- [x] Panel flotante de grabación con cronómetro, parada y acciones para mostrar el archivo o enviarlo a Super Galería.
- [x] Zona de recepción superior central: muesca de 50 × 3 px, despliegue animado y envío por el sistema de transferencias.
- [x] Coordinación con el manejador global de arrastre para que el archivo no se procese dos veces.
- [x] Pruebas: tipos del frontend, pruebas unitarias del enrutador de arrastre y grabación real de extremo a extremo en Rust.
- [x] Documentación del proceso y commit final.
- [x] Barra flotante de control en ventana propia, colocada fuera de la región grabada.
- [x] Atajo global `Ctrl+Shift+R` para detener la grabación con Prisma en bandeja.
- [x] Codificador de hardware (NVENC/QSV/AMF) con modo automático y sonda de disponibilidad.
- [x] Calidad (CRF) y límite de tamaño del vídeo.
- [x] Audio del sistema por WASAPI loopback, con mezcla opcional del micrófono.
- [x] Suite completa del backend en verde y build del frontend correcto.
