# Compatibilidad con tabletas y arrastre de archivos en Prisma

La explicación reutilizable, las restricciones de Windows y la validación están en [Documentación Core: Compatibilidad con tabletas](../../../Docs/platforms/windows/tablet-compatibility.md). Este documento conserva los contratos propios de Prisma.

## Fuente compartida

- `useNativeFileSources` se monta una sola vez en `AppContent`. Registra las fuentes visibles de la ventana principal mediante `data-native-file-path`; se pueden indicar `data-native-file-preview` y `data-native-file-shape`.
- `native_file_set_surfaces` acepta únicamente el documento local de la ventana `main`, valida geometría y PNG, normaliza las rutas de archivos existentes y devuelve los identificadores realmente registrados. No depende de la extensión del archivo.
- El motor nativo se comparte con Synapse; revisiones y ventanas hijas se conservan por ventana. La configuración de Inicio no debe borrar las fuentes de Synapse.
- Solo se preparan hasta 96 elementos visibles, con miniaturas limitadas y reutilizadas. Las superficies se recortan al viewport y contenedores de scroll; los controles interactivos conservan huecos nativos propios.
- El inicio OLE ocurre en el manejador nativo de mouse compatible. Los eventos al frontend comunican clic, menú, scroll, actividad y errores; no solicitan el inicio del arrastre por IPC.
- El fallback `handleNativeDragPointerDown` conserva sus comprobaciones de contacto y no se arma si el elemento ya tiene una superficie nativa preparada. `markHostFileDrag` evita procesar como nueva entrada un archivo que sale de Prisma.

## Cobertura incorporada

Inicio: música, vídeos e imágenes. Bibliotecas visuales y musicales, favoritos, historial, listas de reproducción, cola, filas de carpetas y árbol de medios. Visores: títulos y controles de arrastre de imagen/vídeo, carátula/título del reproductor y título de documentos. Las bibliotecas personalizadas registran sus tarjetas de cualquier archivo, incluidos documentos y proyectos.

La superficie de vídeo mantiene sus gestos de reproducción existentes; la salida nativa con lápiz está disponible desde su título/control «Arrastrar archivo». Arrastrar un documento abierto entrega el archivo guardado en disco, no una exportación de cambios aún sin guardar.

Inicio también recibe archivos externos mediante el enrutador global: abre el primer archivo con el visor/reproductor existente. Si recibe una carpeta, la registra como fuente de música, imágenes y vídeos. Los dos canales nativos se deduplican; los receptores específicos y Synapse conservan prioridad.

## Estado de validación

Biglex confirmó el laboratorio independiente, la entrega al chat desde Synapse y posteriormente la sección Imágenes. La ampliación restante requiere sus pruebas físicas por tipo, dispositivo y destino. No se deduce compatibilidad de un editor concreto a partir de la extensión: el receptor decide qué importa.

Build frontend correcto; 20 pruebas frontend y seis Rust correctas en esta revisión. El tamaño de las miniaturas existentes se mantiene. No se cambia Windows Ink ni el modo del controlador.

[Proceso activo y evidencia](../../process/active/2026-10-28_synapse_lapiz_inicio_fondo/VALIDATION.md).
