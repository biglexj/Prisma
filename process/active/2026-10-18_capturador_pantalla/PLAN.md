# Capturador de pantalla de Prisma — Plan

- Estado: `DRAFT` — planificación lista para relevo; implementación pendiente.
- Fecha: `2026-10-18`
- Proyecto y rama observada: Prisma, `preview`.
- Documentos asociados: [TASKS.md](TASKS.md), [VALIDATION.md](VALIDATION.md), [APPROVAL.md](APPROVAL.md).

## TAREA

Crear una herramienta de captura de pantalla en **Herramientas → Capturador**, con vista propia. Combinar la simplicidad de Recortes de Windows con el contorno y la detección del objetivo que Biglex aprecia en ShareX. Capturar, anotar, copiar sin guardar o guardar por elección explícita.

Este encargo solo autoriza dejar el plan. El siguiente agente se encargará de la implementación cuando reciba la instrucción correspondiente. No se ha creado ni contactado otro chat.

## CONTEXTO

### Decisiones del usuario

- **Ventana es el modo predeterminado**, sustituyendo la propuesta anterior de iniciar en Rectángulo.
- Al mover el cursor, se debe ver un borde preciso que indique qué ventana o área de ella se está seleccionando. El objetivo debe actualizarse según lo que haya en pantalla.
- Otros modos pedidos: **Rectángulo** y **Pantalla completa**.
- **Flujo In-Situ (Sin ventana secundaria)**: Por indicación explícita de Biglex, se elimina la apertura de una ventana editora separada («no me gusta que la captura se abra una ventanita... que se quede en la ventana que tomó, como todo»). Toda la fase de anotación y confirmación ocurre en el mismo overlay en el lugar exacto capturado con herramientas ancladas.
- **Color Insignia de Prisma**: `#00C9B9` como primer color de la paleta y seleccionado por defecto para las anotaciones.
- **Lápices y dibujo fluido**: Se garantiza que el lienzo permita pintar sin reinicios ni pérdidas de trazo, usando Pointer Events directos.
- Se requieren notas sobre la imagen, copia al portapapeles y guardado opcional. Evitar la cantidad de opciones y flujos de ShareX.
- Acceso por la tecla de captura: se mencionaron Impr Pant y Mayús + Impr Pant. Explicar cómo liberar Impr Pant de Windows Snipping Tool / ShareX si está retenido.
- La herramienta está disponible en Herramientas y cuenta con su propia vista de configuración y acceso rápido.

### Referencia visual

Imagen proporcionada: `C:/Users/biglexj/AppData/Local/Temp/codex-clipboard-c827bb79-e7c9-415e-8350-5ec0ed4b5c79.png`.
Es una ruta temporal, no una dependencia de ejecución. Si desaparece, la descripción siguiente permite continuar: desplegable pequeño, icono a la izquierda, etiqueta de modo y estado activo inequívoco. Heredar los componentes, tema y tokens de Prisma; la inspiración de Recortes corresponde al flujo y a la densidad de controles.

### Puntos de integración observados

- `src/app/ui/AppSidebar.tsx`: lista `nativeToolItems` y navegación por vistas.
- `src/app/App.tsx`: títulos y montaje de vistas de herramientas.
- `src/app/useSystemSettings.ts`: `ToolKey`, `enabledTools` y valores iniciales.
- `src/app/ui/ToolsSettingsPanel.tsx`: catálogo y activación de herramientas nativas.
- `src/app/ui/ShortcutsSettingsPanel.tsx`: presentación de atajos.
- `src-tauri/src/lib.rs`: inicialización y registro del plugin de atajos globales.
- `src/features/visual_library/services/imageClipboard.ts`: revisar reutilización para copiar imágenes sin generar archivos.
- `src/features/visual_library/ui/editor/`: revisar reutilización de edición y guardado, sin trasladar toda su complejidad al capturador.
- `src/features/quick_look/ui/QuickLookWindow.tsx` y `src/features/playback/ui/FlyoutWindow.tsx`: referencias locales para ventanas auxiliares; comprobar sus contratos antes de reutilizarlas.

La revisión fue documental y de código acotada. No demuestra captura, detección de ventanas ni funcionamiento del atajo. Ya existen cambios locales ajenos: preservarlos y revisar `git status` antes de implementar.

## FORMATO

### Flujo de uso

1. Abrir Capturador desde Herramientas o activar el atajo global con Prisma ejecutándose, incluso minimizado/en bandeja.
2. Mostrar una capa de selección discreta con selector de modo, inicialmente **Ventana**.
3. Mover el cursor o arrastrar según el modo. Mostrar contorno contrastado y dimensiones junto al objetivo, sin taparlo.
4. Confirmar con clic en Ventana/Pantalla completa o soltar el arrastre en Rectángulo. `Esc` cancela sin copiar ni guardar.
5. Abrir un editor compacto con la captura congelada y anotaciones opcionales.
6. **Copiar** envía el resultado al portapapeles; **Guardar como…** pide nombre y ubicación. Ambas acciones quedan disponibles para la misma captura.

### Modos y contornos

| Modo | Comportamiento esperado |
| --- | --- |
| Ventana — predeterminado | El borde sigue la ventana visible bajo el cursor; detectar también áreas o controles cuando sean identificables. El rectángulo mostrado debe coincidir con los píxeles finales. Permitir elegir ventana completa o región detectada con una interacción compacta, por ejemplo rueda para recorrer objetivos anidados; propuesta a validar. |
| Rectángulo | Arrastre libre con borde y medidas visibles. Antes de confirmar, permitir ajustar posición y tamaño mediante tiradores sin volver a empezar. |
| Pantalla completa | Propuesta inicial: monitor bajo el cursor, resaltado antes del clic. No añadir un cuarto modo para todo el escritorio en esta primera entrega. |

Para Ventana se prioriza **lo que está visible en pantalla**: recortar contra los límites visibles y evitar capturar contenido oculto detrás de otras ventanas. No es captura con desplazamiento. Si no puede identificarse un subelemento, ofrecer la ventana visible o pasar a Rectángulo, sin presentar una precisión inexistente. Verificar detección en aplicaciones con interfaces dibujadas y en ventanas parcialmente fuera de pantalla.

El borde debe ser legible sobre fondos claros y oscuros. Atenuar suavemente el exterior y conservar el objetivo reconocible. Excluir de la imagen los bordes, el selector, los tiradores y cualquier ventana auxiliar del capturador. No añadir marcas a los píxeles de salida.

### Editor y salidas

- Herramientas iniciales: texto, lápiz, resaltador, borrado de anotaciones y deshacer/rehacer; color y grosor solo donde se necesiten. Las notas se aplican a la captura congelada, no a las aplicaciones reales.
- Acciones principales: **Nueva captura**, **Copiar** y **Guardar como…**; `Ctrl+C` y `Ctrl+S` dentro del editor, respetando el foco al editar texto.
- Mantener el original y las anotaciones separados en memoria hasta exportar, sin reducir la resolución de la captura.
- Copiar una imagen utilizable en otras aplicaciones, no una ruta ni un archivo temporal. Mantener el resultado en memoria; no escribir PNG, miniaturas, historial ni caché en disco por capturar, anotar o copiar.
- Guardado inicial en PNG mediante diálogo con nombre y carpeta. Cancelar el diálogo conserva la captura; sobrescribir exige el diálogo habitual. Registrar éxito solo cuando termine la escritura.
- Feedback breve de copia/guardado y errores recuperables. Cerrar o iniciar otra captura con anotaciones pendientes debe permitir volver o descartar sin guardar automáticamente.

### Atajo y ciclo de vida

- Propuesta inicial: **Mayús + Impr Pant**, con **Impr Pant** como alternativa configurable para sustituir el uso actual de ShareX. La combinación definitiva depende de la disponibilidad real y de la elección de Biglex al activarla.
- Reutilizar el sistema global de Prisma; validar el identificador de tecla soportado. Una pulsación debe abrir una sola sesión, sin reentrancia por repetición de tecla.
- Si el atajo está ocupado, mantener el acceso desde Herramientas, mostrar el conflicto y permitir elegir otra combinación. No modificar el registro de Windows, sus preferencias de Recortes ni la configuración de ShareX automáticamente.
- Liberar los registros al desactivar la herramienta/cerrar Prisma y preservar los atajos de audio, Quick Look y reproducción.
- Capa de selección sin entrada propia en la barra de tareas; editor dedicado con foco y cierre independientes de la ventana principal. No forzar que toda Prisma se restaure encima de la aplicación que se quiere capturar.

### Estrategia técnica para el siguiente agente

1. Revisar reglas actuales, estado de `preview`, ventanas auxiliares, permisos Tauri y dependencias ya instaladas. No actualizar paquetes por rutina.
2. Separar el dominio propuesto `src/features/screen_capture/` y `src-tauri/src/features/screen_capture/`; mantener en `app/` solo integración. Los nombres son propuesta, no archivos creados.
3. Hacer una prueba técnica mínima de captura del escritorio visible, detección de ventana/subregión, exclusión de overlays y portapapeles en memoria. Consultar documentación oficial vigente antes de elegir APIs o dependencias; este plan no certifica ninguna implementación nativa concreta.
4. Unificar coordenadas físicas de monitores con coordenadas de UI, incluyendo DPI mixto y posiciones negativas. La geometría de selección y el recorte deben usar la misma transformación.
5. Coordinar selección y captura para que la imagen confirmada corresponda al objetivo mostrado, sin destellos ni overlays. Resolver explícitamente si se usa un fotograma congelado o una captura al confirmar; verificar coherencia si la ventana cambia durante la selección.
6. Exponer comandos y eventos pequeños con identificador de sesión; liberar imagen y ventanas al cancelar/cerrar. Evitar enviar imágenes grandes repetidamente como base64 si hay un mecanismo local en memoria adecuado.
7. Integrar navegación, ventana propia, atajos y controles mínimos, y realizar las comprobaciones de `VALIDATION.md`. Si falla la detección de subregiones, documentar el límite y mantener Rectángulo funcional; no declarar terminado el requisito de áreas automáticas.

## RESTRICCIONES

- En este turno: solo documentos del proceso y enlace en el roadmap. Sin implementación, instalación, compilación, commits, publicación ni cambios al sistema.
- Primera versión para Windows. No incluye vídeo, OCR, subida, cuentas, IA, historial, captura con desplazamiento, automatizaciones ni Forma libre.
- Ninguna dependencia de ShareX o Recortes para el funcionamiento final.
- Seguir la identidad local de Prisma sin añadir paneles, pestañas o ajustes que no aporten al flujo descrito.
- No confundir `cargo check` o un build con captura real, copia pegable, guardado verificado o integración en la barra de tareas.

## Criterios de finalización de la futura implementación

- [ ] Capturador aparece como herramienta nativa con vista propia y editor dedicado.
- [ ] Cada nueva sesión inicia en Ventana; el contorno identifica ventana y regiones detectables y coincide con la captura.
- [ ] Rectángulo y Pantalla completa funcionan, incluyendo varios monitores/DPI mixto.
- [ ] Se puede anotar, deshacer y obtener el mismo resultado al copiar y guardar.
- [ ] Capturar/copiar no crea archivos, caché de capturas ni historial en Prisma; PNG solo se escribe al guardar explícitamente.
- [ ] Atajo real validado libre y ocupado, con cancelación y recuperación limpias.
- [ ] Evidencia funcional registrada y limitaciones pendientes indicadas sin atribuir aprobación al usuario.

## Autorización y relevo

- [x] Biglex solicitó planificar y dejar el trabajo en `process` para otro agente el 2026-10-18.
- [ ] Implementación autorizada en una instrucción posterior al agente encargado.
- [ ] Resultado funcional validado y aceptación del usuario registrada cuando corresponda.


## Ajustes autorizados por Biglex — 2026-10-18

La petición actual autoriza implementar y probar estos ajustes sobre el capturador ya existente; sustituye el límite histórico de solo planificación para este alcance.

- Cada nueva sesión restablece el modo solicitado (Ventana por defecto), lápiz, turquesa y grosor inicial; descarta el cuadro de texto y estados de interacción anteriores.
- Iconos reconocibles de lápiz, resaltador y texto, separados de flecha, rectángulo y círculo/elipse. Botones directos, sin menú de formas.
- Flecha con punta proporcional y cuerpo terminado en la base del triángulo.
- Contorno segmentado turquesa, esquinas y tiradores centrales visibles en rectángulo y ventana, también al anotar. Pantalla completa conserva solo el contorno.
- Ajustar un tirador vuelve a recortar el original congelado y conserva las posiciones de las anotaciones. El original permanece en memoria hasta cancelar/copiar/guardar y cerrar.
- Probar la app de desarrollo y presentar capturas en el chat. No incluye publicación ni instalación.


## Atajos y memoria del modo — 2026-10-19

Por petición posterior de Biglex, el capturador vuelve a recordar el último modo de imagen confirmado (Rectángulo, Ventana, Pantalla completa o Forma libre), incluso tras reiniciar. Esta decisión sustituye el reinicio obligatorio a Ventana registrado anteriormente. El selector de color no reemplaza esa preferencia y cada sesión sigue limpiando anotaciones, cuadros de texto y gestos.

Atajos de anotación: B lápiz, R resaltador, T texto, S rectángulo, C círculo/elipse, F flecha; 1–7 colores de izquierda a derecha; Mayús+1/2/3 grosores 2/4/8 px. N vuelve a seleccionar y Supr limpia las anotaciones. Copiar, guardar, deshacer, rehacer y cerrar conservan sus atajos. No se añade borrador.

Las teclas se muestran en tooltips, sin insignias visibles en la barra. Los atajos de captura R/V/F/Q/C siguen disponibles antes de anotar; la fase determina su acción. Mientras se escribe en un cuadro de texto se respetan letras, números y Ctrl+C/Z nativos del campo.

## Reincidencia del lápiz en la instalación — 2026-10-20

Biglex informa que, tras compilar e instalar, el lápiz funciona al arrancar y después no permite arrastrar Rectángulo ni dibujar anotaciones, aunque ambas barras siguen funcionando. La confirmación anterior de varias capturas en Dev no cierra esta incidencia.

Registrar en una compilación de producción los contactos, sus filtros y el estado de los gestos antes/después de los manejadores. Diagnóstico local optativo con `--capture-diagnostics`, sin imágenes ni textos y con tamaño acotado. Reproducir el bloqueo antes de atribuirlo a foco, captura del puntero o su clasificación como principal. Corregir la causa observada y comprobar otra vez con lápiz físico. No publicar ni sustituir la instalación automáticamente.

## Evitar restos de la captura anterior — 2026-10-21

Biglex detecta que, al pasar de A a B, aparecen fugazmente los trazos anteriores. Limpiar el lienzo y su imagen al cancelar, al terminar nativamente y al cambiar de sesión. Ocultar la captura anterior antes de congelar la siguiente; mostrar el overlay cuando el frontend confirme que ha aplicado la nueva sesión. Ignorar cierres/confirmaciones de sesiones antiguas.

## El capturador no respondía al arrancar — 2026-10-21

Biglex reporta que el capturador no responde al iniciar Prisma: hay que abrir la aplicación, esperar a que cargue la biblioteca y entrar a Configuración para que la captura se habilite. En segundo plano la pulsación del atajo no produce ninguna reacción. Lo describe como rarísimo, porque la aplicación ya está en marcha.

### Causa observada

El atajo global del capturador no pertenecía a la aplicación: lo registraba un efecto del frontend (`useSystemSettings`), y solo cuando la preferencia `screenCaptureEnabled` era verdadera. Ese registro ocurría al montar una vista, no al iniciar el proceso.

En la instalación de Biglex, además, el atajo elegido es «Impr Pant», que Windows tiene ocupado: la Herramienta Recortes registra esa tecla mientras está abierta. El registro en el sistema operativo fallaba y el error se descartaba en silencio (`.catch(() => {})`), de modo que ningún atajo quedaba activo. El estado que devolvía el backend declaraba «Atajo Activo» siempre que no hubiera error previo, incluso con ninguna tecla registrada, y la vista «Capturador» no era alcanzable desde la barra lateral: no había forma de ver el problema. Solo «Probar Captura» en Configuración abría el capturador, que es lo que Biglex observaba.

### Decisiones

- **Rust pasa a ser la fuente de verdad.** El atajo se registra al arrancar la aplicación, en `setup`, y la preferencia se guarda en `screen_capture.json` dentro del directorio de datos. Ninguna vista del frontend es responsable de activarlo.
- **Estado honesto.** `screen_capture_get_shortcut_status` informa del atajo realmente registrado, del solicitado, de si está habilitado y del motivo del conflicto. La interfaz nunca declara un atajo activo que no lo esté.
- **Reserva automática.** Si el atajo pedido está ocupado, se activa «Mayús + Impr Pant» y se explica el motivo en pantalla. La preferencia del usuario se conserva y se reintenta en cada arranque, de modo que la captura se recupera sola cuando la tecla queda libre.
- **Preferencia heredada.** La preferencia antigua del `localStorage` se transfiere una sola vez al backend al detectar que no existe archivo de preferencias.
- **Visibilidad.** Configuración muestra el estado real del atajo y la vista «Capturador» vuelve a estar en la barra lateral, bajo Herramientas, junto a las demás herramientas nativas.

No se publica una release ni se sustituye la instalación habitual: la comprobación final corresponde a la compilación que Biglex instale.
