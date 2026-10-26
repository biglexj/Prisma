# Alcance autorizado

Biglex pide que la zona de recepción deje de ser una pieza dentro de Prisma y pase a ser **del sistema entero**, utilizable desde el Explorador de archivos o cualquier otra aplicación. Después concreta el espacio: una **bóveda** con **tres elementos** como máximo, uno de ellos **fijable** (el fijado va siempre al principio y no se expulsa), un **portapapeles** que **permanece** ahí, con un botoncito encima de cada elemento para **enviarlo al teléfono** y para **guardarlo en una carpeta**, y la posibilidad de **arrastrar el elemento fuera** hacia el Explorador, donde se hace una copia. También pide que en la configuración se pueda **activar y desactivar**, con la carpeta de destino definida ahí. Y finally, ensanchar la franja a 80 píxeles.

Implementación autorizada por esa solicitud, sin publicación, sin cambio de versión y sin tocar el trabajo en curso de otros agentes (instalador, audio relay, historial y favoritos, Quick Look y tema).

Decisiones tomadas al implementar, con criterio propio y sujetas a la revisión de Biglex:

- La bóveda guarda **hasta tres** elementos; cuando entra un cuarto se expulsa el más antiguo que no esté fijado. Solo puede haber uno fijado a la vez, tal como se pidió.
- La ventana flotante se dimensiona sola: 80 × 3 px replegada y la estantería cuando hay elementos.
- El estado de la bóveda vive en el backend (`vault.json` en la carpeta de datos), para que la ventana flotante y la principal compartan la misma lista y para que sobreviva a un reinicio.
- La copia a la carpeta de destino no pisa el archivo existente: añade «(1)».
- El destino por defecto es `Descargas\Prisma`, configurable en Configuración → General y Sistema.

Validación final del comportamiento de arrastre con el ratón pendiente de Biglex.


## Alcance actualizado por Biglex — 2026-10-22

La solicitud actual autoriza ampliar la implementación a un notch que se despliega por proximidad, cinco espacios, fijado/temporal/teléfono y conexión con capturas. Se interpreta el selector como izquierda = fijar, centro = temporal y derecha = teléfono, conforme al orden funcional descrito. La dirección posterior de Biglex limita los fijados a dos y hace que capturas y archivos llenen de izquierda a derecha las cinco casillas compartidas, sin reservar una para capturas. Al llenarse, sale el más antiguo no fijado y el nuevo entra al final. El mensaje «y del otro también» autoriza aplicar esta política ya debatida.

El build y las pruebas técnicas no constituyen aprobación humana ni demuestran recepción en un teléfono. Las comprobaciones de esta ampliación se registran por separado de las afirmaciones del informe anterior. No se publica ni cambia la versión.
