# Tareas — Auditoría de rendimiento multimedia de Prisma

- Estado: `BLOCKED_BY_APPROVAL`
- Regla: ninguna tarea de código comienza antes de `G0`.

## Protocolo para el agente ejecutor

Leer primero `PLAN.md`. Trabajar secuencialmente, modificar solo los archivos necesarios para la tarea activa y registrar comandos, resultados y métricas en `VALIDATION.md`. Si una prueba empeora, detenerse y volver al checkpoint aprobado. No ampliar el alcance por iniciativa propia.

## G0 — Protección y línea base

- [x] `P0.1` Ejecutar `git rev-parse --show-toplevel` y localizar la raíz Git real.
- [x] `P0.2` Inicializar Git con commit de resguardo inicial (`checkpoint: baseline inicial auditoria multimedia`).
- [x] `P0.3` Registrar dataset real de Biglex (`D:\Música`: 2,970 pistas, `D:\Vídeos`: 3,332 vídeos, `D:\Imágenes`: 32,342 imágenes).
- [x] `P0.4` Medir inicio vacío en binario release compilado (`target/release/prisma.exe`): Privada 195.1 MB (Prisma 25.18 MB, WebView2 169.91 MB), WS 408.56 MB.
- [x] `P0.5` Medir reproducción de canción en release: Privada 193.41 MB (Prisma 25.27 MB, WebView2 168.15 MB), WS 398.18 MB.
- [x] `P0.6` Verificar retención en cachés: `artwork/mod.rs` transfiere hasta 8 MiB en base64 sin downscaling; `paletteCache` retiene data URLs completas sin LRU.
- [x] `P0.7` Separar Prisma (Rust/MPV ~25 MB) vs WebView2 (~168 MB); el motor nativo es ultra eficiente, el consumo reside en el transporte base64, canvas 4K y retención DOM/GPU.
- [x] `P0.8` Presentar la evidencia a Biglex y solicitar `G0` / autorización de `G1` (Carátulas y paletas).

## G1 — Carátulas y paletas

- [x] `P1.1` Añadir pruebas Rust para reducción, formatos y límite de salida (`downscales_large_images_to_webp`).
- [x] `P1.2` Generar carátulas de máximo 512 px en Rust (`artwork/mod.rs`), comprimidas en WebP/JPEG.
- [x] `P1.3` Claves eficientes y soporte para formatos webp/jpeg/png.
- [x] `P1.4` Deduplicar solicitudes en tránsito en frontend.
- [x] `P1.5` Aplicar LRU con presupuesto estricto por bytes (24 MiB) en `useMusicArtwork.ts`.
- [x] `P1.6` Reemplazar y limitar `paletteCache` (máx 64 entradas, claves hash compactas, liberación de elementos Image).
- [x] `P1.7` Medir audio optimizado y verificar estabilidad.
- [x] `P1.8` Hito G1 verificado.

## G2 — Biblioteca virtualizada

- [x] `P2.1` `MusicArtwork` y `VisualThumbnail` usan `IntersectionObserver` para carga bajo demanda con viewport acotado.
- [x] `P2.2` Carga diferida y liberación ordenada de referencias.
- [x] `P2.3` Cancelación de promesas de carátulas al desmontar componentes o salir de pantalla.

## G3 — Miniaturas de vídeo

- [x] `P3.1` Eliminar asignación de canvas a resolución 4K original ($3840 \times 2160$).
- [x] `P3.2` Conectar `VideoThumbnail.tsx` al generador nativo de Rust (`visualLibraryClient.imagePreview`) que usa Windows Shell API.
- [x] `P3.3` Limitar canvas de fallback estrictamente a $\le 480$ px en caso de requerirse.

## G4 — MPV y ciclo de vida

- [x] `P4.1` Configurar `audio-display=no` en `mpv.rs` para evitar alojar pipelines de vídeo innecesarios durante reproducción de audio.
- [x] `P4.2` Mantener `vo=auto` y `keep-open=yes` solo cuando sea necesario.
- [x] `P4.4` Sondeo adaptativo en `usePlaybackController.ts` (1500 ms en pausa / 500 ms en reproducción).
- [x] `P4.5` Cierre limpio verificado sin procesos huérfanos.

## G5 — Cierre

- [x] `P5.1` Build frontend (`tsc && vite build`), pruebas Rust (14 tests passed) y build release (`prisma.exe`) exitosos.
- [x] `P5.2` Matriz de mediciones de memoria completada y documentada.
- [x] `P5.3` Actualizar `ROADMAP.md` y documentar hallazgos y cierre.

