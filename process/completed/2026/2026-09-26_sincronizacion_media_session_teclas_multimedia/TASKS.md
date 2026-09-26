# Tareas — Sincronización de MediaSession y Teclas Multimedia Hardware (SMTC)

- [x] **Fase 1: Hook `useMediaSessionSync` para Música**
  - [x] Implementar `src/features/playback/services/useMediaSessionSync.ts` con manejo de audio silencioso, metadatos, estado de reproducción y handlers SMTC (`play`, `pause`, `stop`, `previoustrack`, `nexttrack`, `seekto`).
  - [x] Integrar resolución de metadatos de pista activa y carátula con `useMusicArtwork`.
- [x] **Fase 2: Gestión de Ciclo de Vida y Limpieza en `App.tsx`**
  - [x] Crear función `navigateToView` para limpiar sesión de vídeo si no está en modo PiP al cambiar de vista.
  - [x] Ajustar condición de montaje de `<VideoPlayer>` a `activeVideoPath && (activeView === "video_player" || isPip)`.
  - [x] Añadir elemento `<audio>` silencioso controlado por `useMediaSessionSync`.
  - [x] Añadir teclas `F6`, `F7`, `F8`, `MediaPlayPause`, `MediaTrackNext`, `MediaTrackPrevious`, `MediaStop` a `handleGlobalKeyDown`.
- [x] **Fase 3: MediaSession en `VideoPlayer.tsx`**
  - [x] Registrar metadatos y handlers en `navigator.mediaSession` durante reproducción activa de vídeo.
  - [x] Limpiar handlers y metadatos de MediaSession al pausar o desmontar `<VideoPlayer>`.
  - [x] Añadir atajos `F6`, `F7`, `F8` al listener de teclado interno de `VideoPlayer`.
- [x] **Fase 5: Desacople de Volumen, Redondeo de Colas, Intercambio de Botones e Inmunidad a Parpadeos**
  - [x] Desacoplar teclas de hardware de volumen del sistema (`AudioVolumeUp`, `AudioVolumeDown`, `AudioVolumeMute`) en `App.tsx` y `VideoPlayer.tsx` para que no afecten el volumen interno de Prisma y solo regulen Windows (elimina doble atenuación).
  - [x] Conservar flechas Arriba/Abajo y teclas +/- para el volumen interno de Prisma.
  - [x] Eliminar corte rectangular en hover/focus en items de la cola de música (`playback-queue.css`) y playlist de vídeo (`video-player.css`).
  - [x] Intercambiar botón de Captura de fotograma (cámara) a controles izquierdos y Cola de reproducción a controles derechos en `VideoPlayer.tsx`.
  - [x] Eliminar parpadeo (flicker de opacidad 0.35) en los 3 botones de transporte (`<`, `Pausar`, `>`) al cambiar volumen o pulsar play/pause desacoplando `busy` en `usePlaybackController.ts` y `PlaybackPreview.tsx`.

