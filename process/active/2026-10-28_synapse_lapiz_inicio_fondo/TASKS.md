# Tareas

- [x] Conservar y liberar correctamente la captura del lápiz antes del arrastre OLE.
- [x] Desactivar pan en tarjetas Synapse y usar eventos de puntero para señalar casillas.
- [x] Esperar estabilidad del shell y geometría antes de restaurar el fondo automáticamente; permitir cancelación al cerrar y limitar la espera.
- [x] Añadir pruebas de arrastre y estabilidad.
- [x] Completar comprobaciones técnicas y registrar sus resultados.

## Corrección tras la prueba instalada

- [x] Promover el contacto primario a mouse en el hilo nativo justo antes de DoDragDrop, mediante la API dinámica de Windows 11. La espera previa de mousemove en el DOM no resolvió la prueba con lápiz y fue retirada.
- [x] Ignorar entradas y soltados de los propios archivos en la barra.
- [x] Reutilizar archivos ya materializados en vault-items para impedir cadenas de copias.
- [x] Mostrar errores de inicio del arrastre en Synapse.
- [x] Usar la miniatura de la galería para imágenes de Synapse y exportar una vista previa cuadrada.
- [x] Validar regresión de importación nativa y nueva compilación frontend.
- [ ] Resolver el arrastre real del lápiz: la conversión nativa respondió true, pero Biglex confirmó que sigue fallando. Registrar QueryContinueDrag y final de DoDragDrop durante un gesto real.
- [ ] Confirmar arrastre con lápiz a una aplicación externa en Dev.
