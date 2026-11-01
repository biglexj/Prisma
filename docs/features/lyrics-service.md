# Letras desde Biglex J

Prisma consume el [contrato multiapp de Core](../../../Docs/features/media/lyrics-public-api.md) mediante HTTPS, sin acceso a tablas ni módulos privados del proveedor. Servicio: `https://api.biglexj.com/api/v1/lyrics`.

## Uso

La vista **Letras** y su pantalla completa buscan primero archivos locales o etiquetas. Si no hay contenido local y los servicios conectados están activos, consultan automáticamente Biglex J por título y artista. Una coincidencia única de título y artista muestra texto sin tiempos; se toleran tildes, mayúsculas y el prefijo de agrupación «Orquesta»/«Grupo». No se eliminan indicadores de versión del título. Los resultados ambiguos requieren elección. Una insignia compacta **biglexj.com** identifica la fuente. Las opciones **Letra** y **Sincronizada** aparecen solo cuando hay contenido correspondiente y permiten seleccionar explícitamente una sincronización, sin escribir el archivo. La selección se conserva en memoria durante la sesión; para guardarla offline se utiliza **Editar letra** y el guardado local existente.

Si los servicios conectados están apagados, ambas vistas y el editor lo indican y ofrecen un botón para activarlos. El editor muestra su búsqueda desplegada al abrirse.

1. Activar los servicios conectados en Preferencias.
2. Abrir **Editar letras** desde la vista de letras o su pantalla completa.
3. Expandir **Buscar o aportar letras online** y revisar título y artista.
4. Buscar en Biglex J (fuente predeterminada), revisar el texto o una grabación y confirmar su carga al editor. LRCLIB se puede elegir como alternativa explícita.
5. Revisar o editar y pulsar **Guardar letras** para usar las opciones locales existentes: LRC, SRT o etiquetas de audio.

La búsqueda nunca escribe archivos ni aplica el primer resultado automáticamente. La duración no confirma una grabación. El usuario elige texto sin tiempos o una variante identificada por su nombre, duración y video cuando estén disponibles. La fuente y la etiqueta de versión se conservan en una cabecera LRC `source`, que las vistas de letras muestran como procedencia; no se atribuyen letras de LRCLIB a Biglex J. El SRT conserva solo subtítulos, sin esta cabecera.

## Aportes y recuperación

El panel permite aportar anónimamente el borrador actual mediante una casilla de revisión y un botón explícito. Título y artista son editables; álbum procede de la pista. Para LRC se pide nombre de versión y se usa la duración de la pista. No se envían rutas, audio, identidad inventada ni claves privadas de aplicación.

Antes del POST se guarda el cuerpo y una clave aleatoria en `prisma.lyrics.contributions.v1` del almacenamiento local de Prisma. El comprobante permanece en ese mismo almacenamiento y solo viaja en `X-Contribution-Token` al consultar su estado. Reintentar un envío sin confirmar conserva exactamente cuerpo y clave; cambiar el contenido genera otra clave. Si no se puede persistir, no se inicia el envío. Borrar datos de Prisma elimina los comprobantes locales.

202 significa recibido para revisión. Los estados visibles distinguen pendiente, publicación en proceso, aprobado y rechazado. Al aprobarse, el usuario puede buscar de nuevo la obra en el catálogo. Prisma no incorpora moderación ni exige cuenta para aportar.

## Comportamiento de red

Consulta automática únicamente para la pista mostrada sin letra local y con servicios conectados activos; búsquedas adicionales y aportes por acción explícita. Páginas de 20 candidatos, cancelación al cerrar, cambiar consulta o desactivar servicios, espera tras 429 y tiempo máximo de 15 segundos. No hay reintentos automáticos de POST. Errores HTTP sin JSON se muestran sin volcar cuerpos o comprobantes. Una caída remota no bloquea la edición ni lectura local.

La implementación y sus límites de validación se registran en el [proceso](../../process/active/2026-11-01_servicio-letras/VALIDATION.md). No se ha probado el guardado nativo ni enviado aportes reales como parte de las pruebas automatizadas.
