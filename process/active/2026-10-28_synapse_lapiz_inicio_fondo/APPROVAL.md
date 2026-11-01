# Estado

## Decisión actual — Synapse e Imágenes aceptados; ampliación global implementada

Biglex confirmó el recorrido de Synapse al chat mediante los archivos adjuntos y después declaró operativo el arrastre desde la sección Imágenes. Se conserva esa aceptación. Música, vídeos, documentos, recepción en Inicio y la matriz completa Ink ON/OFF quedan pendientes de sus pruebas físicas; el estado histórico inferior no sustituye esta decisión.

La misma fuente nativa se comparte ahora desde AppContent con las tarjetas y controles de archivo de Prisma. La guía de Core y el puente local documentan la implementación y sus límites. Build correcto, 20 pruebas frontend y seis Rust correctas. Dev contiene el compilado nativo nuevo y las actualizaciones frontend.

Se revisaron cambios posteriores al checkpoint af17ec3: dos modificaciones permitían iniciar el fallback OLE sin comprobar el contacto compatible. Se restauraron esas comprobaciones; se conservaron las altas de Inicio y la miniatura por omisión. El hook se trasladó de Home a la raíz de la app y se corrigió el contrato de IDs devueltos por Rust. Copia previa acotada en temp/synapse-pen-diagnostics/audit-20261029. No se descartaron cambios ajenos al encargo.

## Estado vigente — entrada aceptada, salida con lápiz en REWORK

Biglex confirma que arrastrar hacia Synapse ya funciona. También confirmó el recorrido con mouse/modo ratón de la tableta. La salida con lápiz desde la barra hacia otras aplicaciones sigue pendiente de aceptación. Las aceptaciones más generales que figuran debajo son históricas y fueron corregidas por sus pruebas posteriores.

Biglex realizará los gestos y comunicará los resultados; el agente se encarga del código, registros y comprobaciones técnicas, sin automatizar estas pruebas físicas ni repetir formularios de prueba. Corregida la declaración de compatibilidad Windows necesaria para las superficies propias. La ruta CoreDragOperation se sustituyó por OLE iniciado desde mensajes de mouse compatibles generados por Windows, tras la prueba independiente descrita a continuación. Las pruebas automáticas no equivalen a aceptación del arrastre real en Synapse.

## Prueba independiente aceptada y traslado a Synapse

Biglex confirmó que el laboratorio arrastra correctamente y que su imagen también llega adjunta al chat. El registro identifica PT_PEN (tipo 3), mouse compatible con extra FF51570A, drag.end=Copy y recepción FileDrop de PNG legible de 2.396 bytes, sin texto. Esto acepta el laboratorio, no automáticamente la integración en Synapse ni la matriz Ink ON/OFF.

Se traslada el comportamiento confirmado: DefWindowProc recibe los mensajes de lápiz sin consumirlos; solo WM_LBUTTONDOWN/WM_MOUSEMOVE compatibles preparan e inician OLE en el mismo hilo y mensaje. No se consulta tardíamente el botón global para decidir el inicio, no hay IPC para iniciarlo ni conversión/inyección manual. Se retiran CoreDragOperation, sus objetos WinRT y su espera/cancelación experimental. Mantener entrada, botones, miniatura y prevención de reimportación. Integración en Dev pendiente de prueba física de Biglex.

## REWORK vigente — recepción en chat/navegador

Biglex aclaró después que la misma imagen sí se copia de Synapse al Explorador, pero no se adjunta directamente en el chat. Desde el Explorador al chat sí funciona. Su última comprobación indica fallo tanto con lápiz como con mouse. Esa evidencia sustituye la aceptación general del chat registrada anteriormente; la entrega al receptor nativo y al Explorador sigue confirmada.

Se retira la salida DOM como solución universal. En validación: mouse mediante el arrastre nativo existente; lápiz Ink mediante CoreDragOperation y StorageFile del host. Compilar, crear las API o leer el archivo no constituyen aceptación del nuevo gesto.

## Aceptación parcial — 2026-10-29

Biglex confirmó que al soltar una imagen desde Synapse en el chat con el lápiz ahora aparece como adjunto. Windows Ink permanece activado. Se acepta esa salida y la recepción real de imagen, tras corregir la exportación de rutas. El receptor local ya había registrado un archivo accesible sin fallback a texto.

No extender esta aceptación a la entrada hacia Synapse, otros tipos de archivo, la regresión completa Ink ON/OFF ni el próximo arranque de Windows. Esas comprobaciones siguen pendientes. La conversión nativa que bloqueaba la interfaz permanece retirada.

## Decisión vigente — 2026-10-28

REWORK: Biglex exige que Synapse funcione con Windows Ink activado y desactivado. La prueba con Ink desactivado confirmó una mitigación para Explorador, entrada y salida de Synapse, pero no constituye aceptación de la solución final. Se restauró Windows Ink activado en XPPen y se verificó visualmente la casilla. No reintroducir la conversión nativa retirada. La prueba no valida presión/inclinación de las aplicaciones de dibujo ni otros controladores.

La aceptación del tamaño del fondo durante el inicio de Windows sigue pendiente. No cerrar el proceso completo ni atribuir una instalación/publicación nueva a esta validación.

## Historial de decisiones

Alcance autorizado en la conversación: problemas de reconocimiento del lápiz en Synapse y espera de preparación del escritorio para el fondo, tras confirmar Biglex que detenerlo y reiniciarlo recupera el tamaño.

Validación técnica correcta: build frontend y pruebas de arrastre, Synapse y espera de escritorio. Aceptación funcional con la tableta y durante el inicio de Windows pendiente; no atribuida a Biglex. No se ha publicado ni instalado una versión.

REWORK del arrastre: Biglex instaló la compilación del 28 de octubre y confirmó que el lápiz seguía sin iniciar correctamente el arrastre y producía duplicados. En Dev indica que ocurre solo con el lápiz; el mouse funciona. La captura de puntero anterior no resolvió el problema. Segunda corrección en validación; no considerar aceptado el arrastre externo hasta probarlo con su tableta.

La espera del evento de mouse compatible tampoco superó la prueba manual. Se reemplazó por conversión nativa antes de OLE. Biglex pidió además miniatura real cuadrada en el arrastre de imágenes desde Synapse. Ambos cambios están pendientes de aceptación visual y con lápiz; ninguna prueba unitaria demuestra su funcionamiento con el dispositivo.

REWORK confirmado también para la conversión nativa: el lápiz sigue sin arrastrar aunque la conversión devuelve true en el registro de Dev. No declarar resuelto el arrastre. La barra permaneció abierta, pero la recompilación la cerró antes de verificar la recuperación con Esc.

RETIRADO: Biglex confirmó después que ni arrastraba ni se recuperaba con Esc y que la aplicación quedó blanca/sin responder. Se cerró exclusivamente la Dev bloqueada y se restauró vendor/drag al estado anterior a estos experimentos. El arrastre saliente de Synapse con lápiz queda deshabilitado temporalmente con aviso; mouse, miniatura y protección de duplicados se conservan. No es una resolución funcional del lápiz.

Nuevo intento autorizado por Biglex: reutilizar el controlador de contactos de la capturadora. Implementado de forma compartida, con consulta de entrada existente antes de OLE y sin la conversión nativa retirada. El lápiz vuelve a poder iniciar el recorrido si Windows confirma una pulsación. Pendiente de aceptación funcional con su tableta; no declarar resuelto a partir de las 20 pruebas o la compilación.
# Aceptación de entrada desde navegador — 2026-11-01

Biglex confirmó «Ahora sí, acepta normal» después de reportar el error del puente WebView2 al soltar imágenes del navegador. Se registra aceptación de ese recorrido. El ajuste frontend y sus pruebas están completos; no se generó otro instalador ni se amplía la aceptación a toda la matriz de dispositivos/formatos o al arranque del wallpaper.
