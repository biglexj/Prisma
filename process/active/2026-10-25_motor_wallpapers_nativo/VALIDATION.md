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

## Fase 2 — pendiente

- [ ] Procedencia Aurora y unidad de reutilización documentadas; dependencias/recursos comprobados.
- [ ] Composición representativa detrás de iconos con transparencia y orden de capas correcto.
- [ ] Imagen, ambiente, escenario, escenografía, partículas y avatar opcional funcionan según el alcance adaptado.
- [ ] Pausa/visibilidad independientes; cargas tardías no reemplazan selección reciente.
- [ ] Vídeo y composición son modos excluyentes; cambio de modo libera el renderizador anterior.
- [ ] Cursor optativo sin robo de foco ni bloqueo de clics; escritorio y Explorer recuperables.
- [ ] Recursos locales funcionan desconectados; consumo medido y cierre sin fugas.

Registrar Windows, commit, pantalla/DPI, contenido y resultado. Compilar no sustituye las pruebas de escritorio real.
