# Vista previa del arrastre nativo

## Objetivo

Mostrar la miniatura visible del medio al arrastrarlo desde Prisma hacia otra aplicación, en lugar del punto pequeño actual.

## Diseño

- Convertir la portada, miniatura o fotograma ya cargado en un PNG pequeño compatible con el arrastre nativo de Windows.
- Dibujar un icono amplio según el tipo de archivo cuando la miniatura aún no esté disponible o el WebView impida copiarla.
- Reutilizar el mismo mecanismo desde Inicio, Música, Imágenes, Vídeos, Favoritos, filas y visores sin cambiar las rutas entregadas al sistema.
- Mantener una imagen de respaldo mínima si falla la generación del PNG.
- En Windows, crear un bitmap de 32 bits que conserve el alfa de la miniatura y colocarlo alrededor del cursor.
- Presentar la miniatura completa en una de tres siluetas según sus dimensiones: cuadrada, 16:9 o 9:16.
- Mantener los archivos temporales de comprobación nativa fuera de `src-tauri` para que el modo de desarrollo no reinicie Prisma durante la prueba.
- Ignorar una soltada del archivo de Prisma sobre la misma ventana para que no se intente importar como carpeta.
- Iniciar el gesto con el puntero tras un desplazamiento mínimo, conservando clics y controles internos.
- Preservar el apartamento COM de la interfaz al consultar audio: desinicializar solo llamadas propias que tuvieron éxito.
- Inicializar y liberar OLE en el hilo de cada arrastre, sin guardar un fallo global permanentemente.
- Entregar a Shell un DIB de 32 bits con BGRA sin premultiplicar; el helper realiza su propia multiplicación alfa.
- Notificar `IDropTargetHelper` en la superficie receptora de Prisma para que también muestre la imagen flotante.
- Permitir `COPY | LINK` en el modo copia para que un receptor pueda negociar apertura del archivo Shell sin solicitar movimiento.

## Validación

Compilar frontend y comprobar el formato de la vista previa. El aspecto del arrastre sobre el escritorio y la entrega real a otra aplicación requieren prueba manual en Prisma de desarrollo.
