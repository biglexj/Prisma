# Estado

## Decisión vigente — 2026-10-28

REWORK: Biglex exige que Synapse funcione con Windows Ink activado y desactivado. La prueba con Ink desactivado confirmó una mitigación para Explorador, entrada y salida de Synapse, pero no constituye aceptación de la solución final. Se restauró Windows Ink activado en XPPen y se verificó visualmente la casilla. No reintroducir la conversión nativa retirada. La prueba no valida presión/inclinación de las aplicaciones de dibujo ni otros controladores.

La aceptación del tamaño del fondo durante el inicio de Windows sigue pendiente. No cerrar el proceso completo ni atribuir una instalación/publicación nueva a esta validación.

## Historial de decisiones

Alcance autorizado en la conversación: problemas de reconocimiento del lápiz en Synapse y espera de preparación del escritorio para el fondo, tras confirmar Biglex que detenerlo y reiniciarlo recupera el tamaño.

Validación técnica correcta: build frontend y pruebas de arrastre, Synapse y espera de escritorio. Aceptación funcional con la tableta y durante el inicio de Windows pendiente; no atribuida a Biglex. No se ha publicado ni instalado una versión.

REWORK del arrastre: Biglex instaló la compilación del 28 de octubre y confirmó que el lápiz seguía sin iniciar correctamente el arrastre y producía duplicados. En Dev indica que ocurre solo con el lápiz; el mouse funciona. La captura de puntero anterior no resolvió el problema. Segunda corrección en validación; no considerar aceptado el arrastre externo hasta probarlo con su tableta.

La espera del evento de mouse compatible tampoco superó la prueba manual. Se reemplazó por conversión nativa antes de OLE. Biglex pidió además miniatura real cuadrada en el arrastre de imágenes desde Synapse. Ambos cambios están pendientes de aceptación visual y con lápiz; ninguna prueba unitaria demuestra su funcionamiento con el dispositivo.

REWORK confirmado también para la conversión nativa: el lápiz sigue sin arrastrar aunque la conversión devuelve true en el registro de Dev. No declarar resuelto el arrastre. La barra permaneció abierta, pero la recompilación la cerró antes de verificar la recuperación con Esc.

RETIRADO: Biglex confirmó después que ni arrastraba ni se recuperaba con Esc y que la aplicación quedó blanca/sin responder. Se cerró exclusivamente la Dev bloqueada y se restauró vendor/drag al estado anterior a estos experimentos. El arrastre saliente de Synapse con lápiz queda deshabilitado temporalmente con aviso; mouse, miniatura y protección de duplicados se conservan. No es una resolución funcional del lápiz.

Nuevo intento autorizado por Biglex: reutilizar el controlador de contactos de la capturadora. Implementado de forma compartida, con consulta de entrada existente antes de OLE y sin la conversión nativa retirada. El lápiz vuelve a poder iniciar el recorrido si Windows confirma una pulsación. Pendiente de aceptación funcional con su tableta; no declarar resuelto a partir de las 20 pruebas o la compilación.
