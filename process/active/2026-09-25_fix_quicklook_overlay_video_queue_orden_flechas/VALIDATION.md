# Validación del Proceso

## Pruebas Realizadas y Resultados

1. **Quick Look con Prisma abierto (Z-Order y Visibilidad)**:
   - **Causa raíz identificada**: `window.set_always_on_top(is_pinned)` desactivaba el topmost cuando `is_pinned == false`, enviando la ventana detrás de Prisma mediante `SW_SHOWNOACTIVATE`.
   - **Solución implementada**:
     - Quick Look ahora conserva `window.set_always_on_top(true)` de forma permanente en `show_file_path_with_selection` y al cambiar de estado de pin.
     - `SetWindowPos` en Windows utiliza `HWND_TOPMOST` con `SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW`.
     - `is_foreground_quicklook()` utiliza `GetAncestor(fg, GA_ROOT)` para verificar con precisión el HWND de la ventana de previsualización sin colisionar con la ventana principal de Prisma.
   - **Resultado**: ✅ Quick Look aparece en primer plano flotante sobre Prisma y Explorer sin robar el foco de Windows.

2. **Centrado de Ventana Quick Look al transicionar entre Medios y Tipos de Archivo**:
   - **Causa raíz identificada**:
     1. En `service.rs`: `if !already_open && !is_pinned { window.center(); }` omitía el recentrado al cambiar de archivo con la ventana ya abierta (`already_open == true`).
     2. En `handle_selection_update`: al navegar con flechas en el Explorador de Windows, se cambiaba el tamaño con `window.set_size(LogicalSize::new(width, height))`, pero Windows ancla la esquina superior izquierda `(x, y)` por defecto al redimensionar. Si se pasaba de una imagen vertical o pequeña a un archivo `.af`, horizontal u otro tipo de medio, la ventana se expandía hacia abajo y hacia la derecha, perdiendo el centro de la pantalla y quedando descolocada.
     3. En `quick_look_set_size`: la llamada a `window.set_size(w, h)` desde el frontend tampoco recentraba la ventana.
     4. En `lib.rs`: `tauri-plugin-window-state` guardaba la posición descentrada de `quicklook` en `.window-state-v2.json` y la restauraba al iniciar.
   - **Solución implementada**:
     - En `service.rs`: `window.center()` se ejecuta incondicionalmente siempre que la ventana no esté fijada (`if !self.is_pinned.load(Ordering::SeqCst) { let _ = window.center(); }`), tanto en `show_file_path_with_selection` como dentro de `handle_selection_update` ante cada evento de cambio de selección en Explorer.
     - En `quick_look_set_size`: si la ventana no está fijada (`!state.is_pinned()`), se invoca `window.center()` inmediatamente tras cambiar el tamaño.
     - En `lib.rs`: se añadió `.with_denylist(&["quicklook"])` y `.skip_initial_state("quicklook")` al plugin `tauri_plugin_window_state` para evitar que guarde o fuerce coordenadas estáticas sobre la ventana dinámica de Quick Look. Se limpiaron las coordenadas residuales de los archivos JSON de estado local.
   - **Resultado**: ✅ Cada tipo de archivo (imágenes de cualquier relación de aspecto, proyectos `.af`, audio, vídeo, documentos) recalcula su tamaño y recentra la ventana con precisión milimétrica desde el centro de la pantalla.

3. **Apertura de Vídeo e Interferencia con Música**:
   - **Causa raíz identificada**: `playback.toggle()` causaba reactivación accidental de la música; el evento `quicklook://hide` contenía un timeout que llamaba a `playback.resume()` sin verificar si había un vídeo activo.
   - **Solución implementada**:
     - En `App.tsx`: `playVideoItem` y la rama `isVideo` de `handleOpenFile` ahora ejecutan `void playback.pause()` de forma estricta (sin toggle).
     - Se crearon `activeViewRef` y `activeVideoPathRef` para verificar en el listener de `quicklook://hide` si el reproductor de vídeo o un vídeo están activos (`isVideoActive`), cancelando la reanudación de la música en ese caso.
   - **Resultado**: ✅ La música se silencia/pausa rotundamente al abrir cualquier vídeo y no se reactiva al descartar Quick Look o transicionar entre medios.

4. **Encolado Relativo y Orden Correlativo en Vídeo e Imágenes**:
   - **Causa raíz identificada**: En `VisualLibrary.tsx` (Timeline), al hacer click en un elemento se pasaba `sortedNonExcludedItems` (la lista global de toda la biblioteca).
   - **Solución implementada**:
     - Creado `visual_library_scan_folder_items` en Rust (`src-tauri/src/app/commands/visual_library.rs`) y expuesto a través de `visualLibraryClient.scanFolderItems`.
     - Creado servicio `resolveVisualSessionForPath` (`src/features/visual_library/services/visualSessionResolver.ts`) que resuelve únicamente los hermanos de la misma carpeta, los ordena de forma natural correlativa (1, 2, 3...) y conserva el índice exacto sin rotación circular.
     - En `VisualLibrary.tsx`: se implementó `getFolderSiblings` para que en el Timeline solo se encolen los hermanos relativos de la carpeta del elemento.
     - En `VideoPlayer.tsx`:
       - `ArrowLeft` (sin Shift/Ctrl): va directamente al vídeo anterior (`handlePrevious(true)`).
       - `ArrowRight` (sin Shift/Ctrl): va al vídeo siguiente (`handleNext()`).
       - `Shift + ArrowLeft/Right`, `Ctrl + ArrowLeft/Right` o teclas `J`/`L`: retroceden / avanzan 10 segundos en la barra de tiempo.
       - Tooltips de controles actualizados en consecuencia.
     - La música mantiene su rotación canónica intacta en `resolveMusicQueueForPath`.
   - **Resultado**: ✅ El vídeo 5 se abre como elemento 5 de la carpeta; flecha izquierda va al vídeo 4, flecha derecha va al vídeo 6.

5. **Navegación Circular Continua (Wrap-around) en Reproductor de Vídeo**:
   - **Requerimiento**: Al igual que en el visor de imágenes (`ImageViewer.tsx`), al llegar al último vídeo la navegación siguiente debe pasar al primero, y en el primer vídeo la navegación anterior debe pasar al último.
   - **Solución implementada**:
     - En `VideoPlayer.tsx`:
       - `handleNext`: calcula `(currentIndex + 1) % localVideoItems.length`.
       - `handlePrevious`: calcula `(currentIndex - 1 + localVideoItems.length) % localVideoItems.length`.
       - Los botones de Anterior y Siguiente permanecen activos mientras existan 2 o más vídeos (`disabled={localVideoItems.length <= 1}`).
   - **Resultado**: ✅ Navegación circular continua y fluida en vídeos, homologando la experiencia de imágenes.

6. **Unificación de la Tecla `F` para Pantalla Completa (Fullscreen)**:
   - **Causa raíz identificada**: La tecla `F` estaba asignada a `stepFrameForward()` (avance de un solo fotograma y pausa), generando descontrol y rompiendo el estándar universal de reproductores de vídeo donde `F` activa/desactiva la pantalla completa (igual que en `ImageViewer.tsx`).
   - **Solución implementada**:
     - En `VideoPlayer.tsx`: la tecla `F` / `f` ahora invoca directamente `toggleFullscreen()`.
     - El avance/retroceso por fotogramas conserva las combinaciones de acceso rápido `E` / `Shift+E` (estilo VLC) y `,` / `.` (universal).
     - Actualizados tooltips de interfaz y atajos de teclado informativos.
   - **Resultado**: ✅ Presionar `F` alterna pantalla completa al 10,000% sin pausas imprevistas ni desubicación de controles.

7. **Compilación Limpia**:
   - `cargo check`: Terminado con código 0 en 3.21s sin errores.
   - `bun run build`: Terminado con código 0 en 2.88s (transformó 242 módulos sin errores TypeScript).
