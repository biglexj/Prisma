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
- [x] Corregida la selección directa de vídeo al hacer clic en tarjeta: implementación de `play_with_prefetch(&clean, peek.as_deref(), single, fit_str)` en `VideoWallpaperEngine`, erradicando el comando inexistente en mpv `playlist-play-index` y sincronizando el monitor loop mediante desacoplamiento limpio de préstamos mutables en Rust.
- [x] Resuelto fallo de miniaturas en archivos `.mkv` y títulos con caracteres especiales Unicode: corrección de `load_video_thumbnail_data_url` en `media_preview/mod.rs` para que el error de Windows Shell delegue inmediatamente en `load_video_thumbnail_ffmpeg`. Verificado con éxito mediante test unitario nativo `test_load_lumi_video_thumbnails` sobre `03. Who’s up for a Snowball Fight With Lumi.mkv` y `05. Nothin Sa s S rin Like Bubbles and Blossoms.mp4`.
- [x] Compilación Rust verificada: `cargo check` finalizado con 0 errores y 0 advertencias.
- [x] Compilación frontend verificada: `bun run build` finalizado con 0 errores.
- [x] Pruebas unitarias de ordenación natural y gestión de colas verificadas: `bun test tests/live-wallpapers.test.ts` (4 pass, 0 fail).
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
