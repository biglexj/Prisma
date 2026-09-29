# Flyout & Widget de Escritorio para Medios y Volumen — Plan

- Estado: `EN CURSO`
- Fecha: `2026-09-29`
- Proyecto: `Prisma`

## Objetivo

Implementar un Flyout y Mini Widget de escritorio nativo en Prisma para control de volumen y reproducción multimedia (música y vídeo), con posicionamiento paramétrico en 6 zonas de pantalla, diseño Material 3 Expressive y sincronización fluida en tiempo real, erradicando la dependencia de utilidades de terceros como FluentFlyout.

## Alcance

- Incluye:
  - **Ventana Nativa Secundaria `flyout` (Tauri v2)**: Ventana acrílica transparente, sin bordes, siempre visible (`alwaysOnTop`), fuera de la barra de tareas (`skipTaskbar`), con ciclo de vida reactivo (aparición con micro-animación y auto-ocultado paramétrico).
  - **Tarjeta de Medios (Media Card)**: Proyección de carátula en alta resolución/miniatura de vídeo, título, artista, estado de reproducción y controles interactivos de transporte (anterior, play/pause, siguiente).
  - **Tarjeta de Volumen (Volume Card)**: Deslizador del volumen maestro de Windows, porcentaje, silencio y opciones de posición y anclaje.
  - **Posicionamiento Paramétrico (6 Zonas)**: Cálculo dinámico de coordenadas en base al área de trabajo del monitor (`work_area`), permitiendo posicionar el flyout en:
    1. Abajo Izquierda (predeterminado / clásico)
    2. Abajo Centro (estilo Windows 11)
    3. Abajo Derecha (área de bandeja/reloj)
    4. Arriba Izquierda (estilo Windows 10 OSD)
    5. Arriba Centro (estilo HUD / Dynamic Island)
    6. Arriba Derecha (estilo notificaciones)
  - **Indicador de reproducción**: Cinco barras decorativas animadas junto al título, con variante secundaria del tema dinámico.
  - **Modo Anclado / Pin**: Botón de fijación para transformar el flyout en un mini-widget persistente mientras se trabaja en otras aplicaciones.
  - **Panel de Configuración en Prisma**: Opciones de personalización (posición, duración en ms, apilado de volumen sobre medios, visualizador activo).
- No incluye:
  - Modificación de drivers de hardware o inyección de DLLs a nivel de kernel.

## Enfoque

1. **Infraestructura de Ventana en Tauri v2 y Rust**:
   - Registrar la ventana `flyout` en `tauri.conf.json` y handlers en Rust para posicionamiento matemático según el monitor activo y zona seleccionada (`set_flyout_position`).
   - Gestión de eventos de visibilidad (`show_flyout`, `hide_flyout`, temporizador de cierre configurable).
2. **Componente de UI y Diseño Material 3 Expressive**:
   - Crear la vista `FlyoutWindow` en `src/features/playback/ui/FlyoutWindow.tsx` con soporte para temas tonales, blur acrílico, ondas de volumen y controles hápticos.
   - Apilamiento reactivo: cápsula de volumen superior con chevron desplegable y tarjeta de medios inferior.
3. **Sincronización Bidireccional de Medios**:
   - Conectar la reproducción activa de Prisma (Música y Vídeo) para alimentar carátulas en memoria (evitando caídas o retardos de archivos temporales).
   - Conectar notificaciones y teclas de volumen maestro de Windows, manteniendo independiente el volumen del reproductor.
4. **Indicador de reproducción & Controles en Ajustes**:
   - Integrar cinco barras decorativas de reproducción, sin consultas de audio para animarlas.
   - Añadir la sección de personalización en la vista de Ajustes / Configuración de Prisma.

## Criterios de finalización

- [ ] La ventana `flyout` se inicializa y oculta correctamente sin parpadeos ni artefactos de recorte.
- [ ] La carátula, título y artista se proyectan con 100% de fiabilidad tanto en pistas de música como en vídeos.
- [ ] Los controles de transporte (play/pause, anterior, siguiente) responden de forma instantánea.
- [ ] El deslizador y porcentaje de volumen reflejan el estado sonoro de forma fluida.
- [ ] El flyout se reposiciona con precisión matemática en las 6 zonas de pantalla solicitadas sin solapar la barra de tareas.
- [ ] El usuario puede activar/desactivar el modo anclado (widget persistente) y el visualizador de audio.
- [ ] No existen dependencias con FluentFlyout ni herramientas externas.

## Autorización

- [x] Plan aprobado para ejecución (solicitado directamente por el usuario: *"¡Implementémoslo! Tomemos las ideas de eso... plantéalo, hay que hacerlo y ve haciendo"*).

## Corrección autorizada — 2026-09-29

Biglex solicita reemplazar el indicador de volumen de Windows con el de Prisma: el nivel debe proceder exclusivamente del volumen maestro del dispositivo predeterminado de Windows. El volumen del reproductor permanece independiente. Sin música o vídeo en reproducción, mostrar únicamente la cápsula de volumen. Corregir bloqueos de la ventana, pulsaciones concurrentes, sincronización al cambiar de dispositivo y respeto a la opción de desactivar el flyout. Pulir el panel usando las capturas y https://fluentflyout.com/changelog/ como referencia visual.

## Refinamiento solicitado durante las pruebas

- Autoocultar ambas tarjetas tras un segundo sin interacción; las notificaciones de sincronización y la reproducción no prolongan el plazo.
- Radio exterior de 10 px, reducido a petición de Biglex.
- Sustituir el historial de amplitud por tres barras animadas junto al título. Es un indicador decorativo de reproducción solicitado por Biglex, no un análisis de frecuencias ni una medición de audio.
- Desactivar una sola vez el anclaje guardado por versiones anteriores. El botón Fijar sigue permitiendo activar explícitamente el modo persistente.
- Usar los tokens del tema dinámico existente para el volumen y una variante secundaria para las barras. Tarjeta de medios 8 px más alta, barras de hasta 24 px y ancho de 52 px similar al distintivo de Prisma.
