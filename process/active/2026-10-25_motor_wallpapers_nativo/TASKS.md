# Tareas técnicas

Fase 1 implementada con revisión técnica; fase 2 iniciada y parcialmente validada en Windows.

## Fase 1 — vídeos de varias carpetas

- [x] Decidir alojamiento nativo (WorkerW / Progman) y validar sesión libmpv independiente del reproductor.
- [x] Implementar fuentes múltiples: añadir, habilitar/deshabilitar, actualizar por carpeta/todas y quitar solo el registro.
- [x] Persistir fuentes y ajustes en JSON atómico; normalizar rutas y evitar duplicados.
- [x] Construir cola conjunta con orden de carpetas y orden natural de archivos.
- [x] Implementar repetición continua, aleatorio por tandas y bucle para un único vídeo.
- [x] Integrar herramienta en la sección Herramientas de la barra lateral, configuración y vista nativa Material 3 Expressive.
- [x] Probar vídeo en vivo detrás de iconos en sesión interactiva de Windows (foco, Mostrar escritorio, Explorer, DPI y cierre limpio).
- [x] Eliminar pase a negro entre transiciones mediante playlist nativo libmpv (`prefetch-playlist=yes`, `cache=yes`, `demuxer-max-bytes=400M`, `keep-open=yes`, `auto-window-resize=no`).
- [x] Añadir control bidireccional de transporte (Anterior y Siguiente) con salto prefetcheado instantáneo.
- [x] Implementar cuadrícula de vídeos de 6 columnas con miniaturas nativas (`VideoThumbnail`), badges de formato y estado activo en pantalla.
- [x] Resolver reproducción inmediata al hacer clic en cualquier tarjeta de vídeo (`load_video`) restaurando el pipeline canónico y eliminando opciones de pausa conflictivas de libmpv.
- [x] Garantizar extracción y despliegue de miniaturas para todos los formatos (incluyendo contenedores .mkv y títulos con apóstrofes especiales Unicode) mediante fallback robusto con FFmpeg en `load_video_thumbnail_data_url`.
- [x] Diagnosticar por qué el fondo no se pintaba: `vo=auto` ya no existe en mpv v0.41 (`Video output auto not found!`); la salida de vídeo debe nombrarse (`vo=gpu`).
- [x] Verificar el orden de propiedades de libmpv: `vo` debe fijarse **antes** que `wid`; con el orden inverso la reproducción avanza pero no se pinta (comprobado por captura de píxeles).
- [x] Verificar en vivo con captura de pantalla que el vídeo se pinta detrás de los iconos y del taskbar (100 % de píxeles del vídeo en la franja del escritorio).
- [x] Propagar los errores de configuración de libmpv y comprobar que la salida de vídeo arranca, en lugar de fallar en silencio con un escritorio negro.
- [x] Blindar el bucle de un único vídeo: con `loop-file=inf` el reinicio del archivo provocaba un parpadeo negro en cada vuelta.
- [x] Añadir ocultar con botón de ojo en carpetas y vídeos (estado gris, excluido de la cuadrícula y de la cola de reproducción, persistido en `live_wallpapers.json`).
- [x] Activar o desactivar el sonido del fondo con sesión de audio independiente: con el sonido apagado el fondo no abre dispositivo de audio (`ao=null`), de modo que nunca silencia ni altera la música que esté sonando en el reproductor de Prisma.
- [x] Exponer el interruptor de sonido en la vista de Fondos Vivos y en el submenú de la bandeja del sistema.
- [x] Añadir controles de Fondos Vivos en el menú de la bandeja del sistema (System Tray) con submenú interactivo: Siguiente, Anterior, Pausar/Reanudar, Encender/Apagar y Abrir.
- [x] Añadir widget de Fondos Vivos en la vista de Inicio (HomeDashboard) con controles de transporte y estado en vivo.
- [x] Validar flujo real con A/B/C y distribución nativa.
- [x] Capa 1: admitir imágenes estáticas además de vídeos, con carpetas que mezclen ambos.
- [x] Capa 1: switch de tipo arriba de la cajita (Vídeos por defecto / Imágenes / Combinado), sin mezclar por defecto.
- [x] Capa 1: duración de imagen configurable (`imageDurationSec`, 20 s por defecto) con avance de cola al cumplirse.
- [x] Capa 1: miniaturas de imagen en la cuadrícula y textos coherentes con el tipo activo.
- [x] Capa 1: registrar el error del autoarranque en vez de descartarlo en silencio.
- [x] Cerrado ordenado de la sesión de mpv al soltar el motor (fin del `STATUS_ACCESS_VIOLATION`).

## Fase 2 — composición Aurora

- [x] Revisar compositor Three.js, efectos, controles, recursos y consumidores vigentes de Aurora.
- [x] Definir unidad de reutilización y mantenimiento sin duplicación divergente.
      Resultado verificado: 15 archivos / 1.218 líneas bajo `dynamic-backgrounds/`, three.js puro, texturas 100 % procedurales, sin Supabase ni React Router. Bloqueos identificados: `LayeredThreeBackground.tsx` es React, `controls.ts` mezcla React, `vtuberAssets` hay que descartarlo, `BackgroundInteraction` no retira listeners, seis efectos leen `window.innerWidth/innerHeight`.
- [x] Probar composición Aurora en superficie web nativa de Windows, sin carpeta ni mpv requeridos.
- [ ] Integrar capas y presets pertinentes; avatar opcional, sin requerir conversación ni cuenta.
- [ ] Compartir controles y combinar medio base y composición con apagado independiente.
- [ ] Verificar pausa independiente, transparencia, cursor optativo, limpieza y recuperación de Explorer.
- [ ] Medir CPU/GPU/RAM y comprobar recursos locales/distribución antes de ampliar efectos.

## Modelo anterior de capas (sustituido por la aclaración del 2026-10-26)

Sin capa cero. La numeración arranca en 1.

- [x] Capa 1 · Medios base: vídeo o imagen estática.
- [ ] Capa 2 · Fondos dinámicos.
- [ ] Capa 3 · Fondos y escenarios 3D.
- [ ] Capa 4 · Partículas.
- [ ] Capa 5 · Ecualizador: efectos reactivos al audio.
- [ ] Capa 6 · Parallax.

## Revisión e inicio de fase 2

- [x] Corregir campo omitido de snapshot que impedía compilar el árbol recibido.
- [x] Detener y liberar el fondo al ocultar la última carpeta elegible.
- [x] Evitar interbloqueo al crear el webview desde un comando síncrono; creación y alojamiento en el hilo principal.
- [x] Sustituir malla de prueba por compositor Aurora y subconjunto de efectos trazable.
- [x] Añadir Fondos 3D en el selector superior en lugar de Combinado, con controles propios y sin carpetas de medios.
- [x] Guardar escena y ambiente, coordinar pausa y liberar WebGL/listeners al cerrar.
- [x] Verificar Holo Ciudad sin fuentes locales en WebView2: animación, pausa y cierre de superficie.
- [ ] Completar políticas automáticas de pausa y recuperación de Explorer de fase 1.
- [ ] Integrar partículas independientes, ecualizador del audio del vídeo y parallax; medir recursos.

## Catálogo completo y galería — implementación local

- [x] Sincronizar los 25 efectos, dependencias y catálogo compartido UI/backend.
- [x] Miniaturas reales, galería de 46 opciones con filtros y búsqueda, sin WebGL por tarjeta.
- [x] Controles persistentes por efecto; visibilidad y pausa por capa.
- [x] Ambiente como capa 2 independiente: solo o sobre imagen/vídeo; color sólido/degradado con opacidad.
- [x] Dinámicos, escenarios, partículas 3D y partículas 2D independientes.
- [x] Parallax opcional en capas con cámara y medio base; lectura nativa de cursor.
- [x] Comprobar 25 efectos en WebView2; coexistencia de imagen/vídeo con capas, pausas y cierre.
- [x] Exportar y comprobar 25 PNG a 1920 × 1080 para otras aplicaciones.
- [ ] Verificar visualmente clics/orden frente a iconos en toda la composición final y recuperación de Explorer.
- [ ] Medir CPU/GPU/RAM sostenidos y completar ecualizador real y políticas automáticas.

## Corrección de separación por pestañas — 2026-10-26

- [x] Sustituir Fondos y efectos por Ambiente, Dinámicos, Escenarios 3D, Partículas y Parallax junto a Vídeos/Imágenes.
- [x] Eliminar Todos y los filtros duplicados; cada pestaña muestra exclusivamente su catálogo y controles.
- [x] Unificar navegación de partículas con selector interno 3D/2D, conservando ambos estados.
- [x] Explicar Dinámicos con ejemplos concretos y corregir controles de otras capas ocultos cuando el ambiente era sólido.
- [x] Comprobar navegación por teclado, aislamiento de catálogos y conservación de capas activas.

## Orden canónico de Aurora — sustituye la separación anterior

- [x] Consultar catalog.ts, DYNAMIC_BACKGROUND_GROUPS y ui/tabs/Fondos/Dinamicos.tsx del frontend Aurora vigente.
- [x] Eliminar la pestaña Dinámicos y reunir los 25 elementos en Escenarios 3D.
- [x] Reproducir grupos y orden Aurora: Escenarios 3D (17) y Efectos 3D (8).
- [x] Mantener partículas superpuestas aparte; seleccionar escenario reemplaza el anterior sin modificar ambiente ni partículas superpuestas.
- [x] Conservar controles y ajustes por efecto; verificar agrupación, orden, búsqueda y tamaño reducido.

## Pulido funcional de reproducción

- [x] Aplicar ambiente/escenario al hacer clic, guardando antes de activar; propagar errores de guardado/activación.
- [x] Mostrar explícitamente ventana y WebView2; verificar visibilidad del controlador en prueba nativa.
- [x] Eliminar escenarios simultáneos heredados y limitar efectos WebGL a 30 fps sin retimar vídeo.
- [x] Reproducir GIF en bucle dentro de Imágenes y probar animación después del primer ciclo.
- [x] Comprobar decodificación a resolución original 4K; ajustar filtros ligeros de escalado.
- [x] Encerrar interruptores de Parallax en tarjetas visibles, con checkbox y texto alineados.
- [ ] Confirmación visual del usuario sobre el escritorio y fluidez de sus vídeos reales; sin atribuirla al test sintético.

## Incidencia de composición invisible

- [x] Reabrir incidencia tras confirmación de Biglex; descartar isVisible como prueba visual suficiente.
- [x] Identificar WS_EX_LAYERED sin alfa nativa inicializada y verificar atributos antes/después en WebView2 real.
- [x] Inicializar/verificar alfa global 255 y aplicar estilos de hija después de mostrar mediante Tauri.
- [x] Probar coexistencia de PNG, partículas y escenario en instancia aislada.
- [x] Confirmación visual de Biglex sobre imagen en el escritorio: «Sí, ahora aparece» (2026-10-26).

## Corrección prioritaria del zoom

- [x] Reproducir control sin efecto en Lente Gravitacional y Prisma antes de modificarlo.
- [x] Corregir muestreo UV en BackgroundProjection compartido de Aurora y sincronizar copia Prisma.
- [x] Probar render real a zoom 0,1/0,5/1/2/2,5; preservar encuadre exacto a zoom 1.
- [x] Conservar lógica espacial y Gargantúa sin modificaciones.
- [ ] Biglex indica el nuevo zoom inicial deseado de Lente Gravitacional; se mantiene en 1 por ahora.
- [ ] Activadores de imagen/vídeo y ajustes de ambiente: diferidos hasta terminar zoom.

- [x] Aplicar a Lente Gravitacional el encuadre base equivalente al antiguo zoom 0,5, mostrando zoom normal 1 en ambos proyectos.
- [x] Mantener controles de zoom funcionando sobre el nuevo encuadre; Gargantúa sin cambios.

## Interacción de escenarios y espacio de Parallax

- [x] Reutilizar onClick de los efectos Aurora para Burbujas Explosivas y Nexo Cuántico.
- [x] Raw Input del ratón mientras el efecto está activo; filtrar al escritorio de Explorer, ignorar arrastres y otras aplicaciones.
- [x] Convertir coordenadas del clic a punto 3D; preservar cada cambio de forma y el pulso de explosión a velocidad alta.
- [x] Limitar cola y retirar registro/temporizadores al cambiar, pausar o cerrar.
- [x] Ampliar controles de Parallax a todo el ancho disponible con adaptación a ventana estrecha.
- [x] Confirmación física de Biglex: «Sí, responde al clic» (2026-10-26).
