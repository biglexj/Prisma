# Plan de Implementación: Perfeccionamiento de Instancia Múltiple QuickLook, Blindaje de Renderizado y Opción de Rescate en Tray

## Contexto y Diagnóstico Científico
A través de la inspección forense del código, el log de trazas nativas (`test/hook_trace.log`), los audios del usuario y las capturas de pantalla, se han identificado tres áreas críticas de mejora:

1. **Instancia Múltiple (Desacoplar / Pin con icono `layers`)**:
   - **Exclusividad**: Actualmente el botón `layers` se ofrecía en todos los tipos de archivo e incluso en ventanas ya desacopladas. Debe limitarse **únicamente a imágenes y vídeos**, y ocultarse en instancias ya desacopladas.
   - **Barra de tareas saturada**: En `service.rs`, las ventanas secundarias tenían `.skip_taskbar(false)`, duplicando iconos en la barra de tareas de Windows. Debe ser estrictamente `.skip_taskbar(true)`.
   - **Comportamiento Pin / Flotante**: Deben configurarse con `.always_on_top(true)` para mantenerse fijas al lado sin perderse detrás del Explorador.
   - **Intercambio fluido**: Al desacoplar una ventana, la ventana principal de QuickLook debe seguir funcionando y respondiendo con fluidez a la navegación en Explorer (`SW_SHOWNOACTIVATE` y `HWND_TOP`).

2. **Diagnóstico y Blindaje ante Fallos de Previsualización (Pantalla Negra en Cascada)**:
   - En la captura se observó la cabecera verde con datos EXIF/dimensiones (`2752 x 1536 px`), pero el viewport estaba negro.
   - En `QuickLookImage.tsx` no existía gestión de eventos `onError`, lo que dejaba el viewport en negro cuando un recurso fallaba en WebView2.
   - La aplicación carecía de un `ErrorBoundary` en React. Cualquier excepción no capturada en un visor descompone el árbol de componentes de React, impidiendo que las siguientes imágenes o archivos se rendericen hasta reiniciar la app.

3. **Salvaguarda en el Menú de la Bandeja de Sistema (System Tray)**:
   - El menú contextual solo contaba con "Salir de Prisma". Se incorporará la opción «Reiniciar Prisma» (`app.restart()`) inmediatamente encima de «Salir de Prisma», permitiendo al usuario revivir el entorno en un instante sin tener que salir y buscar la aplicación manualmente.

---

## Plan de Ejecución Modular

### Módulo 1: Backend Nativo Rust (`src-tauri/`)
1. **`src-tauri/src/lib.rs`**:
   - Agregar el elemento de menú de bandeja `restart_item` («Reiniciar Prisma») al `TrayIconBuilder`.
   - Manejar el evento `"restart"` ejecutando `app.restart()`.
2. **`src-tauri/src/features/quick_look/service.rs`**:
   - En `open_detached`: validar que solo tipos `Image` y `Video` puedan desacoplarse.
   - Configurar `WebviewWindowBuilder` con `.skip_taskbar(true)` y `.always_on_top(true)`.
   - En `handle_selection_update`: garantizar que la ventana principal de QuickLook se mantenga en el z-order correcto con `SW_SHOWNOACTIVATE` y `HWND_TOP` sin robar el foco del Explorador.

### Módulo 2: Frontend QuickLook (`src/features/quick_look/`)
1. **`QuickLookErrorBoundary.tsx` [NUEVO]**:
   - Componente de captura de errores para aislar fallos en visores multimedia.
   - UI elegante Material 3 Expressive con mensaje claro, botón de "Reintentar" y botón de "Abrir en Prisma".
2. **`QuickLookHeader.tsx`**:
   - Actualizar tooltip del botón de desacoplar: *"Fijar en ventana flotante independiente (sin barra de tareas)"*.
3. **`QuickLookWindow.tsx`**:
   - Pasar `onOpenDetached` condicionado a `!isDetached && (payload.mediaType === "image" || payload.mediaType === "video")`.
   - Envolver el renderizado de `quicklook-body` con `QuickLookErrorBoundary`.
   - Añadir atajo de recarga rápida (`F5` / `Ctrl+R`) dentro de QuickLook.
4. **`QuickLookImage.tsx`**:
   - Implementar control de estados: `loading`, `hasError`.
   - Manejador `onError` en `<img>` que active la UI de recuperación con botón de reintento.
   - Resetear estados al cambiar `payload.path`.

---

## Criterios de Éxito y Verificación
- Ninguna ventana desacoplada aparece en la barra de tareas de Windows.
- Las ventanas desacopladas flotan fijas sobre las demás (`always_on_top: true`).
- La ventana principal de QuickLook continúa actualizándose y alternando archivos en Explorer sin trabas.
- El botón `layers` solo aparece en imágenes y vídeos, y nunca en ventanas ya desacopladas.
- Si una imagen o visor experimenta un fallo, se muestra una interfaz de error amigable con botón de reintento sin bloquear las siguientes previsualizaciones.
- El menú del System Tray incluye «Reiniciar Prisma» completamente funcional.
