# Tareas

- [x] Conservar y liberar correctamente la captura del lápiz antes del arrastre OLE.
- [x] Desactivar pan en tarjetas Synapse y usar eventos de puntero para señalar casillas.
- [x] Esperar estabilidad del shell y geometría antes de restaurar el fondo automáticamente; permitir cancelación al cerrar y limitar la espera.
- [x] Añadir pruebas de arrastre y estabilidad.
- [x] Completar comprobaciones técnicas y registrar sus resultados.

## Corrección tras la prueba instalada

- [ ] Resolver la entrada de lápiz hacia OLE. Se retiraron tanto la espera de mousemove en el DOM como la conversión nativa de Windows 11: no resolvieron el fallo y la segunda quedó asociada a un bloqueo de la aplicación.
- [x] Ignorar entradas y soltados de los propios archivos en la barra.
- [x] Reutilizar archivos ya materializados en vault-items para impedir cadenas de copias.
- [x] Mostrar errores de inicio del arrastre en Synapse.
- [x] Usar la miniatura de la galería para imágenes de Synapse y exportar una vista previa cuadrada.
- [x] Validar regresión de importación nativa y nueva compilación frontend.
- [x] Retirar conversión y trazas experimentales de vendor/drag, cerrar únicamente la instancia Dev bloqueada y deshabilitar temporalmente la salida con lápiz en Synapse con un aviso visible.
- [ ] Confirmar arrastre con lápiz a una aplicación externa en Dev.
