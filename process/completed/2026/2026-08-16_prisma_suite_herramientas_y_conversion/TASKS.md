# 📝 Tareas — Suite de Herramientas Prisma (Prisma Tools & Convert)

- [x] **Fase 1: Backend Rust — Infraestructura y Comandos**
  - [x] Módulo `infrastructure/converter/mod.rs` (Detección de FFmpeg/FFprobe, presets y transcodificación de imágenes, audio y vídeo).
  - [x] Módulo `infrastructure/tags/mod.rs` (Lectura y escritura de tags ID3/Vorbis/MP4/FLAC con `lofty`, soporte de carátula embebida).
  - [x] Módulo `infrastructure/exif/mod.rs` (Extracción de metadatos EXIF fotográficos).
  - [x] Comandos Tauri en `app/commands/converter.rs` y `app/commands/tags.rs`.
  - [x] Registro de módulos y comandos en `lib.rs` e `infrastructure/mod.rs`.
  - [x] Resiliencia de sesión de carpeta en `builder.rs` y `state/mod.rs` para prevenir fallos en rutas con mayúsculas/minúsculas o pistas de listas de reproducción.
  - [x] Extracción de metadatos de listas de reproducción para Quick Look en `quick_look/model.rs`.

- [x] **Fase 2: Editor de Tags de Música (Prisma Tag Editor)**
  - [x] Modelo TypeScript y cliente Tauri para tags (`tags/model/types.ts`, `tags/tauri/client.ts`).
  - [x] Componente `TagEditorModal.tsx` con pestañas: General, Detalles, Carátula con selector y Letras.
  - [x] Integración en el menú contextual de canciones en `MusicLibrary.tsx`.

- [x] **Fase 3: Letras Sincronizadas — LRCLIB, Editor y Resaltado**
  - [x] Servicio de búsqueda automática en LRCLIB API (`lrclibClient.ts`).
  - [x] Modal de edición y desfase temporal (+/-0.5s, +/-1s) en `LyricsEditorModal.tsx`.
  - [x] Guardado directo a archivo compañero `.lrc` o incrustado en tags.
  - [x] Botón "Editar letras" en cabecera de `LyricsPreview.tsx`.

- [x] **Fase 4: Visor de Metadatos EXIF**
  - [x] Componente `ExifDetailsModal.tsx` en `visual_library`.
  - [x] Integración en menú contextual de imágenes ("Detalles / EXIF").

- [x] **Fase 5: Motor de Conversión de Media (Prisma Convert UI)**
  - [x] Feature `src/features/converter/` (tipos, presets, hook de cola y estado de progreso).
  - [x] Componente principal `PrismaConvertView.tsx` con tabs para Imágenes, Video→Audio, Video Transcode y Audio Transcode.
  - [x] Integración en `AppSidebar.tsx` bajo la sección "HERRAMIENTAS" y enrutamiento en `App.tsx`.

- [x] **Fase 6: Atajos de Teclado y Compatibilidad de Listas en Explorador**
  - [x] Atajos `n` (siguiente), `p` (anterior), `Espacio` (play/pause), `Flechas` (seek y volumen), `l` (letras), `q` (cola) y `m` (mute) en `PlaybackPreview.tsx`.
  - [x] Soporte de listas de reproducción (.m3u, .m3u8, .pls, .xspf) al abrir desde el explorador en `handleOpenFile` de `App.tsx`.
  - [x] Componente dedicado `QuickLookPlaylist.tsx` para previsualizar pistas y reproducir listas directamente desde Quick Look con espacio en el escritorio/explorador.
