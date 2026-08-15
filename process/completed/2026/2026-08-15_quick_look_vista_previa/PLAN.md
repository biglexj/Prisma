# Plan: Prisma Quick Look (Previsualización Rápida con Espacio)

## 1. Contexto y Objetivos

Implementar la función de **Quick Look** en Prisma inspirada en la experiencia de macOS y [QL-Win/QuickLook](https://github.com/QL-Win/QuickLook), adaptada al diseño y capacidades multimedia de Prisma:
- **Espacio en Explorador o Escritorio**: Detectar el archivo seleccionado e invocar una ventana flotante de previsualización ultraligera en milisegundos sin abrir la interfaz completa de Prisma.
- **Tipos de Medios Limitados**:
  - **Música**: Tarjeta compacta con carátula a la izquierda, título, artista, duración a la derecha, barra de transporte inferior con volumen, y paleta de color adaptativa.
  - **Imagen**: Visor de alta resolución optimizado, auto-fit, zoom sutil y badge con dimensiones/peso.
  - **Vídeo**: Reproducción instantánea con controles mínimos de reproducción/pausa, scrubber y volumen.
- **Segundo Plano y Rendimiento**: Prisma puede residir en segundo plano (minimizada o en bandeja). Al cerrar la vista previa (`Espacio`, `Esc` o clic fuera), la ventana se oculta y detiene cualquier reproducción para liberar CPU y memoria al 0%.
- **Navegación Dinámica**: Si la vista previa está abierta y el usuario cambia de archivo con las flechas en el Explorador, la ventana actualiza su contenido fluidamente.
- **No interferencia**: Si el usuario está renombrando un archivo o escribiendo en un cuadro de texto, la barra espaciadora se comporta normalmente.

---

## 2. Arquitectura de la Solución

### A. Backend Nativo (Rust en `src-tauri`)
- **Hook de Teclado de Bajo Nivel (`WH_KEYBOARD_LL`)**:
  - Instalado mediante `SetWindowsHookExW` en un hilo dedicado con bucle de mensajes de Windows (`GetMessageW`).
  - Verificación de foco con `GetGUIThreadInfo` / `GetFocus()` y clases de ventana (`Edit`, `RichEdit`, etc.) para ignorar eventos de edición.
- **Extracción de Selección vía COM (`IShellWindows` / `IFolderView2`)**:
  - Consulta COM rápida (<3ms) a la ventana activa del Explorador (`CabinetWClass`) o Escritorio (`Progman` / `WorkerW`).
- **Filtrado Multimedia**:
  - Verificación de extensión contra formatos admitidos de audio, vídeo e imagen.
- **Control de Ventana**:
  - Envía la ruta a la ventana secundaria `quicklook` mediante eventos Tauri (`quicklook://preview`), ajusta posición/foco y maneja el ocultamiento (`quicklook://hide`).

### B. Ventana Flotante Secundaria en Tauri v2
- Configuración en `tauri.conf.json` / `setup`:
  - `label`: `"quicklook"`, `decorations`: `false`, `transparent`: `true`, `alwaysOnTop`: `true`, `visible`: `false`, `skipTaskbar`: `true`.
  - Precargada en memoria para apertura instantánea (0ms de latencia de inicialización).

### C. Frontend React (Material 3 Expressive)
- `src/features/quick_look/`:
  - `ui/QuickLookWindow.tsx`: Contenedor principal de la ventana flotante.
  - `ui/QuickLookHeader.tsx`: Barra superior con nombre de archivo, tamaño, botón *"Abrir en Prisma"* y botón de cierre.
  - `ui/QuickLookMusic.tsx`: Reproductor compacto de audio con carátula y paleta adaptativa.
  - `ui/QuickLookImage.tsx`: Visor de imagen optimizado con dimensiones nativas.
  - `ui/QuickLookVideo.tsx`: Visor de vídeo ligero con controles mínimos.
  - `ui/quick-look.css`: Estilos visuales tonales, esquinas redondeadas y desenfoque.

---

## 3. Fases de Ejecución

1. **Fase 1: Backend Rust — Detección Shell COM y Hook de Teclado**
2. **Fase 2: Ventana Secundaria Tauri y Enrutamiento Aislado**
3. **Fase 3: Frontend — Visores Compactos para Imagen, Vídeo y Música**
4. **Fase 4: Navegación Continua, Ciclo de Vida y Botón "Abrir en Prisma"**
5. **Fase 5: Validación Integral y Pruebas**
