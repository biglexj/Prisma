# Quick Look: sustitución de audio al usar el progreso

## Causa encontrada en el código

El vigilante de selección funcionaba cada 100 ms también cuando una ventana del proceso Prisma tenía el foco. Entonces `get_active_selection_info` podía consultar LAST_EXPLORER_HWND o cualquier Explorador disponible. Por ello, enfocar Quick Look para buscar una posición de audio permitía publicar la imagen seleccionada en un Explorador anterior. Esta ruta consulta archivos mediante Windows Shell; no captura píxeles de la pantalla.

## Corrección

- La actualización automática consulta únicamente el Explorador o escritorio en primer plano, sin recurrir a la ventana recordada.
- Comprueba de nuevo la ventana de origen, el estado abierto y la revisión de la sesión tras leer metadatos, descartando resultados tardíos.
- Cada apertura invalida el vigilante anterior. Cerrar invalida las consultas pendientes y limpia el lote seleccionado.
- Las flechas dentro de Prisma no se reenvían al Explorador recordado. Los controles de progreso conservan sus eventos de teclado.
- Las respuestas asíncronas de la interfaz no pueden sobrescribir un evento de previsualización más reciente; los temporizadores se limpian al desmontar.

## Validación

TypeScript y 28 pruebas Rust aprobados. Las pruebas de política cubren cambio a Quick Look/navegador, cambio a otro Explorador, cierre y reapertura durante una lectura.

No se ha reproducido el clic con el archivo MTP ni el FLAC de las capturas en la aplicación instalada. Esa comprobación sigue separada de las pruebas automatizadas.
