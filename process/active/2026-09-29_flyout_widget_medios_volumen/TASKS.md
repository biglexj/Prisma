# Tareas — Flyout & Widget de Escritorio para Medios y Volumen

- [x] 1. **Configuración de Ventana en Tauri v2**:
  - [x] Añadir la definición de ventana `flyout` en `src-tauri/tauri.conf.json` (`decorations: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, `visible: false`).
  - [x] Actualizar `src/main.tsx` para enrutar el Webview hacia el componente `FlyoutWindow` si la ventana es `flyout`.
- [x] 2. **Backend Rust — Posicionamiento y Control de Ventana**:
  - [x] Implementar comando `show_flyout`, `hide_flyout` y `position_flyout(position_zone)` en Rust calculando el `work_area` del monitor primario/activo.
  - [x] Añadir soporte para las 6 zonas de pantalla: `bottom-left`, `bottom-center`, `bottom-right`, `top-left`, `top-center`, `top-right`.
  - [x] Exponer comandos en `src-tauri/src/app/commands/` y registrarlos en `lib.rs`.
- [x] 3. **Frontend UI — Componente `FlyoutWindow` y Estilos**:
  - [x] Crear `src/features/playback/ui/FlyoutWindow.tsx` con soporte para temas de acrílico/glassmorphism, animaciones elásticas y diseño Material 3 Expressive.
  - [x] Crear `src/features/playback/ui/flyout-window.css` con estilos premium, micro-sombras tonales y estados hover.
  - [x] Implementar la cápsula de volumen: deslizador interactivo, valor numérico, botón de silencio reactivo y toggle para mezclador.
  - [x] Implementar la tarjeta de medios: carátula/fotograma HD, título, artista/subtítulo, controles de transporte (prev, play/pause, next) y badge oficial de Prisma.
  - [x] Añadir visualizador de barras de espectro reactivas con micro-animaciones.
  - [x] Añadir botón de anclaje (Pin) para alternar entre Flyout temporal y Mini Widget persistente de escritorio.
- [x] 4. **Sincronización de Estado y Eventos**:
  - [x] Emitir eventos globales de Tauri (`prisma://flyout-state-sync`) desde el reproductor de audio y vídeo cuando cambie de pista, cambie el estado de reproducción o cambie el volumen.
  - [x] Sincronizar el timer de auto-ocultado (por defecto 3000 ms, configurable) que se pausa al pasar el cursor por encima (`onMouseEnter` / `onMouseLeave`).
- [x] 5. **Panel de Ajustes en Prisma**:
  - [x] Añadir controles en la configuración de Prisma para elegir la posición de pantalla (6 zonas), tiempo de permanencia y alternar visualizador o widget.
- [x] 6. **Intercepción Nativa de Teclas de Volumen y Estilo Fluent de Alto Contraste**:
  - [x] Interceptar `VK_VOLUME_UP` (0xAF), `VK_VOLUME_DOWN` (0xAE) y `VK_VOLUME_MUTE` (0xAD) en el hook global de Windows (`keyboard_hook.rs`).
  - [x] Consultar volumen real del sistema en Windows vía `IAudioEndpointVolume` (`flyout_get_system_volume`, `flyout_set_system_volume`).
  - [x] Disparar el flyout automáticamente con el nuevo volumen ante pulsaciones de teclas multimedia del teclado físico.
  - [x] Sustituir el fondo hiper-translúcido por acrílico Fluent de alta opacidad (96%) en modo claro (`#ffffff`) y oscuro (`#1c1c22`).
  - [x] Maximizar el contraste tipográfico (título en Slate 900 `#0f172a`, artista en Slate 700 `#334155` en modo claro; blanco y gris en modo oscuro) eliminando textos lavados.
  - [x] Eliminar el desplegable innecesario del mezclador y el botón chevron para un diseño limpio e inmediato.
- [ ] 7. **Validación y Pruebas**:
  - [x] Comprobar compilación de frontend (`bun run build`).
  - [x] Comprobar compilación de Rust (`cargo check`).
  - [ ] Comprobar compilación y ejecución de Tauri con la ventana flyout.
  - [ ] Verificar reposicionamiento en las 6 zonas y ausencia de cortes o parpadeos.
  - [ ] Comprobar funcionamiento tanto en música como en reproducción de vídeo.

## Corrección de volumen global y bloqueos — 2026-09-29

- [x] Separar el estado del volumen maestro de Windows de los metadatos y el volumen interno del reproductor.
- [x] Eliminar acciones que ajustaban simultáneamente Windows y Prisma desde el deslizador y silencio del flyout.
- [x] Liberar los mutex de geometría antes de operar la ventana; mostrar desde el hilo principal sin activar el foco.
- [x] Unificar teclas físicas y escrituras del deslizador en un worker serial; coalescer movimientos rápidos del deslizador.
- [x] Devolver las teclas a Windows cuando el flyout está desactivado o su worker no está disponible.
- [x] Cambiar la suscripción de volumen al cambiar el dispositivo predeterminado de Windows.
- [x] Ocultar la tarjeta multimedia cuando no hay música ni vídeo en reproducción.
- [x] Sustituir el historial de amplitud por tres barras animadas de reproducción junto al título, siguiendo la petición posterior de Biglex.
- [x] Excluir el flyout de la restauración de geometría y maximización persistida.
- [x] Comprobar cuatro pruebas del escritor de volumen, dos del cálculo de teclas y compilación de frontend.
- [ ] Confirmar teclas físicas, nivel global, ausencia de bloqueo y un único indicador con FluentFlyout cerrado.
- [x] Autoocultado de un segundo independiente de la sincronización de volumen y de la reproducción; limpiar temporizadores al ocultar y revisar hover actual al expirar.
- [x] Migrar el anclaje antiguo a desactivado y reducir el radio exterior a 10 px.
- [x] No reabrir por notificaciones nativas con el mismo volumen y silencio.
- [x] Sincronizar colores con el tema dinámico, usar una variante secundaria en las barras y aumentar 8 px la tarjeta multimedia.
- [x] Comprobar seis pruebas del temporizador y cuatro del escritor de volumen, más compilación del frontend.
- [ ] Validar visualmente autoocultado, pausa/reproducción, tres barras, seis posiciones y cambio físico de salida.

## Persistencia al 100 % y cinco barras — 2026-09-29

- [x] Identificar la diferencia entre apertura nativa y cierre mediante flags de Tauri/Tao.
- [x] Ocultar con `ShowWindow(SW_HIDE)` y sincronizar `ICoreWebView2Controller::SetIsVisible` al mostrar y ocultar.
- [x] Emitir señal visual al pulsar subir en 100 % o bajar en 0 %, aunque el valor no cambie.
- [x] Ampliar a cinco barras desfasadas dentro del mismo espacio y conservar colores dinámicos.
- [x] Verificar compilaciones web/nativa y 16 pruebas del flyout.
- [ ] Confirmar físicamente reacción y autoocultado en ambos límites, con reproducción y sin ella.

## Duración de dos segundos — 2026-09-30

- [x] Cambiar la duración predeterminada y de recuperación a 2000 ms para ambas tarjetas.
- [x] Migrar una vez la duración guardada e incluir 2 s en Configuración.
- [x] Verificar el vencimiento dos segundos después de la última interacción, las pruebas relacionadas y la compilación web.
- [ ] Confirmar visualmente el nuevo plazo; la captura de teclas en 0 % y 100 % sigue en revisión.
