# Plan: Perfeccionamiento de Picture-in-Picture (PiP), Dimensiones y Retorno

## Objetivo
Resolver y perfeccionar el comportamiento de Picture-in-Picture (PiP) para vídeos verticales y horizontales:
1. **Cálculos de Dimensiones Proporcionadas**:
   - Acotar las dimensiones temporales aplicadas al `<video>` antes de solicitar PiP a un tamaño base armónico (máx 440px), evitando que vídeos 1080x1920 (vertical) o 4K (3840x2160) generen ventanas flotantes gigantescas que cubren toda la pantalla.
   - Restaurar limpiamente los estilos CSS del `<video>` (`width: ""`, `height: ""`) tras la solicitud de PiP.
2. **Retorno a Pantalla Completa del Reproductor al Salir de PiP**:
   - Al salir de PiP (mediante el botón «Volver a la pestaña» de la ventana flotante del SO o mediante el botón de la app), retornar de inmediato a la vista del reproductor a pantalla completa (`activeView = "video_player"`), conservando el estado y la posición del vídeo sin desmontar la sesión ni dejar la pantalla vacía.
3. **Reemplazo de Vídeo en PiP mientras se navega en la Galería**:
   - Si el usuario reproduce un nuevo vídeo desde la galería mientras PiP está activo, mantener al usuario en su vista actual y reemplazar fluidamente el vídeo dentro de la ventana flotante de PiP.
4. **Contenedor en Segundo Plano Sin `display: none`**:
   - Mantener el contenedor del reproductor montado y visible para el compositor de Chromium sin `display: none` cuando está en PiP, evitando artefactos y pantallas en blanco.
