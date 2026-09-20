# Tareas: Perfeccionamiento de Picture-in-Picture (PiP)

- [x] **1. VideoPlayer.tsx - Cálculo de Dimensiones Acotadas de PiP**:
  - [x] Implementar función auxiliar `requestPiPWithBoundedDimensions` para vídeos horizontales (16:9), verticales (9:16) y cuadrados (1:1) con base acotada (~440px máx).
  - [x] Limpiar los estilos temporales inmediatamente en el bloque `finally` para no alterar el tamaño del reproductor principal.
  - [x] Soportar auto-solicitud de PiP al cambiar de vídeo si PiP ya estaba activo.
- [x] **2. VideoPlayer.tsx - Diferenciación entre "Volver a la pestaña" y "✕"**:
  - [x] Rastrear `explicitAppToggleRef` para toggles directos desde la aplicación.
  - [x] Detectar la pausa automática que aplica Chromium al presionar la `✕` para emitir `onPipChange(false, "close")`.
  - [x] Detectar que el vídeo continúa reproduciéndose al presionar "Volver a la pestaña" para emitir `onPipChange(false, "restore")`.
- [x] **3. App.tsx - Sincronización de Sesión y Navegación en PiP**:
  - [x] En `handlePipChange(active, reason)`:
    - Si `reason === "restore"`: restaurar `setActiveView("video_player")` de inmediato conservando la reproducción.
    - Si `reason === "close"`: limpiar la sesión activa (`activeVideoPath = null`) y permanecer en la galería ("morir ahí").
  - [x] En `playVideoItem(path, sessionItems)`: si `isPip` está activo, mantener al usuario en su vista actual (galería) y reemplazar el vídeo en la ventana flotante.
  - [x] Evitar `display: "none"` en el contenedor de `VideoPlayer` mientras está en PiP.
- [x] **4. Verificación**: Validar con `bun run build` (0 errores).
