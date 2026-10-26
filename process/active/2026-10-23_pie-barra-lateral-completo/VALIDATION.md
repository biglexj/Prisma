# Validación

## Evidencia local (23/10/2026)

- `bun run build` (`tsc --noEmit` + `vite build`): **correcto**. La compilación incluye los cambios de CSS y no introduce errores de tipos.
- CSS compilado (`dist/assets/styles-*.css`): la regla base queda como `.studio-shell{display:grid;grid-template-columns:224px minmax(0,1fr);grid-template-rows:minmax(0,1fr);width:100%;height:100dvh;overflow:hidden;…}` y la regla móvil de ≤ 580 px conserva sus dos filas (`minmax(0,1fr) 70px`).
- Relleno del pie compilado: `.sidebar-footer{margin-top:auto;padding:8px 10px 14px;…}` en la densidad estándar y `padding:5px 7px 10px` en la compacta, con las variantes intermedia y cómoda ajustadas del mismo modo.

## Comportamiento conservado

- La navegación sigue desplazándose dentro de su propio contenedor (`.sidebar-navigation` conserva `flex: 1`, `min-height: 0` y `overflow-y: auto`); lo que cambia es que el alto disponible lo impone la ventana y no el contenido.
- El pie sigue anclado al fondo con `margin-top: auto`, de modo que «Configuración» y «Acerca de» quedan a la vista aunque la lista de apartados no quepa.
- La regla móvil de ≤ 580 px no se toca: en ese tamaño la barra lateral se oculta y la rejilla define sus propias filas.
- El contenido del área de trabajo sigue desplazándose en `.studio-content` (`height: calc(100% - var(--header-height))`).

## Límites de esta entrega

- **Sin aceptación visual**: no se levantó la ventana de Prisma para comprobar el resultado; la evidencia es de compilación y de inspección del CSS generado.
- No se modifica la altura mínima de la ventana ni el escalado de Windows, de modo que el comportamiento depende del tamaño real de la ventana.
- No se tocan el resto del pie, las densidades ni la navegación.
