# Plan de Proceso: Corrección de Superposición Quick Look, Resguardo de Cola de Música y Navegación Natural de Vídeos e Imágenes

- Fecha de inicio: 2026-09-25
- Rama de trabajo: `preview`
- Estado: En ejecución

---

## 1. Diagnóstico y Causa Raíz

### 1.1 Quick Look se oculta tras Prisma al estar abierto ("Se reproduce audio/video pero no se visualiza")
- **Causa**: En el commit `f66d63f`, se condicionó `window.set_always_on_top(is_pinned)` al estado de *fijado/pinning*. Al abrir Quick Look de forma estándar (sin fijar, `is_pinned = false`), se desactiva `always_on_top` y se invoca `SetWindowPos` con `HWND_TOP` y `SWP_NOACTIVATE`.
- Al estar la ventana principal de Prisma abierta, Windows posiciona la ventana de Quick Look **por detrás** de la ventana de Prisma. Como el componente multimedia de Quick Look activa la reproducción de audio/vídeo, el sonido se escucha pero la ventana queda oculta tras la interfaz de Prisma (y en imágenes no se aprecia nada).
- **Solución elegante**: Quick Look es un visor flotante superpuesto (*overlay*) por definición. Debe mantener **siempre** `set_always_on_top(true)` y `HWND_TOPMOST` en Win32 (`SetWindowPos`), garantizando que flote siempre sobre la aplicación y el explorador sin robar el foco. El modo fijado (*pinning*) solo debe controlar el comportamiento de auto-cierre ante pérdida de foco, nunca la propiedad `always_on_top`. Asimismo, `is_foreground_quicklook()` debe validar el HWND concreto de Quick Look para evitar confusiones si la ventana principal de Prisma tiene el foco.

### 1.2 Interferencia de música al abrir vídeos ("Se repone en play la cola de la música")
- **Causa**: En `App.tsx`, tanto `playVideoItem` como `handleOpenFile` invocaban `void playback.toggle();` en lugar de una pausa explícita `void playback.pause();`. Si la reproducción de audio estaba pausándose o en transición, `toggle()` alternaba a reproducción reanudando la música.
- Además, el listener de `quicklook://hide` en `App.tsx` poseía un retardo de 100 ms que ejecutaba `playback.resume()` para restaurar el estado previo de audio sin verificar si en ese instante se acababa de abrir un vídeo en pantalla completa (`video_player`).
- **Solución elegante**: Forzar `void playback.pause();` categórico en `playVideoItem` y `handleOpenFile`, cancelando `resumeTimeoutRef` y anulando `wasPlayingBeforeQuickLookRef.current`. Impedir que `quicklook://hide` reanude el audio si la vista activa es el reproductor de vídeo o hay un vídeo reproduciéndose.

### 1.3 Cola relativa y orden natural correlativo en Vídeos e Imágenes
- **Causa**: Al abrir un vídeo o imagen desde la línea de tiempo, Inicio o archivos externos, `App.tsx` encolaba toda la biblioteca global (`videoLibrary.items` / `imageLibrary.items`). En aperturas externas o sin sesión, anteponía el ítem seleccionado al inicio (`[item, ...items]`), convirtiendo el ítem abierto en el #1 en lugar de respetar su posición real.
- **Diferencia de diseño confirmada**:
  - **Música**: La canción seleccionada rota para convertirse en la #1 de la cola (`resolveMusicQueueForPath`).
  - **Vídeos e Imágenes**: Deben conservar su orden natural correlativo (orden 1, 2, 3, 4, 5...). Si se abre el elemento 5, debe permanecer en el índice 5 (`currentIndex = 4`).
- **Navegación con flechas en Vídeo**:
  - En `ImageViewer`, `ArrowLeft` y `ArrowRight` navegan a la imagen anterior y siguiente.
  - En `VideoPlayer`, las flechas estaban ligadas a saltos de 10 segundos. Ahora las flechas izquierda y derecha navegarán al vídeo anterior y siguiente (vídeo 4 y vídeo 6), homologando la experiencia con el visor de imágenes, mientras que los saltos temporales se mantienen con `j` / `l` y `Shift + Flechas`.

---

## 2. Arquitectura de Cambios

1. **Backend Rust (`src-tauri/src/features/quick_look/service.rs`)**:
   - Restaurar `set_always_on_top(true)` y `HWND_TOPMOST` en la apertura y actualización de Quick Look.
   - Refactorizar `is_foreground_quicklook()` para comparar el HWND de la ventana de Quick Look en lugar del PID compartido del proceso.
   - Añadir comando `visual_library_scan_folder_items(file_path: String, kind: VisualMediaKind)` para escanear en orden natural los archivos relativos directos de la carpeta de un archivo externo.

2. **Frontend React (`src/app/App.tsx`)**:
   - Reemplazar `playback.toggle()` por `playback.pause()` estricto al reproducir vídeo o abrir archivos.
   - Proteger el listener de `quicklook://hide` para no reanudar música si la vista activa es `video_player`.
   - Implementar resolución de cola relativa y orden natural para vídeos e imágenes sin rotación circular.

3. **Frontend Visual Library (`src/features/visual_library/ui/`)**:
   - `VisualLibrary.tsx`: Al hacer clic en un vídeo o imagen desde la línea de tiempo o vista general, encolar únicamente los elementos hermanos de su misma carpeta en su orden natural.
   - `VideoPlayer.tsx`: Mapear `ArrowLeft` a `handlePrevious()` y `ArrowRight` a `handleNext()`, preservando `Shift + Flechas` y `j` / `l` para retroceso y avance de 10 segundos.
