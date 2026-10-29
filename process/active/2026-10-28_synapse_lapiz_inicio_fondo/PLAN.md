# Synapse con lápiz e inicio automático del fondo

Corregir la gestión del puntero del lápiz en Synapse y esperar un escritorio estable antes de restaurar automáticamente el fondo.

Biglex informa que detener y reiniciar el fondo recupera su tamaño después de un inicio de Windows defectuoso, también observado en otra aplicación. La causa exacta no está reproducida. Aplicar una mitigación acotada: shell con área válida y geometría estable durante dos segundos, hasta quince segundos de espera, en el hilo de restauración. El inicio manual conserva su comportamiento.

Validar arrastre y cancelación con pruebas, compilar frontend y comprobar el módulo Rust. La aceptación con tableta y un nuevo inicio de sesión queda pendiente de hardware y reproducción real.

Ampliación autorizada el 2026-10-29: compartir la fuente nativa validada con Inicio, bibliotecas, reproductores y documentos, para cualquier archivo local; habilitar también recepción en Inicio. Revisar los cambios de otro agente antes de continuar. Documentar el patrón reutilizable en Core y conservar los contratos de Prisma en [la guía local](../../../docs/guides/tablet-compatibility.md). Los gestos físicos quedan a cargo de Biglex.
