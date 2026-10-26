# Alcance autorizado

Biglex describe el problema con su propia experiencia en el capturador: a veces solo quiere «capturar y ya está», sin la secuencia de clic, garabato y confirmaciones. Su modelo explícito es:

- Se selecciona **el área, la ventana o el rectángulo**.
- `Ctrl+C` → **captura automática y copia**, sin escribir y sin abrir las pestañas de edición.
- `Enter` o clic encima → **eso sí activa** la edición.

Implementación autorizada por esa solicitud, sin publicación, sin cambio de versión y sin tocar el trabajo en curso de otros agentes (instalador, audio relay, bóveda, notch Synapse).

## Decisiones tomadas al implementar

- **La selección sobrevive al gesto.** Retirar la confirmación automática al soltar el ratón era indispensable: sin eso, el rectángulo desaparecía y el overlay ya mostraba la barra de edición antes de que hubiera forma de pulsar `Ctrl+C`. Por eso `Enter`, el clic y el doble clic quedan como las vías explícitas de edición, tal como las describe Biglex.
- **Una sola fuente de verdad.** Enter y `Ctrl+C` resuelven la selección con el mismo helper, de modo que nunca capturan zonas distintas ni queda código duplicado por modo.
- **La copia rápida conserva el contrato de Synapse.** `Ctrl+C` usa la misma ruta que el botón *Copiar*: portapapeles y registro en la rotación de Synapse. No se guardan archivos residuales ni se pide carpeta.
- **Fuera de alcance por diseño**: el selector de color (copia el hexadecimimal, no una imagen) y las sesiones de grabación de vídeo, donde la captura es una grabación.
- **Pistas visibles**: los distintivos de la selección ahora anuncian «Clic, Enter o Ctrl+C para capturar», para que el atajo sea descubrible sin manual.

## Pendiente de Biglex

Confirmar en la aplicación real que `Ctrl+C` copia la captura y cierra el overlay, y que la selección permanece tras arrastrar el rectángulo o trazar el lazo. Las comprobaciones automatizadas no sustituyen ese recorrido.

No se publica ni se cambia la versión con este ajuste.
