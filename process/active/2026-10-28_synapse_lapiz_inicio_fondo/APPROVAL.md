# Estado

Alcance autorizado en la conversación: problemas de reconocimiento del lápiz en Synapse y espera de preparación del escritorio para el fondo, tras confirmar Biglex que detenerlo y reiniciarlo recupera el tamaño.

Validación técnica correcta: build frontend y pruebas de arrastre, Synapse y espera de escritorio. Aceptación funcional con la tableta y durante el inicio de Windows pendiente; no atribuida a Biglex. No se ha publicado ni instalado una versión.

REWORK del arrastre: Biglex instaló la compilación del 28 de octubre y confirmó que el lápiz seguía sin iniciar correctamente el arrastre y producía duplicados. En Dev indica que ocurre solo con el lápiz; el mouse funciona. La captura de puntero anterior no resolvió el problema. Segunda corrección en validación; no considerar aceptado el arrastre externo hasta probarlo con su tableta.

La espera del evento de mouse compatible tampoco superó la prueba manual. Se reemplazó por conversión nativa antes de OLE. Biglex pidió además miniatura real cuadrada en el arrastre de imágenes desde Synapse. Ambos cambios están pendientes de aceptación visual y con lápiz; ninguna prueba unitaria demuestra su funcionamiento con el dispositivo.

REWORK confirmado también para la conversión nativa: el lápiz sigue sin arrastrar aunque la conversión devuelve true en el registro de Dev. No declarar resuelto el arrastre. La barra permaneció abierta, pero la recompilación la cerró antes de verificar la recuperación con Esc.
