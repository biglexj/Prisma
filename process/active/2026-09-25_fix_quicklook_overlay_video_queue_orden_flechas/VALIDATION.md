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

6. **Configuración de Atajos: Pantalla Completa vs. Fotogramas y Sincronización UI**:
   - **Esquema de Pantalla Completa (Fullscreen)**:
     - `F`: Alternar pantalla completa (`toggleFullscreen()`).
     - `F11`: Alternar pantalla completa.
     - `Alt + Enter`: Alternar pantalla completa.
     - Doble clic: Alternar pantalla completa sobre la superficie del vídeo.
     - `Esc`: Salir de pantalla completa.
   - **Esquema de Navegación por Fotogramas**:
     - `E`: Avanzar 1 fotograma (`stepFrameForward()`, estilo VLC).
     - `.` (punto): Avanzar 1 fotograma (estilo universal).
     - `Shift + E`: Retroceder 1 fotograma (`stepFrameBackward()`, estilo VLC).
     - `,` (coma): Retroceder 1 fotograma (estilo universal).
   - **Sincronización en la UI de Referencia (`AppSettings.tsx`)**:
     - Categoría *Vídeo y Reproducción*:
       - *Avanzar 1 fotograma*: `E`, `.`
       - *Retroceder 1 fotograma*: `Shift + E`, `,`
       - *Pantalla completa*: `F`, `F11`, `Alt + Enter`
     - Categoría *Subtítulos y Pantalla*:
       - *Pantalla completa*: `F`, `F11`
   - **Resultado**: ✅ Comportamiento impecable en el reproductor de vídeo y visualización de atajos 100% coherente en los ajustes del sistema.

7. **Compilación Limpia**:
   - `cargo check`: Terminado con código 0 en 1.16s sin advertencias ni errores.
   - `bun run build`: Terminado con código 0 en 3.00s (245 módulos transformados sin errores TypeScript).

8. **Optimización y Rediseño del Panel de Atajos (`ShortcutsSettingsPanel.tsx`)**:
   - Sustituida la cuadrícula rígida de CSS Grid por un layout Masonry fluido en columnas (`columns: 3 340px; break-inside: avoid`), eliminando el espacio en blanco inferior que generaba la tarjeta de vídeo.
   - Añadidos chips de filtro interactivo por categoría con contador reactivo ("Todos", "Globales y Audio", "Vídeo", "Música", "Imágenes", "Edición") y barra de búsqueda en tiempo real por acción o tecla.
   - `AppSettings.tsx` reducido de 1287 líneas a 945 líneas, cumpliendo con la regla de crecimiento de archivos del proyecto.

9. **Comportamiento de Cierre de Ventana "X", Pausa de Vídeo y Modo Segundo Plano**:
   - **Causa raíz identificada**: Al tener activado *Minimizar a la bandeja del sistema*, el evento `WindowEvent::CloseRequested` ocultaba la ventana (`window.hide()`), pero el elemento `<video>` continuaba reproduciéndose en segundo plano en el WebView.
   - **Solución implementada**:
     - En `lib.rs`: `WindowEvent::CloseRequested` emite el evento `"prisma://window-close-requested"` antes de ocultar la ventana.
     - En `App.tsx`: se escucha `"prisma://window-close-requested"` y se despacha `"prisma-video-pause"` pausando defensivamente todo elemento `<video>` activo. La música continúa reproduciéndose en segundo plano tal como se espera de un reproductor de audio.
     - **Atajo para Segundo Plano**: Se implementó `Shift + B` (Background) y la tecla `H` (Hide) tanto en `VideoPlayer.tsx` como en `App.tsx` e `ImageViewer.tsx` para permitir que el usuario envíe deliberadamente Prisma a segundo plano sin pausar el vídeo, continuando con la escucha del audio en segundo plano.
     - **Atajo para Cerrar**: Se integró `Ctrl + W` para cerrar/minimizar la ventana pausando el vídeo, y la tecla `Q` en `ImageViewer.tsx` para cerrar el visor rápidamente.

10. **HUD / OSD Flotante de Volumen Animado (`VolumeOsd.tsx`)**:
   - Se implementó el componente reutilizable `VolumeOsd.tsx` y sus estilos `volume-osd.css` posicionado en la esquina superior derecha (`top: 24px; right: 28px`), con desenfoque translúcido *frosted glass* (Material 3 Expressive).
   - **Ondas dinámicas de sonido**: Tres arcos concéntricos de audio (`)))`) que se encienden, crecen y pulsan de forma proporcional al nivel de volumen (Onda 1: 1-33%, Onda 2: 34-66%, Onda 3: 67-100%), icono de altavoz silenciado con vibración sutil (`prismaMuteShake`), porcentaje numérico con cifras tabulares y micro-barra de progreso con gradiente tonal.
   - **Visibilidad no intrusiva**: El OSD se activa mediante teclas `↑`/`↓`, `+`/`-`, `M` o mandos a distancia LAN, sin provocar la aparición de la barra de controles inferior ni de la cabecera. Si los controles están ocultos, permanecen ocultos; el HUD flota limpiamente durante 1.4s y se desvanece de forma suave.
   - Se integró tanto en `VideoPlayer.tsx` como a nivel global en `App.tsx` para música.

