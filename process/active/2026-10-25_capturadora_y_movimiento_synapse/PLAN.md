# Capturadora y movimiento Synapse

Alcance autorizado por Biglex: pulir las transiciones de captura y la barra superior de Synapse. Ampliación: barra de selección compacta basada en las referencias proporcionadas, con imagen/vídeo, tipos de recorte en una pill y cuentagotas.

- Evitar animaciones nativas del escritorio congelado y retirar la ventana antes de limpiar el contenido.
- Unificar apertura/cierre de Synapse, esperar al tamaño nativo y añadir entrada escalonada y señal de actividad, con movimiento reducido.
- Alternar imagen/vídeo conservando la sesión original; mantener atajos y opciones compatibles.
- Validar compilación, pruebas pertinentes y comportamiento del componente en navegador; distinguirlo de la comprobación nativa.

Fuera del alcance: carátula de Música, publicación e instalación de una versión.

## Ampliación autorizada: barra de grabación y carpetas

- Barra de 380×56 lógicos, centrada abajo en el área útil del monitor de grabación, movible y con pausa/parada por iconos; cronómetro y estado sin resolución ni fps.
- Exclusión nativa de la ventana de control para conservar íntegra la región seleccionada, incluso al moverla.
- Capturas y fotogramas: Imágenes/Prisma. Grabaciones: Vídeos/Prisma. Crear las carpetas y mantener tres ajustes independientes, respetando las rutas personalizadas.
- Validar rutas, geometría, compilación Rust/web y pausa/parada del componente con IPC simulado. La exclusión en un vídeo real y el arrastre físico requieren prueba nativa.

## Ampliación autorizada: guardar/localizar en Synapse

Las tarjetas sin ubicación del usuario muestran el icono de disquete. Al guardar, la misma tarjeta conserva su identificador, fijado y orden, registra la ubicación exportada y cambia a carpeta. Los archivos importados conservan su ruta original aunque Synapse use una copia interna. La carpeta abre la ubicación del archivo correspondiente; la caché interna no se presenta como un guardado del usuario.

## Corrección del vídeo negro y barra de 150 px

Grabar la región visible seleccionada desde el escritorio, sin captura directa por título ni sustitución por dimensiones cliente. Mantener la ventana visible y en su posición. Reducir ambas barras activas a 150×42 y retirar el mínimo global de 320 px únicamente en la ventana de grabación.

## Ocultar controles y guardar durante la grabación

- Mantener 320×56; colocar el estado como continuación del cronómetro, pausa por icono y Detener con texto.
- Ocultación manual y automática a los cinco segundos de aparecer; volver a mostrar desde la bandeja reinicia esos cinco segundos.
- Ctrl+S global solo durante la grabación, liberado al guardar o cancelar. Conservar Ctrl+Mayús+R y añadir en la bandeja Detener y guardar / Mostrar controles. Si Ctrl+S está ocupado, no anunciarlo en la etiqueta de la bandeja y mantener las otras vías.

## Plan pendiente: dibujar durante la grabación (sin implementar)

1. Revisar las herramientas existentes del editor y separar sus trazos, colores, grosor y deshacer para reutilizarlos.
2. Diseñar una capa transparente alineada con la región grabada, con modo dibujar y modo interactuar para seguir usando las aplicaciones.
3. Definir cómo incluir los trazos en el vídeo y excluir la barra de herramientas, contemplando escala de pantalla y varios monitores.
4. Validar latencia de lápiz/ratón, borrado, pausa y cierre de grabación. Implementar esta fase únicamente cuando Biglex la solicite.

## Ampliación: texto y enlaces en Synapse y música en Inicio

- Pegado exclusivamente por Ctrl+V/paste con Synapse abierto. Conservar texto Unicode y saltos de línea; un enlace pegado se guarda como enlace sin descargarlo.
- Casillas estables: pegar sobre una casilla la utiliza; los fijados no se reemplazan. Fuera de una casilla se ocupa el primer hueco o se rota el temporal más antiguo. Migrar estados anteriores sin perder entradas.
- Previsualizar texto y enlaces dentro de la fila de tarjetas. Doble clic copia el contenido completo al portapapeles; no abre visores ni el navegador. Vista previa limitada a 16000 caracteres; copiar lee el archivo completo.
- Inicio muestra un pequeño reproductor conectado al controlador existente: carátula, título/artista, anterior, pausa/reanudación y siguiente; barras decorativas invertidas arriba, animadas solo al reproducir y respetando movimiento reducido. Sin música conserva las órbitas con los puntos centrados respecto al núcleo.
