# Flyout & Widget de Escritorio para Medios y Volumen — Plan

- Estado: `DRAFT`
- Fecha: `2026-09-29`
- Proyecto: `Prisma`

## Objetivo

Implementar un Flyout y Mini Widget de escritorio nativo en Prisma para control de volumen y reproducción multimedia (música y vídeo), con posicionamiento paramétrico en 6 zonas de pantalla, diseño Material 3 Expressive y sincronización fluida en tiempo real, erradicando la dependencia de utilidades de terceros como FluentFlyout.

## Alcance

- Incluye:
  - **Ventana Nativa Secundaria `flyout` (Tauri v2)**: Ventana acrílica transparente, sin bordes, siempre visible (`alwaysOnTop`), fuera de la barra de tareas (`skipTaskbar`), con ciclo de vida reactivo (aparición con micro-animación y auto-ocultado paramétrico).
  - **Tarjeta de Medios (Media Card)**: Proyección de carátula en alta resolución/miniatura de vídeo, título, artista, estado de reproducción y controles interactivos de transporte (anterior, play/pause, siguiente).
  - **Tarjeta de Volumen (Volume Card)**: Deslizador con ganancia porcentual, icono reactivo de altavoz/silencio y soporte para desplegar el mezclador o volumen de Prisma.
  - **Posicionamiento Paramétrico (6 Zonas)**: Cálculo dinámico de coordenadas en base al área de trabajo del monitor (`work_area`), permitiendo posicionar el flyout en:
    1. Abajo Izquierda (predeterminado / clásico)
    2. Abajo Centro (estilo Windows 11)
    3. Abajo Derecha (área de bandeja/reloj)
    4. Arriba Izquierda (estilo Windows 10 OSD)
    5. Arriba Centro (estilo HUD / Dynamic Island)
    6. Arriba Derecha (estilo notificaciones)
  - **Visualizador de Espectro Reactivo**: Renderizado de barras de audio en tiempo real integrado directamente en la tarjeta (característica comúnmente de pago en utilidades externas).
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
   - Conectar eventos de volumen de Prisma y atajos globales.
4. **Visualizador de Audio & Controles en Ajustes**:
   - Integrar un visualizador de frecuencias liviano basado en WebAudio / datos de reproducción.
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
