# Registro de Validación — Instancia Múltiple QuickLook y Rescate Tray

## Pruebas de Verificación Ejecutadas

1. **Compilación de Frontend**:
   - Comando: `bun run build`
   - Resultado: **EXITOSO** (0 errores de TypeScript, 234 módulos transformados por Vite en 3.17s).

2. **Compilación y Tests Backend**:
   - Comando: `cargo check`
   - Resultado: **EXITOSO** (0 errores, dev profile finalizado en 19.46s).
   - Comando: `cargo test`
   - Resultado: **EXITOSO** (34 tests unitarios ejecutados y aprobados al 100%, 0 fallos).

3. **Verificación de Requerimientos Funcionales**:
   - **Opción de rescate en el Tray**: `restart_item` («Reiniciar Prisma») añadido justo antes de «Salir de Prisma» con llamada canónica a `app.restart()`.
   - **Exclusividad de Instancia Múltiple**: Botón `layers` condicionado a `!isDetached && (mediaType === "image" || mediaType === "video")` en frontend, y validado con error tipado en backend.
   - **Ventanas secundarias limpias**: Creadas con `.skip_taskbar(true)` para no duplicar iconos en la barra de tareas de Windows.
   - **Comportamiento Pin**: Creadas con `.always_on_top(true)` para flotar fijas sobre cualquier ventana.
   - **Intercambio continuo en Explorer**: En `handle_selection_update`, la ventana principal de QuickLook se mantiene en la cima de z-order con `SW_SHOWNOACTIVATE` y `HWND_TOP` sin robar el foco del Explorador.
   - **Blindaje ante pantallas negras**:
     - `QuickLookImage.tsx` maneja `onError`, `isLoading`, botón de "Reintentar decodificación", y decodificación fiable (`decoding="auto"`).
     - `QuickLookErrorBoundary.tsx` aísla cualquier error inesperado en visores y permite reintentar o navegar al siguiente archivo sin corromper el árbol de React.
     - Atajos `F5` / `Ctrl+R` permiten refrescar la vista en cualquier momento.
