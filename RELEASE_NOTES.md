# 🌌 Release Notes - Prisma

> [!IMPORTANT]
> **Protocolo de Verificación de Versión en GitHub ("Lanzar actualización") [CRÍTICO]:**
> - Al recibir la orden de *"Lanzar actualización"*, es **OBLIGATORIO Y DE LEY** consultar primero la última versión publicada en GitHub / remoto (`gh release list` o `git ls-remote --tags`).
> - Si la versión local ya fue subida (así haya sido lanzada hace minutos), NUNCA se debe sobrescribir ni re-etiquetar. Se DEBE incrementar obligatoriamente a la siguiente versión de parche (e.g. `0.0.1` → `0.0.2`).
>
> **Sanitización de Notas (CRÍTICO):**
> - Los mensajes de las notas de lanzamiento DEBEN estar limpios de rutas de archivos del sistema local (ej. `d:\Proyectos\...`), nombres de variables internas, fragmentos de prompts o logs técnicos de depuración. Deben redactarse con lenguaje limpio, profesional y enfocado al usuario final.
>
> **Regla del .9 para Versionado:**
> - Nunca se debe pasar de una versión de parche `.9` (ej. de `0.0.9` no se pasa a `0.0.10`). Al alcanzar el límite del parche `.9`, se incrementa el número menor/secundario (ej. pasando a `0.1.0`).
> - **Extensión proporcional en Release Notes:** La cantidad de párrafos depende del alcance: 1 para un hito pequeño, 2 cuando hay dos cambios relevantes, 3 como extensión habitual, 4 para hitos relativamente grandes y hasta 5 para lanzamientos de gran alcance. Cada párrafo debe concentrarse en un cambio principal y evitar descripciones excesivamente largas o listas detalladas de archivos.

Registro histórico de cambios y versiones de Prisma.

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
