# Tareas: Autoplay y Sistema de Colas Super Gallery

- [x] **1. Backend Rust (libmpv & Model)**
  - [x] 1.1 Modificar `MpvBackend::load` en `src-tauri/src/infrastructure/media/mpv.rs` para despausar explícitamente (`pause = false`) al cargar una pista.
  - [x] 1.2 Agregar propiedad `eof_reached` en `PlaybackSnapshot` y leerla en `MpvBackend::read_snapshot`.
  - [x] 1.3 Validar `cargo check` y pruebas de compilación en Rust.

- [x] **2. Dominio y Operaciones de Colas (TypeScript)**
  - [x] 2.1 Actualizar `src/features/playback/model/queue.ts` con soporte multi-cola (`queues`, `activeQueueId`, `jumpToNextQueue`, `loopQueues`, `stableMediaId`).
  - [x] 2.2 Ampliar `src/features/playback/model/queueOperations.ts` con funciones extraídas de Super Gallery (`rewindQueue`, `shuffleQueueKeepingCurrentFirst`, `moveItemKeepingCurrent`, `removeItemFromQueue`, `moveQueueInList`, `resolveRestoredItemIndex`).
  - [x] 2.3 Refactorizar `src/features/playback/usePlaybackQueue.ts` para gestionar la colección de colas (`queues`), la cola activa (`activeQueue`), persistencia completa en localStorage y métodos de cola (`playFolder`, `switchQueue`, `shuffleActiveQueue`, `rewindActiveQueue`, etc.).

- [x] **3. Controlador de Reproducción (usePlaybackController)**
  - [x] 3.1 Adaptar `src/features/playback/usePlaybackController.ts` para usar la cola activa, garantizar arranque automático y avanzar con soporte de `eofReached`, `jumpToNextQueue` y `loopQueues`.
  - [x] 3.2 Corregir importación de `formatSession` en `src/features/playback/ui/components/PlaybackPreview.tsx`.

- [x] **4. Interfaz de Usuario y Biblioteca de Música**
  - [x] 4.1 Actualizar `src/features/music_library/ui/MusicLibrary.tsx` para reproducir carpetas/álbumes como colas nombradas e indicar visualmente la pista que se está reproduciendo actualmente.
  - [x] 4.2 Actualizar `src/features/playback/ui/components/PlaybackQueuePanel.tsx` con selector de colas, controles de aleatorio/repetición/rebobinado/salto y lista con miniaturas y estado activo.
  - [x] 4.3 Igualar dimensiones de `PlaybackQueuePanel`, `LyricsPreview` y `preview-artwork` para que compartan el mismo tamaño y no salten al alternar pestañas.
  - [x] 4.4 Ajustar `src/app/App.tsx` para sincronizar navegación y reproducción transparente.

- [x] **5. Validación y Cierre**
  - [x] 5.1 Ejecutar `npm run build` y `cargo check` sin errores ni advertencias.
  - [x] 5.2 Comprobar reproducción automática al hacer clic en tarjetas de canciones y botones de reproducción de álbumes.
  - [x] 5.3 Registrar evidencia en `VALIDATION.md` y decisión en `APPROVAL.md`.
