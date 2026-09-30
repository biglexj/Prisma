# Validación

- Causa visual confirmada: POWER ON mezclaba `var(--primary)` con rosa fijo `#e91e63`, un halo de 20 px y un punto verde con sombra de 8 px.
- Primera propuesta: fondo tonal al 8 % y punto del acento. Biglex la rechazó visualmente por perder intensidad; aclaró que solicitó retirar las sombras exteriores, no el color del fondo.
- Corrección: restaurar el degradado original `var(--primary)` / `#e91e63`, texto blanco y punto verde; conservar `box-shadow: none` en botón y punto. La pulsación sigue limitada a la opacidad, sin halo exterior. El hover solo marca ligeramente el borde.
- POWER ON y BYPASS conservan su acción. No se modificó el procesamiento de audio.
- `bun run build`: TypeScript y Vite correctos, 277 módulos; advertencia preexistente sobre tamaño del bundle.
- `git diff --check`: sin errores de espacios. Diff limitado al aspecto del botón y su estado accesible.
- Confirmación visual en la aplicación pendiente.
- Refinamiento posterior: la mezcla verdosa en el extremo izquierdo también procedía del degradado `var(--primary)` / `#e91e63`. Se conserva el rosa intenso uniforme y se limita el verde al círculo: 10 px en lugar de 8 px, sin sombra ni animación de opacidad. No cambia su alineación dentro del botón.
