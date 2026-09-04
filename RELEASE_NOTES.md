# 🌌 Release Notes - Prisma

> [!IMPORTANT]
> **Protocolo de Verificación de Versión en GitHub ("Lanzar actualización") [CRÍTICO]:**
> - Al recibir la orden de *"Lanzar actualización"*, es **OBLIGATORIO Y DE LEY** consultar primero la última versión publicada en GitHub / remoto (`gh release list` o `git ls-remote --tags`).
> - Si la versión local ya fue subida (así haya sido lanzada hace minutos), NUNCA se debe sobrescribir ni re-etiquetar. Se DEBE incrementar obligatoriamente a la siguiente versión de parche (e.g. `0.0.1` → `0.0.2`).
>
> **Sanitización de Notas (CRÍTICO):**
> - Los mensajes de las notas de lanzamiento DEBEN estar limpios de rutas de archivos del sistema local (ej. `d:\Proyectos\...`), nombres de variables internas, fragmentos de prompts o logs técnicos de depuración. Deben redactarse con lenguaje limpio, profesional y enfocado al usuario final.
>
> **Estándar SemVer Flexible (Core-Docs v1.7.0):**
> - Se utiliza SemVer estándar (`MAJOR.MINOR.PATCH`) sin límites artificiales por dígito (segmentos mayores a 9 como `1.0.12` son 100% válidos).
> - Se incrementa `PATCH`, `MINOR` o `MAJOR` según el alcance real del cambio y compatibilidad, sin saltos forzados de versión basados únicamente en alcanzar un dígito 9.
> - **Extensión proporcional en Release Notes:** La cantidad de párrafos depende del alcance: 1 para un hito pequeño, 2 cuando hay dos cambios relevantes, 3 como extensión habitual, 4 para hitos relativamente grandes y hasta 5 para lanzamientos de gran alcance. Cada párrafo debe concentrarse en un cambio principal y evitar descripciones excesivamente largas o listas detalladas de archivos.

Registro histórico de cambios y versiones de Prisma.

## [1.0.8] - 2026-09-03

### Resumen
Presentamos **Prisma v1.0.8**, una entrega integral que expande la experiencia acústica y visual: introduce el **Modo DSP Global de Sistema** para procesar todo el audio de Windows (YouTube, Spotify, Discord, juegos), incorpora el nuevo control de **Ganancia / Preamp Maestro** de hasta +12 dB en Efectos DSP con diseño compactado, añade el **Botón y Modal de Configuración de Reproducción** (calcado de Super Galería, con avance secuencial, repetición de cola, repetición de canción y saltos anidados), y renueva el **Sistema de Temas Dinámicos y Colores de Énfasis** con fórmula matemática de luminancia relativa que garantiza contraste accesible WCAG 2.1.

### Detalles
- **Modo DSP Global de Sistema (WASAPI Loopback Capture & Render)**: Motor nativo en Rust puro de captura y renderizado en tiempo real con latencia ultrabaja (~10 ms) y soporte de hilo crítico multimedia de Windows. Captura el flujo de audio del sistema operativo, lo procesa mediante el pipeline DSP de Prisma y lo entrega limpio a los altavoces o auriculares físicos seleccionados sin depender de aplicaciones externas.
- **Control de Ganancia / Preamp Maestro y Tarjetas Compactas**: Nuevo control deslizante de Ganancia al inicio de "Efectos DSP" con rango de -12.0 dB a +12.0 dB (casi 4x de amplificación lineal de potencia en MPV y WASAPI) con atajo de doble clic para restablecer a 0.0 dB neutro. Todas las tarjetas de efectos han sido adelgazadas y compactadas para caber cómodamente en el panel.
- **Botón y Modal de Configuración de Reproducción**: Botón interactivo en la barra de reproducción (`→` secuencial, `🔁` repetición de cola, `🔂` repetición de canción) que abre el nuevo diálogo de configuración con dos pestañas:
  - **Sencillo**: Selección rápida de avance normal, repetición de cola o repetición de pista.
  - **Avanzadas**: Comportamiento al finalizar la canción (detener, cargar pausada o reproducir) y salto automático de colas con sub-opción jerárquica de bucle anidada.
- **Sistema de Temas y Colores de Énfasis**: Soporte para seis paletas de acento (destacando Morado Prisma, junto a Rosa Aurora, Azul Eléctrico, Verde Esmeralda, Ámbar Cálido y Cyan Neón) y **Tematizador Reactivo a la Música** con fórmula matemática de luminancia relativa ($L \approx 0.179$) y ponderación de saturación ($\text{sat}^{2.2}$) que garantiza legibilidad y contraste AAA incluso con carátulas luminosas o desaturadas.
- **Rediseño Equilibrado en Configuración**: Reorganización de "General y Sistema" en columnas balanceadas sin espacios vacíos, cuadrícula simétrica 3x2 para colores de énfasis y separación modular del panel de barra de progreso.
- **Ruteo de Salida Universal y Soporte para MIXLINE**: El selector de dispositivos de salida en el ecualizador lista todos los endpoints de audio activos de Windows, permitiendo redirigir el sonido procesado a interfaces de streaming como `MIXLINE`, altavoces, monitores o auriculares, excluyendo únicamente el canal de captura de Prisma para prevenir bucles de retroalimentación.
- **Continuidad Acústica Sin Pausas entre Pestañas**: Arquitectura persistente de audio con sincronización en caliente en memoria (`matches_devices`). Al alternar entre Inicio, Escuchar, Ecualizador, Música y Vídeos, el motor no recrea los hilos ni reinicia el flujo de audio, garantizando reproducción continua sin micro-cortes.
- **DSP en Reproductor de Vídeo y Modo PiP (Web Audio API)**: Cadena Web Audio de 10 bandas y procesadores acústicos conectada directamente al elemento de vídeo HTML5, conservando ecualización y refuerzo dinámico incluso al proyectar en ventana flotante Picture-in-Picture.
- **Graves Compactos y Centrados (Dual-Mono HyperBass)**: Reordenamiento y calibración matemática del filtro de sub-bajos a 90 Hz ($Q = 2.5$) y 55 Hz ($Q = 2.2$) colocado tras el procesamiento de ensanchamiento estéreo. Elimina la dispersión o fuga hacia los laterales, logrando un golpe de graves sólido, seco y contundente en el centro.
- **Descargador de Letras Sincronizadas (.lrc para Karaoke)**: Herramienta inteligente de búsqueda y descarga masiva por lotes para carpetas y álbumes completos (LRCLIB). Limpia títulos automáticamente, omite pistas con letras preexistentes y guarda archivos `.lrc` compañeros en UTF-8 listos para karaoke en Prisma y reproductores externos.
- **Identidad Oficial del Ecosistema**: Actualización oficial del lema a *«Prisma · Tu espacio de multimedia»* e integración en Windows bajo la denominación *«Prisma Audio Enhancer (Prisma Audio Engine)»*.

## [1.0.7] - 2026-09-03
 
### Resumen
Llega **Prisma v1.0.7**, una de las mayores actualizaciones del producto, encabezada por la nueva **Suite de Ecualización y Procesamiento DSP de Audio de Alta Fidelidad** con tecnología de refuerzo acústico sin distorsión (inspirada en la arquitectura de FxSound), **micro-interacciones fluidas y reproducción sin interrupciones** en toda la biblioteca de música y vídeo, el **Renombrador Masivo Multimedia** con reglas apiladas e intuitivas, la sincronización profunda con el ecosistema **Aurora Synapse** (handoff, control remoto y enrutamiento inteligente), el nuevo motor nativo de conversión de imágenes ultrarrápido en Rust, y la estandarización global de scripts y comandos de desarrollo.

### Detalles
- **Suite de Ecualización Gráfica y Procesamiento DSP de Audio**: Ecualizador de 10 bandas de alta precisión con curva spline interactiva y 5 procesadores de señal en tiempo real: Claridad armónica (*Aural Exciter*), pegada de graves (*HyperBass*), expansión estéreo 3D (*Wide Mid-Side*), ambiente acústico y refuerzo dinámico (*Dynamic Boost*). Incluye selector instantáneo de dispositivos de salida de audio y acceso directo desde el reproductor y la bandeja del sistema (*System Tray*).
- **Refuerzo Dinámico Limpio sin Distorsión (Arquitectura FxSound)**: Implementación de una etapa de compresión ascendente de codo ancho (*soft-knee RMS*) y limitador predictivo *lookahead* a -0.17 dBFS (con ventana de 7 ms). Aumenta la sonoridad percibida y el impacto acústico de la música y vídeos sin sobrecargar la señal, eliminando completamente el *clipping* digital y la distorsión a volumen alto.
- **Experiencia de Reproducción Unificada y Micro-animaciones**: Botón flotante circular rosa de aparición suave exclusivamente en hover sobre las carátulas de música y miniaturas de vídeo. Incorpora micro-animación elástica de pulsación (*pop bounce*) y onda expansiva luminosa (*ripple ring*) al reproducir. La reproducción de pistas, álbumes y carpetas inicia en segundo plano sin expulsar al usuario al panel "Escuchar", permitiendo navegar libremente mientras suena la música.
- **Renombrador Masivo con Reglas Apiladas e Intuitivas**: Nueva distribución visual basada en una línea por componente ("un elemento por línea"), brindando espacio completo a selectores y contadores de caracteres sin recortes. Incorpora menús desplegables de ancho completo con alineación milimétrica y panel de plantillas rápidas combinadas con insignias de conteo de pasos.
- **Sincronización Avanzada con Aurora Synapse**: Soporte integral para deep links y URIs canónicas en Windows, receptor de continuidad de reproducción (Handoff) desde dispositivos móviles, servidor local HTTP de alta velocidad para carátulas, letras sincronizadas y telemetría, y emisión automática de beacons UDP para descubrimiento en red local.
- **Motor de Conversión de Imágenes Nativo**: Conversión y redimensionado de imágenes de alto rendimiento procesado directamente en memoria en Rust (`Lanczos3`) para formatos WebP, PNG y JPG, eliminando incompatibilidades de códecs y reduciendo drásticamente los tiempos de procesamiento.
- **Iconografía Oficial y Estandarización de Scripts**: Actualización integral de los identificadores visuales del ecosistema y adopción del estándar global de comandos en `package.json` (`build:web`, `build:desktop`, `compile`, `release`) para una experiencia de desarrollo homogénea.

## [1.0.6] - 2026-08-29

### Resumen
Actualización **Prisma v1.0.6** centrada en la evolución mayor de **Prisma Quick Look** hacia una experiencia de exploración continua y multiformato sin robar foco en Windows, la integración de un **Inspector EXIF** nativo de alta velocidad, soporte para previsualizar **libros electrónicos EPUB** y **archivos comprimidos ZIP/RAR**, la incorporación del **Panel Lateral de Información Técnica en el visor de fotos** (`I`), y la optimización en la alternancia y renderizado de colas de reproducción musical.

### Detalles
- **Navegación Continua con Flechas en Quick Look**: Al pulsar la barra espaciadora (`Espacio`) sobre cualquier archivo en el Explorador de Windows o Escritorio, la vista previa se abre sin arrebatar el foco activo. El usuario puede utilizar las teclas de dirección (`←`, `→`, `↑`, `↓`), `Inicio`, `Fin`, `RePág` y `AvPág` para desplazarse libremente entre archivos de cualquier tipo con ajuste dinámico de tamaño sin parpadeos.
- **Soporte de Archivos Comprimidos (.zip, .7z, .rar)**: Vista previa estructurada con desglose de carpetas y archivos internos, buscador reactivo en tiempo real y estadísticas de tamaño comprimido vs descomprimido.
- **Libros Electrónicos (.epub)**: Portada tridimensional en alta definición, sinopsis, metadatos editoriales y navegador interactivo de capítulos.
- **Inspector EXIF Nativo (Quick Look y Visor Principal)**: Motor de extracción fotográfica ultrarrápido en Rust puro sin dependencias externas. Detecta cámara, lente, apertura, obturador, ISO, distancia focal, balance de blancos, modo de medición, flash y coordenadas GPS con enlace directo a mapas.
- **Panel Lateral de Información en Visor de Fotos (`I`)**: Ficha técnica completa accesible desde el menú Herramientas o con la tecla `I`, mostrando resolución, relación de aspecto, megapíxeles, parámetros de exposición y botones rápidos para copiar ruta o abrir carpeta en Windows.
- **Gestión de Colas Musicales sin Cortes ("Escuchar")**: Interacción inmediata en las pestañas de colas de reproducción simultáneas y visualización completa y fluida de listas de más de 200 canciones sin recortes artificiales.
- **Cabecera Minimalista y Maximización Lógica**: Diseño de cabecera con botonera de sólo iconos para dar espacio completo al nombre del archivo, maximización adaptativa al área de trabajo del monitor y normalización integral de rutas de Windows.

## [1.0.5] - 2026-08-24

### Resumen
Actualización **Prisma v1.0.5** enfocada en la ergonomía y limpieza visual del visor multimedia, la reorganización modular de herramientas en menús desplegables para imágenes y vídeos, ampliación extrema del rango de zoom desde el 5%, perfeccionamiento del modo de alternancia A/B en la comparativa de fotos, integración nativa precisa con el Explorador de Windows y multiventana desacoplada, junto con la renovación del icono de alto contraste con fondo blanco sincronizado en todos sus puntos de consumo.

### Detalles
- **Menús desplegables de Herramientas**: Reorganización limpia de las cabeceras en el visor de imágenes y en el reproductor de vídeo mediante menús desplegables modulares con estética de cristal. Agrupan de forma ordenada Edición (`E`), Convertidor, Comparativa (`C`), Renombrado (`F2`), Multiventana, Mostrar en explorador, Enviar a Móvil y Presentación (`Espacio`), retirando botones redundantes de las barras principales.
- **Persistencia inteligente de controles**: Los paneles, cabeceras y barras de transporte se mantienen visibles e interactivos de forma continua mientras el puntero se encuentre sobre ellos o cuando el menú de herramientas esté abierto, evitando desapariciones o auto-ocultamientos involuntarios.
- **Rango de zoom ultra amplio en imágenes**: Extensión del límite mínimo de zoom hasta el **5% (0.05)** con pasos dinámicos de aumento y desplazamiento fluido (`pan`) con el cursor para inspeccionar ilustraciones y fotos de ultra alta resolución.
- **Suite de Comparativa refinada (Modo Alternar A/B)**: El indicador de foto, título y dimensiones en píxeles se eleva de forma compacta a la parte superior, unificando la altura, encuadre vertical y escala visual para que sea idéntica y consistente con los modos Cuadrícula y Lado a lado.
- **Integración con el Explorador de Windows y Multiventana**: Corrección en el comando nativo de apertura de archivos (`/select`) para resaltar el elemento seleccionado en el Explorador de Windows y normalización integral de rutas para abrir previsualizaciones flotantes independientes a la par sin fricción.
- **Identidad de alto contraste en Windows**: El nuevo icono con base blanca mantiene el símbolo de Prisma nítido y reconocible en tamaños pequeños (barra de tareas, bandeja del sistema, ejecutable e instalador), sincronizado automáticamente antes de cada compilación.

## [1.0.4] - 2026-08-22

### Resumen
Actualización **Prisma v1.0.4** centrada en una carga inicial más estable, el refinamiento visual de Inicio, Wallpapers y Música, y una integración más segura con el catálogo de **Wallpapers Aurora**. La interfaz conserva el lugar de cada sección mientras se hidratan las bibliotecas, reduce el trabajo simultáneo y mejora la coherencia de estados interactivos en los temas Claro y Oscuro.

### Detalles
- **Inicio más estable y carga escalonada**: Los estantes de Música, Vídeos e Imágenes mantienen su posición durante la carga mediante espacios reservados coherentes. Los escaneos iniciales se coordinan de forma secuencial y las vistas previas visuales aplican límites por cantidad y memoria estimada para reducir saltos, bloqueos y presión innecesaria sobre equipos con recursos limitados.
- **Wallpapers Aurora adaptables y protegidos**: El catálogo utiliza la API web versionada de Aurora, admite autenticación opcional y se degrada de forma controlada al catálogo público. La búsqueda incorpora espera breve y cancelación de solicitudes anteriores; las categorías se construyen con los datos disponibles y las acciones HD permanecen deshabilitadas cuando Aurora marca un recurso como no autorizado o no entrega su URL protegida.
- **Visor de wallpapers sin bandas residuales**: El modal adapta su ancho a la proporción natural de cada imagen, evitando espacios internos laterales o superiores y manteniendo visibles las acciones principales. También se refinó la altura de los controles para conservar la armonía del encabezado y del visor en distintos tamaños de ventana.
- **Títulos musicales y colas consistentes**: Prisma respeta el título y el artista incrustados en los archivos antes de interpretar el nombre del archivo. Las colas guardadas se reconcilian con los metadatos actuales sin perder su orden, muestran una carátula de respaldo cuando falta la original, recuperan el redondeo completo al final del panel y permiten arrastrar horizontalmente la franja de colas cuando existen más elementos.
- **Interacciones visuales unificadas**: Navegación, colecciones, Inicio y Wallpapers comparten estados de hover y foco más consistentes en modo Claro y Oscuro, con tokens semánticos y reducción de movimiento cuando el sistema lo solicita.

## [1.0.3] - 2026-08-20

### Resumen
Actualización **Prisma v1.0.3** enfocada en el perfeccionamiento visual y ergonómico del catálogo de **Wallpapers Aurora** con tarjetas limpias y títulos animados en hover, visor maximizado al 80% de ancho y 90% de alto, optimización de micro-interacciones elásticas en controles de transporte bajo Material 3 Expressive, corrección integral de contraste e inversión cromática de textos en botones para temas Claro y Oscuro, transiciones asíncronas de vídeo sin pausas ni desaparición abrupta del cursor, simplificación del visor de letras y sincronización centralizada de versión en toda la interfaz.

### Detalles
- **Galería Bento y Visor Cinematográfico de Wallpapers**: Las tarjetas de fondos de pantalla ahora presentan el arte de forma completamente limpia en reposo, desplegando los títulos, resolución, categoría y favoritos únicamente al interactuar con el puntero en hover. El modal y visor de wallpapers aprovecha hasta el 80% de ancho y 90% de alto de la pantalla, maximizando la imagen con ajuste inteligente sin espacios negros residuales.
- **Micro-interacciones y Corrección de Contraste en Botones**: Incorporación de físicas elásticas de resorte en controles secundarios y transporte de audio/vídeo. Refactorización completa de todos los botones de acción (`filled`, `tonal` y variantes primarias) con tokens semánticos de diseño, garantizando legibilidad y contraste del 100% de textos e iconos tanto en reposo como en hover y pulsación en temas Claro y Oscuro.
- **Transición Asíncrona y Puntero Continuo en Vídeo**: Ejecución asíncrona en segundo plano para la lectura de pistas de audio, subtítulos y metadatos nativos, erradicando micro-bloqueos en el hilo de la interfaz al cambiar de vídeo o pista. El cursor del ratón y los controles permanecen activos y visibles de forma natural durante la navegación interactiva.
- **Simplificación del Visor de Letras y Cabeceras**: Rediseño enfocado del visor de letras eliminando acciones redundantes para priorizar la experiencia inmersiva de pantalla completa y edición rápida, junto con la unificación de acciones en cabeceras de colecciones bajo el comando integral de administración de fuentes.
- **Centralización de Recursos y Sincronización de Versión**: Estandarización de los iconos oficiales de alta resolución de las aplicaciones vinculadas (*Luna Fetch, Gallery-DL GUI, Super Gallery, LyraFlow y Ely-Tesia*) servidos directamente desde el repositorio central, junto con un módulo único de sincronización de versión para la barra lateral y el diálogo informativo de Acerca de.
- **Control de Zoom y Salida Universal con Escape en Imágenes**: Garantía de salida inmediata del visor de imágenes con la tecla `Escape` independientemente del nivel de aumento (>100%), además del atajo `R` para restablecer al instante la escala nativa del archivo visual.

## [1.0.2] - 2026-08-20

### Resumen
Actualización **Prisma v1.0.2** enfocada en la nueva **Suite de Comparativa de Imágenes Multimodal** integrada al visor y a QuickLook, compatibilidad con instancias y ventanas desacopladas en paralelo, modo desarrollo aislado con bypass de bloqueo, rediseño adaptable de fondos de pantalla en **Bento Grid** denso de 12 columnas, expansión de la **Suite Musical Online** (Música, Instrumentales y Karaokes) con prueba de servidor en vivo y estabilización de alto rendimiento en las barras de progreso sin layout thrashing.

### Detalles
- **Suite de Comparativa de Imágenes Multimodal**: Nueva herramienta de comparación visual accesible directamente desde el visor de fotos (botón dedicado o atajo `C`) y desde la previsualización de QuickLook. Incorpora selector modal de archivos con búsqueda en tiempo real y 4 modos de inspección: Cortina Deslizante (*Split Slider* con tirador interactivo), Lado a Lado simétrico, Alternancia Rápida (*Flicker* A/B para detección de microdiferencias a 60 Hz) y Mapa de Diferencia/Relieve matemático con zoom sincronizado hasta 500%.
- **Ventanas Desacopladas de Quick Look y Concurrencia**: Capacidad de desacoplar múltiples previsualizaciones en ventanas independientes para comparar imágenes, vídeos o documentos en paralelo sin interrumpir el flujo principal de exploración, junto con comandos de cierre seguro de ventana nativos.
- **Modo Desarrollo Aislado y Concurrencia de Instancias**: Soporte para ejecución concurrente en entornos de desarrollo sin conflicto con la versión estable instalada mediante perfiles de almacenamiento aislados y bypass dinámico del bloqueo de instancia única.
- **Bento Grid Adaptativo para Wallpapers Aurora**: Reestructuración completa de la galería de fondos de pantalla hacia una cuadrícula Bento de 12 columnas densa sin espacios vacíos residuales, empaquetado inteligente por proporciones (16:9, 21:9, 9:16 y 1:1), tarjetas con desenfoque de cristal y botón flotante de favoritos.
- **Suite de Servicios Online y Música Aurora Cloud**: Rediseño ergonómico de la pestaña de Aurora en Configuración con panel de test de conexión en vivo (medición de latencia y ping), chips de acceso rápido e integración de la Suite Musical en 3 áreas especializadas: Explorar Música (Audio HD), Pistas Instrumentales (Off-Vocal) y Karaokes con letras dinámicas (LRC / Sing), además de interruptor granular para el catálogo de Wallpapers.
- **Autorun Persistente Tras Actualización**: Mecanismo de auto-sanado que detecta al inicio si la preferencia de inicio automático con Windows estaba activa pero el instalador limpió la entrada del registro durante la actualización, y la re-registra de forma completamente silenciosa y automática.
- **Estabilización de Barras de Progreso y Rendimiento**: Migración del motor de canvas en `MediaProgressBar` hacia `ResizeObserver`, erradicando el cálculo continuo de layout por cuadro, asegurando un área de interacción inmutable de 28px y eliminando por completo cualquier parpadeo u oscilación de altura al interactuar con el puntero en vídeos y música.

## [1.0.1] - 2026-08-17

### Resumen
Actualización **Prisma v1.0.1** orientada a la expansión del ecosistema con hubs dedicados para **Luna Fetch** y **Gallery-DL GUI** en la barra de herramientas, sinergia activa con **Super Gallery** y panel enriquecido de aplicaciones vinculadas en **Aurora Synapse**, el nuevo **Convertidor Prisma** por lotes con soporte de carpetas completas y menús contextuales, agrupación inteligente de música por metadatos de álbum con vista de detalle dedicada, aislamiento selectivo de carpetas ocultas únicamente en la línea de tiempo, miniaturas completas en la vista de árbol y perfeccionamiento de alta precisión en **Prisma Quick Look** para Windows 11 con pestañas.

### Detalles
- **Herramientas del Ecosistema (Luna Fetch & Gallery-DL GUI)**: Secciones dedicadas en la barra de herramientas para Luna Fetch (descarga de vídeos y audio con selectores interactivos de formato y calidad) y Gallery-DL GUI (descarga masiva de álbumes, perfiles de arte y galerías completas con 4 modos de estructura), con comunicación directa por socket local / IPC, apertura fluida de contenidos en Prisma y diseño 100% armonizado bajo la paleta Material 3 Expressive.
- **Panel de Sinergia y Apps Vinculadas en Aurora Synapse**: Panel renovado en Configuración con detección de presencia LAN, gestión de carpeta de guardado y catálogo de aplicaciones vinculadas (Luna Fetch, Gallery-DL GUI, Super Gallery, LyraFlow, Ely-Tesia) con iconos oficiales empaquetados en alta resolución, badges de estado (*«Sinergia Activa»* / *«Próximamente»*) y botones de apertura directa o enlace a descargas y repositorios.
- **Convertidor Prisma e Integración Contextual**: Módulo de conversión por lotes para imágenes con soporte de procesamiento de archivos sueltos o carpetas completas, ajustes de redimensión proporcional, calidad y formatos (JPG, PNG, WebP, AVIF, BMP, TIFF, GIF...). Incluye acción directa desde el menú contextual con clic derecho en carpetas, álbumes y nodos del árbol jerárquico para enviar lotes al instante.
- **Carpetas Ocultas con Aislamiento Selectivo para la Línea de Tiempo**: Las carpetas configuradas como ocultas ahora se filtran exclusivamente en la pestaña de Tiempo, manteniéndose completamente visibles, indexadas y navegables en las vistas de Carpetas y Árbol Jerárquico.
- **Visualización Íntegra y Menús Contextuales en el Árbol**: Ajuste de proporción adaptativo en las miniaturas de imágenes y vídeos dentro de la vista de Árbol, evitando recortes para mostrar la composición original de cada archivo. Incorpora menú contextual (anticlic) completo en carpetas para conversión por lotes, reproducción, encolado y exploración directa.
- **Música Inteligente por Álbum y Vista Detallada**: Agrupación automática basada en etiquetas ID3 de álbum con fallback ordenado por carpetas. Nueva vista detallada de álbum con lista de pistas, duración total, carátula y doble interacción en tarjetas (clic para explorar canciones, botón central para reproducción directa), además de estabilización en el editor de metadatos.
- **Prisma Quick Look Perfeccionado para Windows 11**: Detección jerárquica de la pestaña activa en el Explorador de Windows 11 mediante seguimiento de foco e inspección de ventanas en primer plano, eliminando parpadeos y asegurando la previsualización del archivo exacto. Incorpora auto-cierre inmediato de la ventana flotante al abrir archivos con la aplicación predeterminada del sistema.
- **Densidad de Interfaz y Ajustes de Scroll**: Selector de densidad de altura en configuración con opción intermedia a 42px, inicio predeterminado en la parte superior sin retención de scroll al navegar por configuración y refactorización integral con tokens semánticos en diálogos de renombrado, convertidor y editor de etiquetas para legibilidad óptima en temas Claro y Oscuro.

## [1.0.0] - 2026-08-16

### Resumen
Lanzamiento inaugural de **Prisma v1.0.0**, la estación multimedia local-first diseñada bajo el lenguaje Material 3 Expressive para Windows. Combina reproducción de audio de alta fidelidad, visor cinematográfico de imágenes con editor integrado, reproductor de vídeo con PiP, Quick Look universal para todo tipo de archivos, **Bibliotecas Modulares Personalizables** con lector y editor in-app, y control remoto LAN mediante Aurora Synapse.

### Detalles
- **Bibliotecas Modulares y Lector/Editor Integrado**: Creación y gestión de colecciones personalizadas (Libros/PDFs, Documentos Markdown, Código Fuente, Proyectos Gráficos como Krita `.kra` y Photoshop `.psd`) con modo dividido (*Split View*), edición en tiempo real, atajos (`Ctrl+S`), control tipográfico (*Sans*, *Serif*, *Mono*) y zoom fluido de 11px a 32px.
- **Explorador y Biblioteca Universal**: Navegación fluida por Línea de Tiempo, Álbumes por Carpetas y Árbol Jerárquico para Música, Imágenes y Vídeos con ordenación dinámica por fecha, nombre, tamaño y modo aleatorio.
- **Prisma Quick Look Universal**: Previsualización instantánea con barra espaciadora desde el Explorador de Windows o Escritorio para audio, vídeo, imágenes, documentos PDF, textos planos, código y proyectos de diseño.
- **Reproductor de Vídeo y Modo PiP Adaptativo**: Proyección fluida con selección de pistas de audio y subtítulos, conmutación fluida, avance rápido 3.0x continuo y ventana flotante Picture-in-Picture que respeta la relación de aspecto original.
- **Visor y Editor de Imágenes**: Navegación suave entre fotos con zoom hasta 500%, filtros tonales, recorte interactivo, guardado seguro y aislamiento estricto de carpetas excluidas.
- **Sincronización y Mando Remoto LAN**: Control de reproducción, volumen, pistas y navegación a distancia desde dispositivos de la red local mediante el protocolo Aurora Synapse.
- **Listas de Reproducción y Gestión de Archivos**: Soporte universal de listas en formatos M3U, M3U8, PLS y XSPF con reconexión inteligente, historial consolidado y gestión de favoritos.
