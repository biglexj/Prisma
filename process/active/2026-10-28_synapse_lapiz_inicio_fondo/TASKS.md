# Tareas

## Entrada de imágenes web — 2026-11-01

- [x] Conservar la entrada de archivos locales y materializar las imágenes en memoria cuando WebView2 rechace el puente File.
- [x] Limitar lecturas, preservar contenido y destinos del lote y comprobar la regresión con pruebas y build.
- [x] Registrar la confirmación de Biglex de que el arrastre del navegador a Synapse ya se acepta normalmente y documentar la restricción en Core.

- [x] Conservar y liberar correctamente la captura del lápiz antes del arrastre OLE.
- [x] Desactivar pan en tarjetas Synapse y usar eventos de puntero para señalar casillas.
- [x] Esperar estabilidad del shell y geometría antes de restaurar el fondo automáticamente; permitir cancelación al cerrar y limitar la espera.
- [x] Añadir pruebas de arrastre y estabilidad.
- [x] Completar comprobaciones técnicas y registrar sus resultados.

## Corrección tras la prueba instalada

- [ ] Resolver el arrastre con lápiz con Windows Ink activado y desactivado. La mitigación con Ink desactivado funciona, pero Biglex no la acepta como solución final. Las rutas experimentales que no funcionaron permanecen retiradas.
- [x] Ignorar entradas y soltados de los propios archivos en la barra.
- [x] Reutilizar archivos ya materializados en vault-items para impedir cadenas de copias.
- [x] Mostrar errores de inicio del arrastre en Synapse.
- [x] Usar la miniatura de la galería para imágenes de Synapse y exportar una vista previa cuadrada.
- [x] Validar regresión de importación nativa y nueva compilación frontend.
- [x] Retirar conversión y trazas experimentales de vendor/drag, cerrar únicamente la instancia Dev bloqueada y deshabilitar temporalmente la salida con lápiz en Synapse con un aviso visible.
- [ ] Confirmar arrastre con lápiz a una aplicación externa en Dev: la aceptación anterior fue corregida por pruebas posteriores; sigue en REWORK.

## Reutilizar el contacto de la capturadora

- [x] Extraer PointerContact compartido y conservar CapturePointer como alias para la capturadora.
- [x] Usar el contacto en Synapse, recuperar identificadores nuevos y cancelar al perder captura/foco.
- [x] No depender del bit de mouse en los movimientos del lápiz ni cancelar sus eventos compatibles.
- [x] Sustituir el bloqueo fijo del lápiz por una comprobación nativa de solo lectura antes de OLE; no convertir ni inyectar eventos.
- [x] Probar recuperación de contactos y regresión de mouse/capturadora: 20 pruebas correctas y build frontend correcto.
- [x] Comprobar el resultado real con tableta en Dev: entrada y salida de Synapse confirmadas por Biglex con Windows Ink desactivado.

## Diagnóstico fuera de Prisma

- [x] Confirmar con Biglex que también falla el arrastre del lápiz entre carpetas del Explorador.
- [x] Limpiar el error de salida al recibir un arrastre nuevo y registrar la ruta de entrada.
- [x] Identificar XPPen Deco 01 V3 y observar Windows Ink activado en el perfil global.
- [x] Completar prueba con Windows Ink desactivado: Biglex confirmó que funciona en el Explorador y Synapse. Se restauró activado al aclarar el requisito de compatibilidad en ambos modos.
- [ ] Sustituir la dependencia del botón de mouse en la entrega a OLE por una ruta compatible con Ink que no bloquee la interfaz; verificar entrada y salida con ambos modos.
- [ ] Validar el tamaño del fondo en el próximo inicio real de Windows; la espera de estabilidad aún no tiene aceptación de arranque.

## WebView2 y entrega del archivo — 2026-10-29

- [x] Investigar las restricciones de DoDragDrop y File sin respaldo nativo mediante fuentes primarias; registrar en RESEARCH.md.
- [x] Dejar que WebView2 gestione el gesto y preparar un File con respaldo de disco, comprobado mediante DOM.getFileInfo.
- [x] Sustituir el prefijo interno VerbatimDisk/VerbatimUNC por una ruta compatible con Shell al exportar; conservar la comprobación canónica de identidad.
- [x] Confirmar en receptor WinForms real que FileDrop entrega un archivo accesible de 453.695 bytes, sin fallback a texto.
- [x] Evitar la carrera about:blank durante el registro del receptor entrante; comprobar el origen por mensaje.
- [x] Recuperar Dev y excluir los temporales del watcher tras el fallo EBUSY del compilador de diagnóstico.
- [x] Compilación frontend, 13 pruebas frontend y dos pruebas Rust correctas.
- [ ] Aceptar recepción final de imagen en el chat con lápiz e Ink activado: aceptación anterior retirada; sigue pendiente.
- [ ] Comprobar entrada hacia Synapse, otros archivos y regresión completa Ink ON/OFF y mouse. No inferirlo de dropEffect=copy.

## Salida del host — 2026-10-29

- [x] Registrar la confirmación actual de Biglex: la entrada hacia Synapse funciona; el recorrido con mouse/modo ratón también fue confirmado.
- [x] Sustituir la salida DOM/CDP por fuente nativa. El intento CoreDragOperation fue retirado tras comparar con el laboratorio aceptado.
- [x] Recibir el contacto en superficies propias sin depender del identificador DOM ni convertir el lápiz en mouse.
- [x] Reproducir y corregir la ausencia de compatibilidad Windows en el manifiesto para crear superficies layered hijas.
- [x] Preservar los botones web y la entrada sobre las nuevas superficies; rechazar reimportación de archivos propios.
- [x] Evitar que mouse compatible o un reajuste durante la animación eliminen el contacto del lápiz.
- [x] Build frontend, 17 pruebas frontend y cuatro pruebas Rust correctas.
- [ ] Aceptación de salida a otras aplicaciones con lápiz e Ink ON/OFF: Biglex realizará las pruebas físicas; no automatizarlas.

## Traslado del laboratorio aceptado

- [x] Confirmar en registros un lápiz real PT_PEN, promoción de mouse por Windows y archivo legible recibido en el segundo proceso.
- [x] Registrar la confirmación de Biglex: también adjunta la misma imagen en el chat desde el laboratorio.
- [x] Dejar WM_POINTER* al procedimiento predeterminado y esperar WM_MOUSEMOVE compatible para iniciar OLE, como la prueba aceptada.
- [x] Usar el botón y las coordenadas del mensaje y los umbrales del sistema; eliminar la consulta tardía del botón para iniciar desde la superficie.
- [x] Retirar CoreDragOperation y sus dependencias exclusivas; conservar miniatura PNG, botones y recepción.
- [x] Confirmación de Biglex del recorrido integrado desde Synapse hacia el chat; adjuntó los archivos de la barra y confirmó que quedó consolidado.

## Herramienta global y documentación

- [x] Resolver el error 112 de disco lleno mediante limpieza oficial de artefactos debug, corregir advertencias Rust y completar build release/instalador local verificado.

- [x] Auditar y corregir cambios posteriores que permitían entrar en OLE sin contacto confirmado, conservando avances útiles.
- [x] Compartir la fuente nativa en Inicio, música, vídeo, imágenes, documentos, bibliotecas personalizadas, favoritos, historial, listas, cola y árbol de medios.
- [x] Preparar solo fuentes visibles y conservar controles mediante huecos, acciones de clic/menú/scroll y limpieza al navegar.
- [x] Habilitar recepción de archivos/carpetas en Inicio y deduplicar canales de entrada.
- [x] Registrar aceptación de Biglex para la sección Imágenes.
- [x] Build frontend, 20 pruebas frontend y seis pruebas Rust correctas.
- [x] Documentar «Compatibilidad con tabletas» en Core y mantener un puente con contratos locales.
- [ ] Aceptación física del resto de formatos/vistas y de ambos estados de Ink por Biglex; el destino decide qué puede importar.

## Cierre al reproducir — 2026-11-01

- [x] Identificar el panic `RefCell already borrowed` en el procedimiento nativo de entrada y el EBUSY independiente del vigilante de Vite.
- [x] Separar la mutación de SOURCES de captura, eventos, rastreo del mouse y liberación COM para permitir mensajes reentrantes.
- [x] Excluir artefactos `release/` y añadir una regresión con bloqueo exclusivo de un temporal del instalador.
- [x] Verificar build, pruebas de Synapse y reproducción real de dos canciones en Prisma Dev sin cierre.
