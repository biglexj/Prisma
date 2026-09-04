# Captura de Fotogramas en Visor de Vídeo (Snapshot estilo VLC) y Configuración de Assets — Tareas

- Estado: `PENDING`

## Ejecución

- [x] T01 — Backend Rust: Implementar comandos `video_save_snapshot` y `media_get_default_pictures_dir` en `src-tauri/src/app/commands/media.rs` y registrarlos en `src-tauri/src/lib.rs`.
- [x] T02 — Settings: Extender `useSystemSettings.ts` con `videoSnapshotFolder` y `videoSnapshotFormat`, y agregar el cliente de invocación en frontend (`mediaOperations.ts`).
- [x] T03 — Settings UI: Añadir sección de configuración en `AppSettings.tsx` (selector de carpeta, botón restablecer a Imágenes, selector de formato PNG/WebP/JPEG) y documentar `Shift + S`, `E`, `Shift + E`, `,`, `.` en Atajos de Teclado.
- [x] T04 — Hook de Captura y Fotogramas: Crear `src/features/visual_library/hooks/useVideoSnapshot.ts` con extracción Canvas nativa, funciones de paso de fotograma hacia adelante y atrás (`stepFrameForward` / `stepFrameBackward`), destello de obturador y feedback toast.
- [x] T05 — UI Visor de Vídeos: Integrar botón de captura y botones de paso de fotograma (`-1 fotograma`, `+1 fotograma`) en `VideoPlayer.tsx`, opciones en `VideoToolsMenu.tsx`, menú contextual y atajos universales (`Shift + S`, `E`, `Shift + E`, `,`, `.`).
- [x] T06 — Estilos Visuales: Añadir animaciones de destello (`shutter flash`), botones de paso de fotogramas y toast con miniatura en `video-player.css`.
- [x] T07 — Validación técnica: Ejecutar `bun run compile:check` (`tsc --noEmit`) y verificar compilación de Rust.
- [x] T08 — Corrección de Captura (CORS/Lienzo): Añadir `crossOrigin="anonymous"` al elemento `<video>` en `VideoPlayer.tsx` y fallback/reporte visual de errores en `useVideoSnapshot.ts` y `video-player.css` para solventar el lienzo bloqueado.
- [x] T09 — Reasignación de Atajos F / Shift+F: Asignar `F` a avanzar 1 fotograma ("F de Fotograma") y `Shift + F` a retroceder 1 fotograma; migrar pantalla completa a `F11` y `Alt + Enter`. Actualizar tabla de atajos en `AppSettings.tsx`.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
