# Favoritos Badge Hover y Menú Contextual — Validación

- Estado: `DONE`

## Comprobaciones

- [x] V01 — Compilación y tipado TypeScript: `bun run build` ejecuta sin errores (`tsc --noEmit && vite build`).
- [x] V02 — En `FavoritesView`, al pasar el puntero (hover) sobre tarjetas de música, imágenes o vídeos aparece el badge de corazón en la esquina superior derecha (`.favorites-card-fav-btn.is-favorite`).
- [x] V03 — Al hacer clic en el badge de corazón, el elemento se retira de favoritos inmediatamente y desaparece de la vista con feedback toast.
- [x] V04 — Al hacer clic derecho (anticlic) sobre cualquier tarjeta en `FavoritesView` y `FavoriteFullView`, se abre el menú contextual con opciones completas y "Quitar de favoritos".
- [x] V05 — Si un archivo fue movido o borrado del almacenamiento (como el vídeo de muestra), puede desmarcarse sin fallos ni bloqueos tanto desde el badge hover como desde el menú contextual.
- [x] V06 — Al reproducir un vídeo en modo PiP y pulsar la 'X' de la ventana principal, la ventana se oculta a la bandeja y el vídeo continúa reproduciéndose en la ventana flotante PiP sin pausarse.

## Registro de fallos

- Sin fallos técnicos detectados durante la verificación y compilación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
