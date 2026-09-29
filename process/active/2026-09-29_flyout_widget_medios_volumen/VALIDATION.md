# Validación — Flyout & Widget de Escritorio para Medios y Volumen

- Proceso: `process/active/2026-09-29_flyout_widget_medios_volumen/`
- Estado: `EN CURSO`
- Fecha: `2026-09-29`

## Criterios de Aceptación

1. **Ventana e Integración**:
   - [ ] La ventana secundaria `flyout` se instancia con transparencia real y sin marco del sistema operativo.
   - [ ] No genera icono en la barra de tareas (`skipTaskbar: true`).
2. **Posicionamiento Paramétrico**:
   - [ ] Permite cambiar dinámicamente entre las 6 zonas de pantalla: `bottom-left`, `bottom-center`, `bottom-right`, `top-left`, `top-center`, `top-right`.
   - [ ] El posicionamiento respeta el margen de la barra de tareas de Windows (usando el área de trabajo real del monitor).
3. **Reproducción de Medios**:
   - [ ] Muestra la carátula o miniatura del vídeo en alta calidad sin retraso ni caídas de imagen.
   - [ ] Los botones Anterior, Play/Pause y Siguiente controlan directamente la sesión activa de Prisma.
4. **Volumen & Visualizador**:
   - [ ] El nivel de volumen y el botón de silencio se actualizan bidireccionalmente.
   - [ ] Tres barras animadas indican reproducción junto al título; con movimiento reducido quedan estáticas.
   - [ ] Permite fijar el widget con el botón Pin para que no se oculte tras el tiempo de expiración.

## Evidencia de Validación

- **Compilación Frontend (`bun run build`)**: Exitosa en 3.69s (`tsc --noEmit && vite build`) sin errores.
- **Compilación Rust (`cargo check`)**: Exitosa en 14.12s sin errores ni warnings.
- **Intercepción Teclado**: Hook de teclado `WH_KEYBOARD_LL` actualizado para capturar `0xAD` (mute), `0xAE` (volumen abajo), `0xAF` (volumen arriba) y notificar al backend en 0 ms.
- **Lectura/Escritura de Volumen de Windows**: Integración nativa mediante `IAudioEndpointVolume` (COM API) en [flyout.rs](file:///D:/Proyectos/biglexj/Prisma/src-tauri/src/app/commands/flyout.rs).
- **Legibilidad y Contraste**: Sustitución de hiper-transparencia por acrílico Fluent de alta opacidad (96%) en [flyout-window.css](file:///D:/Proyectos/biglexj/Prisma/src/features/playback/ui/flyout-window.css) con textos en Slate 900 `#0f172a` y Slate 700 `#334155` en modo claro, garantizando máxima legibilidad.
- **Commit de Resguardo**: `c6adb66` (*checkpoint: session 2026-09-29 - flyout teclado volumen nativo y contraste alto claro oscuro*).

## Corrección del volumen global — 2026-09-29

### Causas verificadas en el código

- El estado enviado por `useFlyoutSync` incluía el volumen del reproductor y sobrescribía el volumen maestro recibido por el flyout.
- El deslizador y silencio escribían al endpoint de Windows y enviaban a la vez acciones al reproductor. Se eliminaron estas acciones y la propagación de volumen del reproductor.
- `LAST_SIZE` permanecía bloqueado durante `set_size`/`set_position`, permitiendo un ciclo de espera entre callbacks y el hilo UI. Ahora se copia la geometría y se libera el bloqueo antes de operar la ventana.
- Las pulsaciones se ejecutaban en hilos independientes y podían leer simultáneamente el mismo nivel. Ahora el worker ejecuta teclas y escrituras en orden.
- La suscripción de volumen se registraba una vez para el endpoint inicial. Ahora se comprueba la identidad del endpoint predeterminado cada 500 ms y se renueva la suscripción.

### Cambios y comprobaciones

- Windows `eConsole`/`eRender` es la fuente del volumen global y silencio. Las escrituras utilizan un contexto propio para distinguir las notificaciones internas y no abrir otra ventana desde un callback COM.
- El hook únicamente encola pulsaciones cuando el flyout está habilitado y el worker está listo. La ventana se muestra con `SWP_NOACTIVATE`; el foco de la otra aplicación se conserva.
- La tarjeta de medios solo se renderiza si hay reproducción activa. El historial de pico real incorporado inicialmente se sustituyó posteriormente por tres barras decorativas junto al título a petición de Biglex.
- `bun test tests/system-volume-writer.test.ts`: 4/4, 12 aserciones. Orden y coalescencia, fallo intermedio, reintento y desmontaje.
- `cargo test --offline --manifest-path src-tauri/Cargo.toml --lib system_volume -- --test-threads=1`: 2/2, límites y silencio. Primera ejecución correcta antes del último ajuste de despacho mediante oneshot y visibilidad.
- `bun test tests/system-volume-writer.test.ts tests/audio-output.test.ts tests/audio-recovery.test.ts`: 14/14, 26 aserciones.
- `bun run build`: TypeScript y Vite correctos, 272 módulos. Advertencia de tamaño de bundle preexistente.
- El terminal de desarrollo mostró compilación y arranque de `target/debug/prisma.exe` después de los ajustes nativos. No se inició otra instancia de la app.
- Repetir `cargo test` mientras Prisma Dev utiliza el mismo target produjo `os error 32` al copiar recursos DLL; no es un error del código Rust. No se cerró la app del usuario ni se modificaron recursos para forzar esta segunda ejecución.
- Referencia de diseño consultada: https://fluentflyout.com/changelog/ y las capturas suministradas por Biglex.

### Límites de validación

- En la primera inspección `FluentFlyout.exe` seguía ejecutándose. Biglex después lo cerró y se comprobó su ausencia. Una captura posterior todavía muestra el indicador nativo de Windows junto a Prisma; su supresión sigue pendiente de validación.
- Se inspeccionó Home de Prisma Dev mediante Computer Use. La tecla multimedia no está soportada por esa API; las inspecciones posteriores coincidieron con recompilaciones/minimización y actividad del usuario. No se atribuye a esta comprobación una validación funcional del flyout.
- Sigue pendiente la confirmación física del usuario del nivel global, pulsaciones, ausencia de bloqueo, ocultación de medios y un único indicador con FluentFlyout cerrado. También faltan las seis posiciones y el cambio físico de dispositivo.

## Corrección del autoocultado y barras de reproducción

- Biglex reportó que el panel permanecía visible incluso después de establecer un segundo. En código se verificó que cada evento `system-volume-changed` reiniciaba el contador, incluidos los eventos de resincronización de dispositivos.
- Solo `flyout-shown`, ajustes del temporizador y acciones del usuario reinician ahora el plazo. La sincronización del volumen y los metadatos multimedia no lo prolongan.
- Al expirar se consulta el hover actual del contenido en lugar de guardar una bandera de entrada potencialmente obsoleta. Una salida del ratón perdida se recupera en la siguiente comprobación. Ocultar cancela el temporizador y cierra las opciones; abrir las opciones por sí solo no fija permanentemente el panel.
- Migración única del anclaje antiguo a desactivado; el usuario puede fijarlo explícitamente después. Duración predeterminada de 1000 ms y radios exteriores de 10 px.
- Tres barras con animaciones desfasadas a la derecha del título, activas solo mientras hay reproducción y ventana visible; respetan `prefers-reduced-motion`.
- `bun test tests/flyout-auto-hide.test.ts tests/system-volume-writer.test.ts`: 10/10, 25 aserciones. Plazo, nueva pulsación, interacción, hover/anclaje, recuperación sin evento de salida y cancelación/reapertura.
- `bun run build`: TypeScript y Vite correctos, 273 módulos; advertencia preexistente de tamaño del bundle.
- Autoocultado y diseño en la ventana real pendientes de confirmación; las pruebas verifican la lógica del temporizador.
- El callback nativo también compara el nivel y silencio con su último evento: las notificaciones repetidas no vuelven a mostrar la ventana. Las pulsaciones físicas siguen mostrándola incluso en los límites.
- Tokens del tema principal enviados al flyout con recuperación de estado al abrirlo; volumen con acento principal y barras con una variante secundaria derivada del acento y texto secundario existentes.
- Ajuste visual posterior solicitado por Biglex: tarjeta multimedia 8 px más alta (98 px con bordes y padding), tres barras de hasta 24 px en un área de 52 px, animaciones con duraciones y desfases distintos.
- Comprobación final conjunta: 17/17 pruebas (42 aserciones) incluyendo transiciones de reproducción, y compilación de frontend correcta con 275 módulos.
- El watcher existente recompiló la comparación de notificaciones nativas y arrancó `target/debug/prisma.exe` correctamente: `Finished dev profile` en 11.06 s. No se lanzó otra instancia ni se repitió Cargo contra DLLs en uso.

## Corrección de visibilidad nativa y límites — 2026-09-29

- Biglex volvió a reportar persistencia durante más de diez segundos, al pulsar subir estando al 100 %, y barras sin movimiento.
- Causa comprobada en fuentes locales: se abría con `SetWindowPos(SWP_SHOWWINDOW)`, pero se cerraba con `win.hide()`. Tao conserva sus flags iniciales de ventana oculta; su `apply_diff` retorna sin operación cuando se solicita de nuevo ese estado. No se atribuye el fallo al temporizador solo por sus pruebas unitarias.
- El cierre de Windows ahora usa `ShowWindow(SW_HIDE)`, coherente con la apertura nativa. Ambos caminos sincronizan la visibilidad del controlador WebView2. La apertura sigue usando `SWP_NOACTIVATE`.
- Reacción de límite recibida por evento dedicado: pulsa la cápsula y el porcentaje durante 250 ms cuando la tecla intenta superar 100 % o bajar de 0 %. Cada pulsación sigue presentando el flyout, aunque no cambie el valor.
- Cinco barras de 5 px, alturas de 16–24 px y fases distintas, dentro del mismo espacio de 52 px. Se conserva la variante secundaria del tema y el respeto a movimiento reducido.
- Consulta de solo lectura `SPI_GETCLIENTAREAANIMATION`: Windows permite animaciones de área cliente en esta sesión; no se modificó esa preferencia.
- `bun run build`: TypeScript y Vite correctos, 277 módulos; aviso preexistente de tamaño de bundle.
- `bun test tests/flyout-auto-hide.test.ts tests/flyout-media.test.ts tests/system-volume-writer.test.ts`: 16/16, 47 comprobaciones. Incluye nuevas presentaciones repetidas sin cambio de volumen y expiración tras la última pulsación.
- Watcher nativo existente: compilación correcta en 12,57 s y ejecución de `target/debug/prisma.exe`. No se inició otra instancia de Prisma.
- `git diff --check`: correcto. Aceptación física de autoocultado y animación pendiente; se pidió comprobar la tecla soltada y el ratón fuera del panel. El anclaje o mantener el ratón sobre el contenido siguen suspendiendo el autoocultado según el comportamiento vigente.
