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
- [x] **Fase 4: Verificación y Validación**
  - [x] Comprobar compilación TypeScript (`bun run build` exitoso en 2.85s).
  - [x] Validar ausencia de errores de tipos o linting.
  - [x] Registrar pruebas en `VALIDATION.md` y formalizar en `APPROVAL.md`.
