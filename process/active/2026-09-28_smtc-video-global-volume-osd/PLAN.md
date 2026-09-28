# Sincronización SMTC Nativa de Vídeo y OSD de Volumen Global en Prisma — Plan

- Estado: `COMPLETED`
- Fecha: `2026-09-28`
- Proyecto: `Prisma`

## Objetivo

Unificar la identidad multimedia del sistema (SMTC) bajo el proceso nativo de Prisma tanto para música como para vídeo (eliminando `Microsoft Edge WebView2`, iconos genéricos y parpadeos en el flyout de Windows), e integrar el OSD de volumen visual global en toda la aplicación para atajos de teclado y reproducción de audio.

## Alcance

- Incluye:
  - Extensión de `NativeSmtcManager` en Rust (`smtc.rs`) para dar soporte nativo a `MediaPlaybackType::Video`, títulos, subtítulos de vídeo y extracción de miniaturas de vídeo en tiempo real vía Shell/FFmpeg (con fallback instantáneo al icono oficial de Prisma en PNG).
  - Configuración de flags de Chromium WebView2 (`--disable-features=HardwareMediaKeyHandling`) en `main.rs` para erradicar sesiones SMTC huérfanas de WebView2 con el nombre `Microsoft Edge WebView2`.
  - Reemplazo en `VideoPlayer.tsx` de `navigator.mediaSession` por comandos directos a `NativeSmtcManager` (`smtc_update_metadata`, `smtc_update_playback`, `smtc_update_timeline`) y recepción de acciones de hardware (`prisma://smtc-action`).
  - Limpieza y sincronización armónica entre sesiones de audio y vídeo para evitar solapamientos o parpadeos entre la música y el reproductor de vídeo.
  - Integración del OSD de volumen flotante (`VolumeOsd`) a nivel global en `App.tsx`, visible en cualquier vista de la aplicación al usar atajos de teclado (`ArrowUp`, `ArrowDown`, `+`, `-`, `M`), deslizadores de volumen o mandos LAN (Synapse).
  - Actualización de `ROADMAP.md` marcando el pendiente resuelto con precisión.
- No incluye:
  - Cambios en el motor de renderizado de vídeo HTML5/Canvas.
  - Modificaciones en persistencia de biblioteca ni base de datos.

## Enfoque

1. **Rust / Backend Nativo**:
   - Ampliar `smtc.rs` y el comando `smtc_update_metadata` para admitir `media_type: Option<&str>` (`"music"` o `"video"`).
   - Agregar `load_video_thumbnail_raw_bytes` en `infrastructure::media_preview` para extraer bytes JPEG reales de la miniatura de vídeo y servirlos al thumbnail WinRT de SMTC.
   - En `main.rs`, inyectar `--disable-features=HardwareMediaKeyHandling` en `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`.
2. **Frontend / Reproductor de Vídeo (`VideoPlayer.tsx`)**:
   - Desactivar `navigator.mediaSession` en WebView2.
   - Conectar el ciclo de vida del vídeo a `smtc_update_metadata` (tipo `"video"`), `smtc_update_playback` y `smtc_update_timeline`.
   - Escuchar `"prisma://smtc-action"` para responder a los controles de hardware / flyout del sistema.
3. **Frontend / OSD de Volumen Global (`App.tsx`, `VolumeOsd.tsx`, `PlaybackPreview.tsx`)**:
   - Montar `VolumeOsd` a nivel de `App.tsx` con clase global `.is-global` fija y z-index prioritario.
   - Conectar atajos de teclado (`ArrowUp`, `ArrowDown`, `+`, `-`, `M`) y el evento `prisma-global-volume-osd` al disparador reactivo del OSD.
   - Despachar el evento desde `PlaybackPreview.tsx` y controles de volumen de música.
4. **Validación y Pruebas**:
   - Compilación completa de TypeScript (`bun run build` o `tsc`).
   - Verificación de compilación de Rust (`cargo check`).
   - Prueba manual y verificación visual.

## Criterios de finalización

- [x] El flyout de volumen de Windows 10/11 muestra siempre "Prisma" y el icono oficial de Prisma tanto en música como en vídeo (nunca `Microsoft Edge WebView2`).
- [x] Las miniaturas de vídeo se muestran nítidas en el overlay SMTC de Windows sin parpadear con iconos de notas musicales genéricas.
- [x] Al cambiar de vídeo a música (o viceversa), no quedan sesiones SMTC huérfanas ni parpadeos entre ambas.
- [x] Al subir, bajar o silenciar el volumen dentro de Prisma (flechas, +/-, M), el OSD de volumen aparece fluidamente con estilo Material 3 Expressive.

## Autorización

- [x] Plan aprobado para ejecución técnica.
