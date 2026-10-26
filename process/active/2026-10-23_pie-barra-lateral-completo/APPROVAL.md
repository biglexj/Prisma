# Alcance y decisiones — Pie de la barra lateral completo

Fecha: 2026-10-23. Estado: ejecutado según instrucción del usuario.

## Autorización e instrucción

Biglex envía una captura de la Configuración de Prisma (Dev) en la que el botón «Acerca de» del pie de la barra lateral queda cortado por el borde inferior de la ventana, y pide: «dale un margen o padding inferior al botón».

## Decisiones

- La petición es de espaciado, pero el origen del recorte es de layout: la fila de la rejilla principal no tenía altura declarada y se dimensionaba por contenido, así que la barra lateral crecía por debajo de la ventana. Añadir solo padding al pie habría empujado el botón todavía más hacia fuera, sin resolverlo.
- Por eso se hace ambas cosas: fijar la fila a la altura de la ventana —de modo que el pie queda siempre visible y es la navegación la que desliza— y añadir el aire inferior que se pedía, en las cuatro densidades para que no se corte ninguna.
- No se toca el resto del pie ni el comportamiento de la navegación, y se respeta la regla móvil de ≤ 580 px, que define sus propias filas.

## Verificación técnica

- `bun run build` correcto, con el CSS compilado conteniendo la nueva fila de la rejilla y los cuatro rellenos del pie.

## Lo que este proceso no cubre

No se publica versión, no se genera instalador y no se modifica la altura mínima de la ventana. La aceptación visual del pie queda pendiente de la app en ejecución.
