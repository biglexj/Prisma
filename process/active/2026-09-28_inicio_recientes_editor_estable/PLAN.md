# Inicio reciente y editor de imagen estable

## Objetivo

Mostrar primero los archivos incorporados recientemente, permitir su arrastre nativo desde Inicio y completar el flujo de recorte, dibujo y marca de agua del editor. Corregir el bloqueo de DLL durante la recompilación de Prisma en desarrollo.

## Diseño

- Ordenar cada estante por la fecha más reciente entre creación y modificación; mostrar hasta 20 imágenes y canciones, y 12 vídeos, en carruseles horizontales.
- Hacer que la tarjeta completa de Inicio inicie el arrastre nativo, incluidos sus elementos visuales internos.
- Conservar el recorte como operación no destructiva: Enter alterna entre marco y vista previa; el guardado usa el recorte vigente.
- Al escoger una relación fija, recalcular el rectángulo centrado con el mayor tamaño que cabe en la imagen: tocar por completo el eje limitante y conservar la proporción exacta.
- Conservar la vista previa recortada al entrar en Dibujar y registrar los trazos en coordenadas de la imagen completa para que vista previa y exportación coincidan.
- Activar el pincel al entrar en Dibujar y permitir trazos incluso si hay un recorte pendiente.
- Situar el borde de la marca de agua al 1 % de cada esquina elegida y permitir moverla sobre la vista previa antes de guardar.
- Calibrar el logotipo con una escala independiente del texto; ofrecer cinco composiciones entre ambos y usar el mismo cálculo para vista previa, guardado y conversión.
- Ampliar el diálogo de marca a dos columnas sin desplazamiento en pantallas de escritorio: contenido y logotipo a la izquierda, posición y estilo a la derecha; conservar una columna en ventanas estrechas.
- Permitir soltar un archivo de logotipo desde el Explorador sobre su zona del diálogo, siguiendo el bus nativo del comparador; añadir color de texto y contorno configurable a la marca.
- En desarrollo, reutilizar las DLL y herramientas copiadas al directorio de Cargo; conservar los recursos del instalador.
- Al guardar una copia editada, ofrecer PNG, JPEG y WebP junto al nombre, tomando el formato inicial de la extensión real del archivo. Seleccionar todo el nombre al pulsar el campo. Mantener la extensión y codificación originales al sobrescribir y reservar PNG para originales cuyo formato no pueda sobrescribirse de forma segura.
- Evitar que los atajos y avisos globales de audio aparezcan sobre el visor de imágenes, sin afectar la reproducción de música en segundo plano ni el control de volumen en otras vistas.

## Límite de validación

La compilación confirma integridad de código. El arrastre entre aplicaciones, el aspecto final de la imagen guardada y la experiencia de edición requieren prueba manual en Prisma de desarrollo.
