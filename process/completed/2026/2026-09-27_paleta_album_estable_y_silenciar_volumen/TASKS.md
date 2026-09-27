# Tareas: Paleta de Álbum Estable y Botón Silenciar en Volumen (Panel Escuchar)

- [x] Implementar botón de silenciar/restaurar volumen interactivo en `PlaybackPreview.tsx` con icono dinámico (`volume-mute`/`volume`).
- [x] Conectar la tecla "M" y el clic del icono al mismo handler `handleToggleMute`.
- [x] Estabilizar la paleta de música en `App.tsx` para que persista mientras haya una canción seleccionada/cargada (sin saltar entre play y pausa).
- [x] Sincronizar el color de acento de la barra de progreso (`MediaProgressBar`) con `palette?.accent`.
- [x] Unificar estilos de botones activos (`shuffle`, etc.) y controles en `album-adaptive.css` bajo `.has-album-palette`.
- [x] Probar compilación con `bun run build`.
- [x] Registrar evidencias en `VALIDATION.md` y `APPROVAL.md`.
- [x] Mover proceso a `process/completed/2026/` y registrar commit de resguardo.
