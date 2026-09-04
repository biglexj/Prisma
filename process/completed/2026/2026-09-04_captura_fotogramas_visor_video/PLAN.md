# Captura de Fotogramas en Visor de Vídeo (Snapshot estilo VLC) y Configuración de Assets — Plan

- Estado: `DRAFT`
- Fecha: `2026-09-04`
- Proyecto: `Prisma`

## Objetivo

Implementar en el visor de vídeos (`VideoPlayer`) una función de captura de fotogramas (snapshot) nativa a resolución completa al estilo de VLC, con atajo de teclado (`Shift + S`), botón de cámara en controles y menú de herramientas, feedback visual (destello de obturador y notificación toast), y configuración personalizable de la carpeta de guardado de assets/capturas (por defecto la carpeta de Imágenes del sistema) con selector de directorios en los ajustes generales de la aplicación.

## Alcance

- Incluye:
  - Backend Rust: Comando `video_save_snapshot` para decodificar el fotograma (PNG/JPEG), resolver la carpeta de salida (por defecto Imágenes de Windows o personalizada), generar nombres descriptivos con timestamp (`Prisma_snap_[titulo]_[timestamp].[ext]`), evitar colisiones y escribir a disco.
  - Backend Rust: Comando `media_get_default_pictures_dir` para obtener la ruta canónica de la carpeta de Imágenes del sistema.
  - Settings (`useSystemSettings` y `AppSettings`): Nueva configuración de "Capturas de Vídeo y Assets" dentro de Ajustes Generales, permitiendo ver la ruta actual, cambiar la carpeta con el selector de carpetas de Tauri, restablecer a la carpeta de Imágenes predeterminada, seleccionar formato (PNG / JPEG) y alternar efecto de obturador.
  - Frontend (`useVideoSnapshot` hook modular): Extracción de fotograma en resolución nativa (`videoWidth` x `videoHeight`) mediante canvas offscreen sin alterar la reproducción en curso, sin distorsión ni pérdida de calidad.
  - UI `VideoPlayer`: Botón de captura con icono `camera` en la barra de controles inferior, opción en `VideoToolsMenu`, opción en el menú contextual (`ContextMenu`), atajo global `Shift + S`, efecto visual de destello de cámara (`shutter flash`) y toast flotante con miniatura y acción "Mostrar en carpeta".
  - Documentación de Atajos: Registro de `Shift + S` en la sección de referencia de atajos de teclado de `AppSettings`.
- No incluye:
  - Grabación continua de secuencias de vídeo (screen recording).
  - Modificación del motor de reproducción subyacente.

## Enfoque

1. **Backend Rust**:
   - Crear comandos `video_save_snapshot` y `media_get_default_pictures_dir` en `src-tauri/src/app/commands/media.rs`.
   - Registrar los nuevos comandos en `src-tauri/src/lib.rs`.
2. **Settings & Estado**:
   - Extender `SystemSettings` en `src/app/useSystemSettings.ts` con `videoSnapshotFolder` y `videoSnapshotFormat`.
   - Integrar la tarjeta de configuración en `src/app/ui/AppSettings.tsx` con selector de carpetas nativo (`@tauri-apps/plugin-dialog`).
   - Añadir los atajos de captura y paso de fotogramas a la pestaña de "Atajos de Teclado" en `AppSettings.tsx`.
3. **Módulo de Captura y Paso de Fotogramas (Frontend Hook)**:
   - Crear `src/features/visual_library/hooks/useVideoSnapshot.ts` para encapsular la captura desde el elemento `<video>`, el destello visual y la llamada al backend.
   - Implementar las funciones `stepFrameForward` y `stepFrameBackward` con pausa atómica y cálculo temporal de precisión.
4. **Integración en el Visor de Vídeo**:
   - Añadir controles de fotograma a fotograma y botón de cámara en `VideoPlayer.tsx`.
   - Añadir listeners de teclado para `Shift + S`, `E`, `Shift + E`, `,` y `.`.
   - Añadir opciones en `VideoToolsMenu.tsx` y en el menú contextual de vídeo.
   - Añadir estilos CSS para el destello y el toast flotante de captura en `video-player.css`.

## Criterios de finalización

- [ ] Captura de fotograma a resolución nativa del vídeo sin pausar ni congelar la reproducción.
- [ ] Navegación cuadro a cuadro hacia adelante y hacia atrás operativa con atajos (`E`, `Shift + E`, `,`, `.`) y botones en la UI.
- [ ] Atajo de teclado `Shift + S` operativo en el reproductor de vídeo.
- [ ] Botón de cámara disponible en la barra de controles y en `VideoToolsMenu`.
- [ ] Carpeta de guardado configurable desde `AppSettings` -> `General y Sistema`.
- [ ] Carpeta predeterminada establecida automáticamente en la carpeta de Imágenes (`Pictures`) del sistema operativo.
- [ ] Botón "Restablecer a Imágenes" y "Cambiar carpeta..." completamente funcionales.
- [ ] Notificación toast con miniatura, nombre del archivo y botón para abrir la carpeta contenedora.
- [ ] Compilación TypeScript (`tsc --noEmit`) y Rust (`cargo check`) sin errores.

## Autorización

- [ ] Plan aprobado para ejecución.
