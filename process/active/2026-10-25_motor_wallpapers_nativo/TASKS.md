# Tareas técnicas

Planificación en dos fases; implementación no iniciada.

## Fase 1 — vídeos de varias carpetas

- [x] Decidir alojamiento nativo (WorkerW / Progman) y validar sesión libmpv independiente del reproductor.
- [x] Implementar fuentes múltiples: añadir, habilitar/deshabilitar, actualizar por carpeta/todas y quitar solo el registro.
- [x] Persistir fuentes y ajustes en JSON atómico; normalizar rutas y evitar duplicados.
- [x] Construir cola conjunta con orden de carpetas y orden natural de archivos.
- [x] Implementar repetición continua, aleatorio por tandas y bucle para un único vídeo.
- [x] Integrar herramienta en la sección Herramientas de la barra lateral, configuración y vista nativa Material 3 Expressive.
- [x] Probar vídeo en vivo detrás de iconos en sesión interactiva de Windows (foco, Mostrar escritorio, Explorer, DPI y cierre limpio).
- [x] Eliminar pase a negro entre transiciones mediante playlist nativo libmpv (`prefetch-playlist=yes`, `cache=yes`, `demuxer-max-bytes=400M`, `keep-open=yes`, `auto-window-resize=no`).
- [x] Añadir control bidireccional de transporte (Anterior y Siguiente) con salto prefetcheado instantáneo.
- [x] Implementar cuadrícula de vídeos de 6 columnas con miniaturas nativas (`VideoThumbnail`), badges de formato y estado activo en pantalla.
- [ ] Validar flujo real con A/B/C y distribución nativa.

## Fase 2 — composición Aurora

- [ ] Revisar compositor Three.js, efectos, controles, recursos y consumidores vigentes de Aurora.
- [ ] Definir unidad de reutilización y mantenimiento sin duplicación divergente.
- [ ] Probar composición Aurora en superficie web detrás de iconos de Windows.
- [ ] Integrar capas y presets pertinentes; avatar opcional, sin requerir conversación ni cuenta.
- [ ] Compartir controles de fondo y garantizar exclusión entre vídeo y composición.
- [ ] Verificar pausa independiente, transparencia, cursor optativo, limpieza y recuperación de Explorer.
- [ ] Medir CPU/GPU/RAM y comprobar recursos locales/distribución antes de ampliar efectos.
