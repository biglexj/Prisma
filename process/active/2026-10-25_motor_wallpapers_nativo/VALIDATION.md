# Validación

## Planificación

- [x] Inspeccionada base Prisma de wallpapers, libmpv y cierre/bandeja.
- [x] Inspeccionado compositor Three.js de Aurora y documentación de seis capas.
- [x] Registrada dirección de Biglex: fase 1 vídeos de varias carpetas; fase 2 reutilización de Aurora.
- [x] Definidos orden conjunto, aleatorio, fuentes activas, deduplicación y recuperación.
- [x] Aura permanece únicamente como referencia conceptual.

## Fase 1 — implementación y validación técnica

- [x] Motor de renderizado en ventana hija WorkerW / Progman con libmpv (`wid`) implementado en `src-tauri/src/features/wallpapers/`.
- [x] Gestión multicarpeta (A/B/C) con orden natural, deduplicación canónica y persistencia atómica en `live_wallpapers.json`.
- [x] Modos En orden y Aleatorio sin repetición contigua por tanda.
- [x] Integración en barra lateral (sección HERRAMIENTAS), configuración de herramientas (`ToolsSettingsPanel`) y vista Material 3 Expressive (`LiveWallpapersView.tsx`).
- [x] Contraste tonal y ancho unificado con el estándar de pestañas (100% responsive, variables semánticas --on-surface/--surface-container y depuración del prefijo canónico `\\?\`).
- [x] Optimización de transición sin pantallazo negro: migrado de recarga destructiva (`loadfile replace`) a lista de reproducción nativa libmpv (`prefetch-playlist=yes`, `cache=yes`, `demuxer-max-bytes=400M`, `demuxer-readahead-secs=20`, `keep-open=yes`, `auto-window-resize=no`). El búfer pre-decodifica el siguiente archivo en RAM para cambio de fotograma sin pase en negro.
- [x] Controles bidireccionales de transporte añadidos en Rust (`live_wallpaper_prev`) y UI (`LiveWallpapersView.tsx`).
- [x] Cuadrícula de 6 columnas de vídeos con miniaturas nativas de Windows Shell (`VideoThumbnail` con fallback canvas), micro-animaciones elevadas, overlay de reproducción, formato y badge verde brillante de "En pantalla" activo.
- [x] Corregida la selección directa de vídeo al hacer clic en tarjeta: restauración del pipeline canónico `load_video(path, single, fit)` en `VideoWallpaperEngine`, eliminando la propiedad conflictiva `reset-on-next-file=pause` que congelaba la sesión, y sincronizando el monitor loop mediante comprobación periódica de `is_eof()`. Verificado en tiempo real con recompilación exitosa de `tauri dev`.
- [x] Resuelto fallo de miniaturas en archivos `.mkv` y títulos con caracteres especiales Unicode: corrección de `load_video_thumbnail_data_url` en `media_preview/mod.rs` para que el error de Windows Shell delegue inmediatamente en `load_video_thumbnail_ffmpeg`. Verificado con éxito mediante test unitario nativo `test_load_lumi_video_thumbnails` sobre `03. Who’s up for a Snowball Fight With Lumi.mkv` y `05. Nothin Sa s S rin Like Bubbles and Blossoms.mp4`.
- [x] Compilación Rust verificada: `cargo check` finalizado con 0 errores y 0 advertencias.
- [x] Compilación frontend verificada: `bun run build` finalizado con 0 errores.
- [x] Pruebas unitarias de ordenación natural y gestión de colas verificadas: `bun test tests/live-wallpapers.test.ts` (4 pass, 0 fail).
- [x] **Causa raíz del fondo en negro localizada y corregida**: la sesión de libmpv pedía la salida de vídeo `auto`, que mpv v0.41 ya no incluye (`[e][vo] Video output auto not found!` → `Error opening/initializing the selected video_out (--vo) device`). Con `vo=gpu` la salida arranca, se comprueba con `vo-configured` y se propaga el error si falla. El mismo `vo=auto` estaba en el reproductor de medios (`infrastructure/media/mpv.rs`) y se corrigió allí también.
- [x] **Orden de propiedades verificado**: `vo` debe fijarse antes que `wid`. Con `wid` primero, mpv levanta la salida de vídeo sin asociarla a la ventana del escritorio: la reproducción avanza (`t-pos` sube, `vo-configured=true`) pero no se pinta nada. Comprobado por captura de píxeles con vídeo magenta sólido.
- [x] **Prueba en vivo superada**: con el motor real (`VideoWallpaperEngine` + `DesktopWallpaperWindow`) el 100 % de los píxeles de la franja del escritorio correspondieron al vídeo, con los iconos del escritorio y el taskbar por encima. La ventana hija de la capa `WorkerW` de Windows 11 se coloca correctamente detrás de los iconos.
- [x] Estructura real del escritorio documentada para esta máquina (Windows 11 25H2): `SHELLDLL_DefView` es hijo directo de `Progman` y la capa de fondo es la ventana hija `WorkerW` de `Progman` (1920×1080); no existe `WorkerW` hermano clásico.
- [x] Botón de ojo para ocultar carpetas y vídeos: estado gris, exclusión de la cuadrícula y de la cola de reproducción, persistencia en `live_wallpapers.json` y sincronización del motor cuando el vídeo en pantalla se oculta.
- [x] Pruebas de regresión: `cargo test --lib` (3 pruebas nuevas de ocultado y 1 de flujo completo del controlador, 0 fallos; los 2 fallos de `windows_com` son preexistentes por paralelismo y pasan en serie) y `bun test tests/live-wallpapers.test.ts` (7 pass, 0 fail).
- [x] Sonido del fondo con aislamiento real: la sesión de libmpv del fondo no usa modo exclusivo (`audio-exclusive=no`) y, con el sonido apagado, no abre dispositivo alguno (`ao=null`). Se verificó que no hay silenciado global en la app: el volumen del sistema solo se escribe en el endpoint por defecto (`system_volume.rs`) y la captura del relé es un loopback de la mezcla completa del endpoint (`audio_relay/capture.rs`), sin Silenciar el resto.
- [x] Controles en el menú de la bandeja del sistema (System Tray): submenú interactivo `SubmenuBuilder` ("Fondos en vivo") con Avanzar fondo (`wallpaper_next`), Retroceder fondo (`wallpaper_prev`), Pausar/Reanudar fondo (`wallpaper_pause` con cambio dinámico de etiqueta), Encender/Apagar fondo vivo (`wallpaper_toggle` con cambio dinámico de etiqueta) y Abrir galería (`wallpaper_open`). Los comandos Tauri emiten `prisma://wallpaper-state-changed` y actualizan la bandeja de inmediato con `update_wallpaper_tray_menu`.
- [x] Widget interactivo de Fondos Vivos en la pantalla de Inicio (`HomeWallpaperWidget.tsx`): selector dual de pestañas con Música si hay pista en curso, o despliegue automático del widget de fondo vivo si no hay música activa. Controles de transporte (anterior, play/pause, siguiente), conmutador de encendido/apagado, estado en vivo ("En escritorio", "En pausa", "Apagado"), nombre de vídeo y carpeta, miniatura con `VideoThumbnail` y acceso directo a la galería completa.
- [x] Píldora de estadística integrada en la fila principal de Inicio (`home-stat-row` con 4 columnas): muestra el total de vídeos configurados y redirige con un clic a Fondos Vivos.
- [x] Pruebas unitarias de bandeja y widget en `tests/live-wallpapers.test.ts` (9 pass, 0 fail).
- [ ] Prueba interactiva en vivo en Windows (foco de iconos, menú contextual, atajo Win+D Mostrar escritorio).

## Verificación en vivo del 2026-10-25 (sesión de cierre de fase 1)

- [x] **Estructura real del escritorio con el fondo activo**: recorrido recursivo de ventanas confirmado — `Progman` (visible, 1920×1080) → `WorkerW` (visible, 1920×1080) → `PrismaDesktopWallpaperHost` (visible, 1920×1080) → `mpv` (visible, 1920×1080). La capa de iconos `SHELLDLL_DefView` es **hija directa de `Progman` y hermana por encima** del `WorkerW`: el vídeo queda detrás de los iconos y del taskbar.
- [x] **Prueba de fotograma real** (sin robar el foco): captura con `PrintWindow` de la ventana `mpv` devuelve imagen real, no negro. El fotograma capturado corresponde a un vídeo MMD de la carpeta «Hatsune Miku». Colores dominantes del fotograma: blanco (255,255,255) y verde agua (132,200,186).
- [x] Reproducción en vivo con dos carpetas reales registradas (Lumi N0va: 42 vídeos; Hatsune Miku: 37 vídeos), modo aleatorio, con 3 vídeos ocultados de forma individual.
- [x] **Distribución nativa a nivel de empaquetado**: instalador reconstruido con el código vigente (`bun run build:installer`), `release/Prisma_1.2.0-setup.exe`, 161,1 MB, SHA-256 `405582653f98227f00444ca9cbcf6e1def59069b4a295ec165d9eb00a5372bbb`. El staging incluye `libmpv-2.dll`, `libunwind.dll` y `ffmpeg`: la dependencia nativa que exige el motor de fondos viaja en el instalador. `Cargo.toml` deja `default = ["mpv"]`, así que la build de release incluye la feature.
- [ ] **Pendiente**: instalación silenciosa del setup y arranque desde `%LOCALAPPDATA%\Programs\Prisma` (la app instalada ya está en la máquina, versión 1.2.0) con las tres carpetas configuradas, incluida una carpeta de imágenes.
- [ ] **Pendiente**: la prueba interactiva de Win+D y del menú contextual sobre un icono del escritorio requiere poner el escritorio en primer plano. No se automatiza el ratón sobre la sesión del usuario: la comprobación se hace con la persona delante.
- [x] **Mapa de reutilización de Aurora verificado** (no supuesto): el compositor de `dynamic-backgrounds/` es three.js puro, sin Supabase, sin React Router, sin i18n, sin `fetch` y sin texturas remotas; 15 archivos y 1.218 líneas son la unidad mínima reutilizable. `three` instalado 0.185.1 (el `package.json` de Aurora declara `^0.186.0`: lockfile desfasado). El bloqueo real es el andamiaje React, no el motor.

## Capa 1 con vídeos e imágenes (implementación del 2026-10-25)

- [x] Backend Rust: `MediaKind` (vídeo/imagen por extensión) y `MediaKindMode` (`video` por defecto / `image` / `mixed`). Extensiones de imagen: jpg, jpeg, png, webp, bmp, gif, tif, tiff, avif.
- [x] La imagen se reproduce en la misma sesión de libmpv que el vídeo (misma ventana del escritorio) y permanece `imageDurationSec` (20 s por defecto, 5..600) antes de que la cola avance. La espera vive en el motor, no en un temporizador suelto; el tiempo en pausa no cuenta.
- [x] Con un único medio en la cola nunca se avanza: el vídeo se repite en bucle y la imagen se queda fija.
- [x] Solo el vídeo tiene audio: con una imagen cargada la sesión no abre dispositivo de audio (`ao=null`) y la preferencia de sonido se recuerda para el siguiente vídeo.
- [x] Contrato JSON migrado sin romper la configuración existente: `videoCount`→`mediaCount`, `hiddenVideos`→`hiddenMedia`, `currentVideo`→`currentMedia`, `totalVideos`→`totalMedia`, `videos`→`media`. Un `live_wallpapers.json` antiguo se sigue leyendo y, al no tener `mediaKindMode`, arranca en vídeos: el comportamiento previo no cambia para nadie.
- [x] Frontend: switch de tipo arriba de la cajita de control con el mismo estilo segmentado de «Cubrir / Ajustar» (iconos `film`, `image`, `layers`), miniaturas de imagen por protocolo de assets con respaldo, textos según el tipo activo, control de duración de imagen (solo cuando hay imágenes) y sonido deshabilitado con explicación cuando no hay vídeo en juego.
- [x] Pruebas: 13 tests de Rust de wallpapers en verde (7 previos + 6 nuevos) y 13 tests de frontend en verde (`tests/live-wallpapers.test.ts`, antes 9).
- [x] **Defecto corregido**: la sesión de mpv se cerraba con `mpv_destroy` (lo que hace libmpv2 al soltar el handle), que no espera a que terminen los hilos de vídeo y audio. Al soltar el motor con reproducción viva, esos hilos seguían escribiendo en memoria liberada y el proceso terminaba con `STATUS_ACCESS_VIOLATION`. Ahora el motor cierra el core con el comando `quit` y espera al evento de apagado antes de soltar el handle (lo que hace internamente `mpv_terminate_destroy`). Verificado: la suite completa ya no revienta al cerrarse.
- [ ] **Pendiente**: los 2 tests de `infrastructure::windows_com` siguen fallando en la suite completa. Son preexistentes y ajenos a esta feature: fallan igual con `--skip wallpapers` (120 pass / 2 fail) y pasan aislados. Su propio código admite que el resultado «cambia según la carga de la máquina». No se tocan aquí.

### Validación en vivo de la capa 1 (app dev, 2026-10-25)

Configuración probada con tres carpetas reales registradas (A: Lumi N0va, 46 vídeos; B: Hatsune Miku, 42 vídeos; C: carpeta de 4 imágenes PNG de prueba) y el tipo elegido en la configuración.

- [x] **Tipo «Imágenes»**: la cola contiene solo las 4 imágenes de la carpeta C. Capturas del fondo con `PrintWindow` a T+0 s, T+12 s y T+24 s muestran, en ese orden, la imagen 1 (magenta), la 2 (azul) y la 3 (ámbar): la imagen permanece el tiempo configurado (10 s) y la cola avanza sola. El fotograma capturado es la imagen real a 1920×1080.
- [x] **Tipo «Vídeos»**: con el tipo en vídeos, la cola vuelve a componerse con los vídeos de las carpetas A y B y el fondo reproduce un vídeo real a pantalla completa (fotograma de la carpeta Lumi N0va). El modo persistido se respeta al arrancar la app.
- [x] **Capa del escritorio**: en ambos modos la jerarquía es `Progman` → `WorkerW` (visible) → `PrismaDesktopWallpaperHost` (visible, 1920×1080) → `mpv` (visible), con la capa de iconos `SHELLDLL_DefView` como hermana por encima.
- [x] **Cierre limpio**: al cerrar la app con el fondo en marcha no hay ningún evento de error en el registro de Windows (antes, soltar el motor con reproducción viva podía dejar hilos de mpv sobre memoria liberada).
- [x] **Comprobaciones interactivas** (con el permiso de Biglex, 2026-10-25):
  - **Win+D**: al traer el escritorio al frente, el fondo sigue reproduciéndose detrás de los iconos y de la barra de tareas. Captura del escritorio a pantalla completa con la imagen de prueba como fondo.
  - **Menú contextual**: el clic derecho sobre el fondo del escritorio abre el menú del shell («Ver», «Ordenar por», «Actualizar», «Terminal», «Configuración de pantalla», «Personalizar») por encima del fondo: la capa del wallpaper no bloquea la del escritorio. El menú se cierra con ESC sin dejar restos.
  - **Switch de tipo**: pulsado con UIAutomation sobre el botón «Vídeos» del grupo «Tipo de medio del fondo» de la app instalada. El efecto es real y visible: el control «Duración» desaparece (solo aplica a imágenes), el listado pasa a «Vídeos disponibles (79)» (42 de Lumi N0va + 37 de Hatsune Miku) y el fondo en pantalla cambia de la imagen de prueba a un vídeo real.
  - La app instalada se dejó limpia: con las dos carpetas reales (42 y 37 vídeos), tipo «Vídeos», y el fondo reproduciéndose.

### Distribución nativa verificada (2026-10-25)

- [x] Instalador reconstruido con el código vigente: `release/Prisma_1.2.0-setup.exe` (161,1 MB), generado a las 20:22 con la implementación de imágenes y el cierre ordenado de mpv.
- [x] Instalación silenciosa (`/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS`) con **código de salida 0** y sin privilegios de administrador (`PrivilegesRequired=lowest`).
- [x] Contenido instalado en `%LOCALAPPDATA%\Programs\Prisma`: `prisma.exe` (33,57 MB, 20:19), `libmpv-2.dll` (114,18 MB), `libunwind.dll` y la carpeta `ffmpeg`. La dependencia nativa que exige el motor de fondos viaja en el instalador.
- [x] Arranque de la app instalada por `explorer.exe`, igual que hace la entrada `[Run]` del instalador (evita el fallo `STATUS_REDIRECTION_TRUST_FAILURE`): proceso vivo con 143 MB de memoria.
- [x] Fondo de la app **instalada** verificado en vivo: la jerarquía de ventanas es la misma (`WorkerW` → `PrismaDesktopWallpaperHost` → `mpv`, con la capa de iconos por encima) y el fondo reproduce la cola de imágenes avanzando sola (azul → ámbar → lima) con la duración configurada de 15 s.
- [x] La app instalada recalculó los recuentos reales de las carpetas (42 y 37 vídeos) y persistió el formato nuevo (`mediaKindMode`, `imageDurationSec`, `hiddenMedia`, `mediaCount`).
- [x] Sin errores de aplicación en el registro de Windows durante la sesión.

## Fase 2 — pendiente

- [ ] Procedencia Aurora y unidad de reutilización documentadas; dependencias/recursos comprobados.
- [ ] Composición representativa detrás de iconos con transparencia y orden de capas correcto.
- [ ] Imagen, ambiente, escenario, escenografía, partículas y avatar opcional funcionan según el alcance adaptado.
- [ ] Pausa/visibilidad independientes; cargas tardías no reemplazan selección reciente.
- [ ] Vídeo y composición son modos excluyentes; cambio de modo libera el renderizador anterior.
- [ ] Cursor optativo sin robo de foco ni bloqueo de clics; escritorio y Explorer recuperables.
- [ ] Recursos locales funcionan desconectados; consumo medido y cierre sin fugas.

Registrar Windows, commit, pantalla/DPI, contenido y resultado. Compilar no sustituye las pruebas de escritorio real.
## Revisión técnica e inicio de fase 2 — 2026-10-25

Este bloque describe comprobaciones de esta revisión; los bloques anteriores son evidencia de sesiones previas.

- [x] `bun run build`: TypeScript y Vite correctos; motor Three.js en entrada separada y efectos con importación dinámica. Advertencias de tamaño de chunks conservadas.
- [x] `bun test tests/live-wallpapers.test.ts tests/wallpaper-compositor.test.ts`: 14 pruebas, 0 fallos (13 de la base y 1 de trazabilidad de los originales vendorizados).
- [x] `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-wallpapers.ps1`: 16 pruebas Rust, 0 fallos. Incluye validación de configuración, contrato camelCase, persistencia sin restaurar flags de ejecución y apagado al ocultar la última fuente.
- [x] Detectado `STATUS_ENTRYPOINT_NOT_FOUND` antes del harness: el ejecutable libtest sin recursos no resolvía `comctl32.dll!TaskDialogIndirect`. Causa comprobada con tabla de importaciones/GetProcAddress. Añadir el manifiesto Common Controls v6 al ejecutable generado mediante `mt.exe` permite ejecutarlo. El script aplica la corrección solo al harness; no cambia el binario instalado.
- [x] Prueba WebGL en navegador real: Prisma/Borealis animados, fotogramas idénticos con pausa, sin errores WebGL; sin escenario/ambiente deja ver el fondo de prueba magenta. Evidencia local en `temp/aurora-*-preview.png`.
- [x] Prueba nativa en instancia dev separada (WebView2): composición sobre PNG de prueba, animación, pausa estable y destrucción del webview al detener. No se infiere orden de iconos ni recuperación de Explorer a partir de una captura interna del webview.
- [x] Prueba nativa posterior con **cero carpetas y cero medios**: Holo Ciudad 3D anima sin sesión mpv, pausa estable, cambio a Borealis y cierre efectivo. `currentMedia=null`, composición apagada tras detener y página del compositor cerrada. Captura real del render en `temp/aurora-native-city.png`.
- [x] Selector superior comprobado en la app: **Vídeos / Imágenes / Fondos 3D**, sin Combinado. En Fondos 3D no se muestran carpetas de origen; escena/ambiente y transporte presentes. Captura `temp/aurora-native-scenes-ui.png`.
- [x] Perfil dev restaurado desde copia previa y procesos de prueba cerrados después de detener el fondo. La instancia instalada conserva su proceso y no se reinstala ni reemplaza.
- [ ] Prueba nativa de Explorer reiniciado, suspensión, bloqueo, oclusión y varias pantallas con la nueva superficie. La política automática aún no está implementada en el bucle de monitorización inspeccionado.
- [ ] Medición sostenida CPU/GPU/RAM y adopción de las capas independientes de partículas, audio del vídeo y parallax.

Visto bueno a la base técnica para continuar; fase 2 abierta. La prueba del protocolo usa el backend real en la instancia dev, sin simular sus comandos; la prueba de navegador sí usa un puente de configuración simulado y solo acredita renderizado web.

## Catálogo completo y capas independientes — 2026-10-26

- Build web TypeScript/Vite correcto. Advertencias de tamaño de chunks existentes.
- 14 pruebas Bun de colas y procedencia; sin fallos. Hashes y copia local de 46 archivos del motor más componente 2D.
- Prueba UI aislada con backend simulado: 46 opciones, ningún canvas por tarjeta, persistencia del último slider y de ajustes por efecto, dos sistemas de partículas, ambiente sólido con opacidad, parallax y ancho 375 sin desbordamiento. Cero errores de página.
- Instancia nativa propia con perfil `wallpaper-layers-probe`, WebView2/CDP 9334. Los 25 efectos renderizaron sin errores de página/GLSL. Ambiente sin base, partículas 2D animadas con 3D pausado, pausa estable de todas las capas y destrucción del webview al detener.
- Imagen PNG y vídeo MP4 de prueba reproducidos por mpv con compositor activo. Quitar solo la base conserva compositor; pausa/reanudación global correctas. API de cursor devuelve valores normalizados y acepta aplicar parallax a la base.
- Evidencias locales: temp/wallpaper-native-gallery.png, temp/wallpaper-native-layers.png; scripts puntuales en temp/test-wallpaper-layers-native.cjs y temp/test-wallpaper-video-native.cjs.
- Capturas internas del webview y estado nativo no prueban por sí solos la composición visual final contra iconos, clics físicos ni movimiento físico del cursor. Esas comprobaciones, recuperación de Explorer y medición sostenida siguen pendientes.
- 25 PNG de assets/wallpapers/scenes-1080 comprobados con Pillow: todos 1920 × 1080, suma 18.279.719 bytes. Vista de Holo Ciudad inspeccionada; generación del motor real, no ampliación de miniaturas.
- No se sustituyó la instalación de Prisma ni se usaron sus preferencias para las pruebas.

- Comprobación final: 20 pruebas Rust y 14 pruebas Bun correctas; build web y prueba UI repetida después de los ajustes finales, sin fallos. Instancia de prueba cerrada tras detener el fondo.

## Corrección de categorías — 2026-10-26

Prueba del componente LiveWallpapersView completo en Edge con backend simulado: siete pestañas superiores; galerías exclusivas Ambiente 8, Dinámicos 5, Escenarios 4 y Partículas 16/13 según selector interno. Vídeos e Imágenes no contienen galerías de efectos, Parallax solo ofrece sus ajustes. No hay filtro Todos. Navegar entre categorías conserva configuración, controles por efecto y ambos sistemas de partículas. Teclado izquierda/derecha y ancho 375 sin desbordamiento comprobados; cero errores de página. Captura inspeccionada: temp/wallpaper-dynamic-category.png.

TypeScript y build web correctos. Este ajuste es de interfaz; no cambia el motor nativo. No se afirma nueva prueba del escritorio instalado.

## Catálogo canónico de Aurora — 2026-10-26

La clasificación anterior dynamic/3d/particles se derivaba de supportsBackgroundCamera y PARTICLE_BACKGROUNDS; no correspondía a la agrupación de la interfaz Aurora. Se verificaron directamente catalog.ts (DYNAMIC_BACKGROUND_GROUPS) y ui/tabs/Fondos/Dinamicos.tsx del repositorio vecino.
El sincronizador ahora copia uiGroup desde esa fuente. Se mantienen los campos internos que encaminan el renderizado, sin exponerlos como categorías de interfaz.

Prueba Edge de LiveWallpapersView completo con backend simulado: seis pestañas, 25 entradas en Escenarios 3D, secciones de 17/8 con orden idéntico al catálogo; Partículas muestra las 13 formas superpuestas. Selección de ciudad → Borealis → nebulosa → Borealis sustituye el escenario previo y utiliza los controles correspondientes; conserva velocidad por efecto, ambiente sólido/opacidad y partículas superpuestas activas. Búsqueda, teclado y ancho 375 correctos, sin errores de página. Captura inspeccionada: temp/wallpaper-aurora-groups.png.
Prueba de contrato añadida contra DYNAMIC_BACKGROUND_GROUPS vendorizado, cuyo original se comprueba por SHA-256. Esta validación es de frontend; no implica una nueva prueba del escritorio instalado.

Resultado final: build TypeScript/Vite correcto; 15 pruebas Bun y prueba UI completa correctas, sin fallos. Advertencia habitual de tamaño de chunks conservada.

## Pulido de aplicación, GIF y nitidez — 2026-10-26

Causa de flujo confirmada: seleccionar una tarjeta solo guardaba configuración; notify_wallpaper_change montaba capas únicamente si is_active ya era true. Vídeo sí activaba el fondo al hacer clic. Ahora la selección persiste y espera el guardado serializado antes de activar el compositor si estaba apagado. Elegir Sin ambiente/Sin escenario no activa una superficie vacía.
La creación también sincroniza visibilidad de la ventana Tauri y del Webview, además del HWND. No se atribuye el fallo anterior exclusivamente a la visibilidad sin una comparación física antes/después.

El perfil dev leído contenía Gargantúa y Borealis simultáneos (modelo anterior). migrate_layers conserva la selección visible única y sus controles; prueba de regresión añadida. WebGL limita sus fotogramas a 30 fps; no cambia el reloj de mpv ni inventa un nivel de audio.

- 22 pruebas Rust correctas, incluida animación GIF después del primer ciclo comparando píxeles decodificados distintos y comprobación de imagen 3840×2160 recibida por mpv sin reducción previa. GIF sigue en Imágenes, loop-file=inf; imagen estática vuelve a loop-file=no. Fixture GIF propia en tests/fixtures/wallpaper-animation.gif.
- Prueba Edge con backend simulado partiendo de fondo apagado: tarjeta guarda Holo Ciudad antes de activar; conserva controles por efecto, catálogos, ambiente y partículas; ancho 375 y cero errores. Captura de Parallax inspeccionada: temp/wallpaper-parallax-toggle.png.
- Binario de prueba separado con cargo rustc --bin prisma -- -o temp/prisma-wallpaper-probe.exe; perfil wallpaper-polish-probe y CDP 9334. No sustituye el binario que usa la sesión del usuario.
- Prueba nativa temp/test-wallpaper-polish-native.cjs: clic real de tarjeta Ambiente monta sin medio, isVisible=true y controlador WebView2 IsVisible=true registrado; cambia a Holo Ciudad y luego Borealis; conserva ambiente y sustituye escenario previo. Vídeo MP4 propio reproduce junto a las capas. 36 limpiezas de fotograma WebGL en 1.200 ms, coherentes con 30 fps. Fondo detenido al acabar.
- Prueba nativa anterior recorrió los 25 efectos sin errores del motor; su aserción final de galería estaba desactualizada (46 opciones) y falló. Se usa la prueba actual de categorías/activación para la validación final, sin atribuir éxito a esa aserción antigua.
- FFprobe del original observado Kanojo Okarimashu - 14.jpg: 1280×720. El GIF original tiene 1560×898 y 18 frames. La lectura original y las pruebas de decodificación no equivalen a una aceptación visual de nitidez ni de fluidez de los archivos del usuario en su escritorio.
- Filtros de escalado spline36/mitchell configurados y aceptados por libmpv; sin pasos IA ni interpolación temporal. No se promete recuperar detalle ausente de una fuente 720p.

## Composición invisible: ventana layered sin alfa inicializada — 2026-10-26

Biglex confirma que la incidencia seguía abierta. Las pruebas anteriores de captura interna e isVisible no demostraron la aparición sobre la imagen del escritorio.

Causa nativa identificada en Tao 0.35.3: set_ignore_cursor_events activa WS_EX_TRANSPARENT | WS_EX_LAYERED (window_state.rs). No se inicializaban los atributos de la ventana layered. La documentación Win32 requiere SetLayeredWindowAttributes/UpdateLayeredWindow para hacer visible esa superficie; IsWindowVisible o el estado de WebView2 no lo sustituyen.

Se añade SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA), seguido de lectura obligatoria de alfa y flags. Los métodos de mostrar Tauri/WebView se ejecutan antes de aplicar WS_CHILD/SetParent; finaliza con SWP_FRAMECHANGED. El alfa global 255 conserva el alfa por píxel producido por WebView2; no se usa una clave de color.

Prueba nativa aislada (perfil wallpaper-alpha-probe): el log antes de inicializar devuelve atributos de capa no disponibles y alpha=0; después devuelve alpha=255. WebView2 IsVisible=true. temp/test-wallpaper-alpha-native.cjs aplica imagen PNG con partículas de corazones, después escenario Holo Ciudad, conservando mpv y compositor activos; 36 fotogramas en 1.200 ms y sin errores. Evidencias internas: temp/wallpaper-alpha-particles.png y temp/wallpaper-alpha-scene.png; no se presentan como captura del escritorio físico.

Se solicitó confirmación visual a Biglex en la instancia de desarrollo recompilada. Pendiente de respuesta; no atribuir aceptación ni cierre físico a las comprobaciones de atributos nativos. La prueba antigua de creación directa de una ventana hija layered falló en el harness; la regresión se ajusta al flujo real de Tauri (creación superior, conversión a hija y SetParent).

Resultado final automatizado de esta corrección: 23 pruebas Rust correctas. La regresión crea la ventana superior layered, la convierte en hija y verifica atributos ausentes antes de inicializar y alfa 255 después, replicando el flujo Tauri. Confirmación visual del usuario todavía pendiente.

## Confirmación visual del usuario — 2026-10-26

Biglex responde «Sí, ahora aparece» a la prueba de partícula o escenario sobre imagen en Prisma Dev. Se confirma la aparición visible en el escritorio tras inicializar la opacidad nativa. Esta confirmación cierra la incidencia de capas invisibles; no se extiende a recuperación de Explorer, rendimiento sostenido ni las demás funciones pendientes.

## Zoom de fondos planos — 2026-10-26

Reproducción anterior con motor Three.js congelado: Prisma y Lente Gravitacional producían imágenes idénticas a zoom 0,5, 1 y 2. El adaptador imponía Math.max(zoom,minScale*margin) a geometrías cuyo mínimo de cobertura superaba el rango visible del control.

La fuente BackgroundProjection.ts en Aurora separa ahora cobertura geométrica de zoom del muestreo UV. Se sincroniza Prisma y se actualiza hash de procedencia. No se altera BackgroundCamera ni ningún archivo de Gargantúa. Se conserva encuadre a zoom 1 y desplazamientos existentes.

scripts/test-wallpaper-zoom.cjs usa el renderizador real y shaders originales, con tiempo pausado: compara los cinco fondos planos (Prisma, Borealis, Lente Gravitacional, Matrix y Flujo Líquido), verifica cambios al alejar/acercar y recuperación exacta al volver a 1. Baseline anterior guardado en temp/wallpaper-zoom-baseline.json: hashes de zoom 1 idénticos tras la corrección. Incluye extremos 0,1 y 2,5. Capturas inspeccionadas de Lente Gravitacional: temp/zoom-blackhole-normal.png y temp/zoom-blackhole-far.png. La prueba de galería verifica también persistencia del slider Zoom en el efecto seleccionado.

La fuente Aurora modificada se prueba mediante su copia sincronizada en Prisma; no se afirma un build completo de la aplicación Aurora ni despliegue remoto. Activadores y semántica de ambiente permanecen diferidos a petición de Biglex; el rendimiento de Gargantúa no se modifica.

## Lente Gravitacional: antiguo 0,5 como nuevo 1

Biglex aclara que 0,5 describe el encuadre deseado, no el valor que debe mostrar el control. Se conserva DEFAULT_BACKGROUND_CONTROLS.zoom=1 y DEFAULT_LAYER_CONTROLS.zoom=1, también al restablecer. El shader BlackHoleBackground transforma las coordenadas base alrededor del centro al doble de amplitud; el zoom del adaptador sigue siendo relativo.

Comparación de render congelado a 640×360: nuevo zoom 1 frente a captura anterior a zoom 0,5 difiere únicamente en 3 píxeles, máximo 1 nivel de 255, por redondeo de rasterización. El resto del encuadre es igual. La prueba de zoom verifica alejar/acercar y restablecer sobre este nuevo encuadre. Cambio de fuente compartida en Aurora y copia sincronizada con hash actualizado; no modifica Gargantúa ni otras escenas.
