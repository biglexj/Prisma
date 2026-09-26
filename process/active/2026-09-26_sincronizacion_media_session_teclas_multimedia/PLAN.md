# Plan — Sincronización de MediaSession y Teclas Multimedia Hardware (SMTC)

## Diagnóstico y Causa Raíz
1. **Desmontaje incompleto de VideoPlayer sin PiP**:
   - En `App.tsx`, `<VideoPlayer>` se renderizaba si `activeVideoPath` existía (`{activeVideoPath ? ...}`).
   - Al navegar a otra sección mediante la barra lateral (`Escuchar`, `Música`, `Inicio`) sin PiP, `activeVideoPath` no se limpiaba y `<VideoPlayer>` quedaba montado fuera de pantalla (`top: -9999px`).
   - El elemento `<video>` permanecía en el compositor de Chromium, reteniendo el foco de MediaSession para el último vídeo reproducido (`LiSA 『crossing field』`).
2. **Ausencia de sincronización MediaSession en el reproductor de música**:
   - La música se reproduce nativamente mediante libmpv (Rust/WASAPI).
   - Chromium desconocía la reproducción musical activa, por lo que las teclas multimedia del sistema (F6, F7, F8) se enviaban al único elemento multimedia conocido por WebView2: el vídeo oculto en segundo plano.
3. **Manejo asimétrico de eventos de teclas multimedia**:
   - Faltaba soporte explícito en `handleGlobalKeyDown` para teclas `F6`, `F7`, `F8` y eventos `MediaPlayPause`, `MediaTrackNext`, `MediaTrackPrevious`.

## Objetivos
1. **Control de Ciclo de Vida de VideoPlayer**:
   - Condicionar el renderizado de `<VideoPlayer>` a `activeVideoPath && (activeView === "video_player" || isPip)`.
   - Limpiar `activeVideoPath`, pausar vídeo y desmontar el reproductor al navegar fuera de `video_player` si no está en PiP.
2. **Hook de Sincronización MediaSession para Música (`useMediaSessionSync`)**:
   - Sincronizar metadatos (`title`, `artist`, `album`, `artwork`) con `navigator.mediaSession`.
   - Gestionar un canal de audio silencioso ultraligero que mantenga viva la sesión SMTC de Windows en WebView2 durante la reproducción con libmpv.
   - Registrar `actionHandlers` para `play`, `pause`, `stop`, `previoustrack`, `nexttrack`, `seekto`.
   - Actualizar `playbackState` y `setPositionState`.
3. **Sincronización Bidireccional en VideoPlayer**:
   - Registrar y desregistrar metadatos y `actionHandlers` de MediaSession durante la reproducción de vídeo.
   - Soportar teclas `F6`, `F7`, `F8` directamente en el reproductor de vídeo.
4. **Soporte de Teclas F6/F7/F8 en `handleGlobalKeyDown`**:
   - Permitir control inmediato dentro de Prisma tanto por teclas de función directas como por eventos multimedia de teclado.
