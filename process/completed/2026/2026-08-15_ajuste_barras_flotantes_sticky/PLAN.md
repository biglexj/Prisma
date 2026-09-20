# Plan: Ajuste de Distribución y Barras Flotantes (Sticky) en Todas las Secciones

## Contexto y Diagnóstico

Al desplazarse verticalmente en las vistas de biblioteca (`Música`, `Imágenes`, `Vídeos`), la barra de controles (`.visual-controls-bar`, `.music-controls-bar`) cuenta con `position: sticky; top: 0;`. Sin embargo, debido a que `.studio-content` posee un `padding-top` de hasta `24px` y márgenes horizontales no compensados:

1. **Hueco superior al flotar**: Al hacer scroll, la barra sticky se detiene a `24px` debajo de la cabecera principal (`.workspace-header`), dejando un espacio en blanco/vacío por el cual el contenido en scroll (imágenes, tarjetas) se asoma de forma antiestética.
2. **Desconexión visual**: La barra flotante queda como una píldora suspendida en el aire con bordes redondeados y huecos laterales, en lugar de apegarse limpiamente arriba como una extensión secundaria de la barra de herramientas.
3. **Comportamiento esperado**:
   - **En estado de reposo (no flotante)**: Debe respetar su espacio y margen inferior/superior respecto al encabezado de la sección, brindando aire y legibilidad adecuada (Material 3 Expressive).
   - **En estado flotante (sticky/scroll)**: Debe apegarse completamente arriba contra la base de `.workspace-header` (`0px` de espacio), extendiéndose a todo el ancho con fondo de vidrio esmerilado (`backdrop-filter`) y borde inferior nítido.

## Cambios Propuestos

### 1. Estructura de Espaciado Global (`src/app/styles.css`)
- Reubicar el `padding-top` del contenedor principal con scroll (`.studio-content`) hacia los encabezados individuales (`.visual-library-heading`, `.music-library-heading`, `.section-heading`, etc.).
- Asegurar que `.studio-content` tenga `padding-top: 0`, permitiendo que cualquier elemento `position: sticky; top: 0` se fije en la coordenada `0` absoluta del área visible.

### 2. Encabezados de Vistas
- Asignar `padding-top: clamp(14px, 2vw, 24px)` a los encabezados de página (`.visual-library-heading`, `.music-library-heading`, `.preview-heading`, `.home-welcome`, `.collections-view`, `.library-sources`) para mantener el espaciado intacto en reposo.

### 3. Barras de Controles Sticky (`visual-library.css`, `music-library.css`)
- Configurar `.visual-controls-bar` y `.music-controls-bar`:
  - `position: sticky; top: 0; z-index: 20;`
  - Márgenes horizontales negativos calculados (`calc(-1 * clamp(18px, 3vw, 38px))`) y relleno horizontal equivalente (`padding: 10px clamp(18px, 3vw, 38px)`).
  - Fondo `backdrop-filter: blur(24px)` con `color-mix` tonal y borde inferior `border-bottom: 1px solid var(--outline-variant)`.
  - Margen superior natural en reposo para separar del encabezado, que al hacer scroll se desplaza hasta tocar el borde superior.

### 4. Placeholder contextual en Barra Lateral (`AppSidebar.tsx`)
- Actualizar el placeholder de búsqueda para que sea coherente ("Buscar en Prisma…" o contextual a la sección activa).

## Criterios de Aceptación
- Al inicio de la página (scroll = 0), el encabezado y la barra de controles lucen con sus espacios y márgenes proporcionados.
- Al hacer scroll hacia abajo, la barra de controles se desliza suavemente hasta pegarse al borde superior exacto sin dejar ningún hueco por el que se filtren los elementos.
- La barra de controles abarca todo el ancho del lienzo con efecto de vidrio esmerilado uniforme.
- TypeScript y compilación pasan sin errores.
