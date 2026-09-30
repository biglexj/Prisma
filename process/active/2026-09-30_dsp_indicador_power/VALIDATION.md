# Validación

- Causa visual confirmada: POWER ON mezclaba `var(--primary)` con rosa fijo `#e91e63`, un halo de 20 px y un punto verde con sombra de 8 px.
- Nuevo tratamiento: borde de acento, fondo tonal al 8 %, sombra interior tenue; punto del mismo color con opacidad entre 0.65 y 1, sin cambio de tamaño.
- POWER ON y BYPASS conservan su acción. No se modificó el procesamiento de audio.
- `bun run build`: TypeScript y Vite correctos, 277 módulos; advertencia preexistente sobre tamaño del bundle.
- `git diff --check`: sin errores de espacios. Diff limitado al aspecto del botón y su estado accesible.
- Confirmación visual en la aplicación pendiente.
