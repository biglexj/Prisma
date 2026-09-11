# QuickLook: Corrección de Dimensiones, Caché y Reproducción de Vídeo Sobrescrito — Plan

- Estado: `IN_PROGRESS`
- Fecha: `2026-09-11`
- Proyecto: `Prisma`

## Objetivo

Resolver el fallo de detección de dimensiones y reproducción en Quick Look cuando un vídeo se reemplaza o sobrescribe (ej. DaVinci Resolve), eliminar el parpadeo negro inicial con apertura proporcionada instantánea y poster nativo, y proporcionar manejo de errores elegante con fallback de tamaño discreto.

## Alcance

- Incluye:
  - Corrección de GUID de `PKEY_VIDEO_FRAME_WIDTH` y `PKEY_VIDEO_FRAME_HEIGHT` en Windows Shell (`0x64440491` en vez de `0x64440490`).
  - Validación de rango de dimensiones (`width <= 8192 && height <= 8192`) y fallback a `ffprobe`.
  - Tamaño de ventana inicial discreto y compacto (`560x360` en vez de `850x520`) cuando las dimensiones no se conocen de antemano.
  - Generación instantánea de poster/miniatura nativa para vídeos en el payload para erradicar el parpadeo negro de carga.
  - Busto de caché (`cache-busting query param`) en la URL de carga de `<video>` y clave React basada en ruta + tamaño + fecha de modificación para evitar fallos de Range requests en WebView2 tras sobrescritura.
  - Limpieza rigurosa de stream en `QuickLookVideo` (`removeAttribute('src')` y `video.load()`) para liberar bloqueos de archivo.
  - Manejo de errores visual en UI con botón de reintento y acceso al reproductor principal (libmpv).
- No incluye:
  - Modificación del motor MPV de la ventana principal.

## Enfoque

1. Backend Rust: Corregir el GUID en `model.rs`, añadir validación de límites, fallback de ffprobe y poster nativo en el payload.
2. Backend Rust: Ajustar tamaño fallback en `resolve_media_size` en `service.rs`.
3. Frontend: Actualizar `QuickLookPayload` type con `videoPosterUrl`.
4. Frontend: Actualizar `QuickLookVideo.tsx` con cache buster, poster nativo, ciclo de vida robusto y UI de error/reintento.
5. Frontend: Actualizar `QuickLookWindow.tsx` para remonte reactivo ante cambios de tamaño/fecha del archivo y `QuickLookHeader.tsx` para filtro de dimensiones anómalas.
6. Validación exhaustiva: pruebas unitarias de dimensiones y build del frontend y backend.

## Criterios de finalización

- [ ] `get_video_dimensions` resuelve exactamente las dimensiones de vídeos reales (ej. 1080x1920 en `Triunfo.mp4`).
- [ ] No aparecen resoluciones anómalas (`650316333 x 320272 px`).
- [ ] La ventana abre directamente con la relación de aspecto correcta o tamaño discreto.
- [ ] Los vídeos reemplazados en disco se recargan y reproducen sin quedarse en negro.
- [ ] Pruebas unitarias y compilación de Rust y Vite exitosas.

## Autorización

- [x] Plan aprobado para ejecución.
