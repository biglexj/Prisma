# Captura rápida con Ctrl+C

Biglex pide una captura «sin más»: cuando ya hay una zona seleccionada (el área, la ventana o el rectángulo), un `Ctrl+C` debe **copiar al instante** y cerrar el overlay, sin escribir, sin dibujar y sin que aparezca la barra de herramientas de edición. `Enter` o el clic sobre la selección siguen siendo la vía para **editar** esa misma zona.

## Modelo de interacción

La fase de selección deja de confirmar sola. Ahora la selección **queda viva** y de ella parten dos decisiones explícitas:

| Gesto | Resultado |
| --- | --- |
| `Ctrl+C` | Captura de la selección actual, copiada al portapapeles, overlay cerrado. Sin edición. |
| `Enter` o clic/doble clic sobre la selección | Abre la etapa de anotación sobre esa misma zona. |
| `Esc` | Cancela la captura. |

Esto obliga a retirar las confirmaciones automáticas que existían al soltar el ratón:

- Arrastrar un rectángulo ya no salta a la edición: el rectángulo queda seleccionado y se puede redimensionar.
- Trazar el lazo libre ya no salta a la edición: el trazo queda visible.
- Pulsar `F` o el botón *Pantalla completa* ya no captura de inmediato: solo resalta el monitor.

## Fuente única de verdad

Enter y `Ctrl+C` no pueden capturar zonas distintas. Ambos resuelven la selección con el mismo helper (`resolveSelection`), que devuelve el rectángulo y, en el lazo libre, el polígono de recorte:

- **Ventana**: la ventana bajo el cursor, o el control interno si se alternó la subregión con `Tab` o la rueda.
- **Rectángulo**: el rectángulo arrastrado (se descartan arrastres accidentales por debajo de 10 px).
- **Pantalla completa**: el monitor resaltado, con el primer monitor de la sesión como respaldo.
- **Forma libre**: el rectángulo que envuelve al lazo y su polígono relativo.
- **Selector de color**: no produce imagen, así que no hay nada que capturar.

## Copia

La captura se recorta en el backend a partir del fotograma congelado al iniciar la sesión (por eso el overlay nunca aparece en la imagen). El `data URL` PNG se convierte en binario sin pasar por el lienzo; solo el lazo libre necesita lienzo, porque recorta al polígono. La copia usa la ruta existente `copyToClipboard`, que además registra la imagen en la rotación de Synapse, igual que el botón *Copiar* de la barra de edición.

Fuera de la etapa de edición, `Ctrl+C` no aplica en el selector de color ni en una sesión de grabación de vídeo.
