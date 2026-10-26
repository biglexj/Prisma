# Pie de la barra lateral completo («Acerca de» sin recorte)

Fecha: 2026-10-23. Estado: ejecutado.

## Alcance autorizado

Biglex señala el botón «Acerca de» del pie de la barra lateral en Prisma (Dev) y pide: «dale un margen o padding inferior al botón».

## Diagnóstico

El recorte no era solo de espaciado: la rejilla principal `.studio-shell` no fijaba la altura de su fila, de modo que la fila se dimensionaba por el contenido de la barra lateral (marca + navegación completa + pie). Con una ventana de 1080 px y la escala de Windows, esa suma supera la altura útil, la barra lateral crece por debajo del borde y el botón «Acerca de» queda cortado —la propia `.studio-shell` recorta con `overflow: hidden`—.

## Implementación

- `src/app/styles.css`: `.studio-shell` declara `grid-template-rows: minmax(0, 1fr)`, de manera que la fila mide exactamente la ventana. La navegación (`.sidebar-navigation`, con `flex: 1` y `overflow-y: auto`) es la que desliza, y el pie queda siempre visible y completo. La regla móvil de ≤ 580 px, que define sus propias dos filas, se mantiene.
- `src/app/ui/app-sidebar.css`: el pie `.sidebar-footer` suma aire inferior en las cuatro densidades —14 px en la estándar, 10 px en compacta, 14 px en intermedia y 18 px en cómoda— para que el último botón no quede pegado al borde inferior de la ventana.

## Límites

No se cambia el comportamiento de la navegación, ni las densidades, ni el resto del pie. No se toca la altura de las ventanas ni el escalado del sistema.
