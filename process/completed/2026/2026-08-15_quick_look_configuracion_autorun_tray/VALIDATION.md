# Validación: Configuración de Atajos, Autorun y Bandeja del Sistema (System Tray)

## 1. Criterios de Aceptación

- [x] **Selector de Atajos**: Se puede alternar dinámicamente entre `Espacio`, `Ctrl + Espacio`, `Alt + Espacio`, `Shift + Espacio` y `Desactivado` en la pantalla de Configuración.
- [x] **System Tray (Bandeja del Sistema)**: El icono de Prisma se ubica en el área de notificación de Windows con menú contextual rápido ("Mostrar Prisma", "Configuración", "Salir").
- [x] **Minimizar a la Bandeja**: Con la opción activa, cerrar la ventana principal oculta la interfaz y mantiene Prisma residente con 0% de CPU para que Quick Look responda al instante.
- [x] **Autorun (Inicio con Windows)**: La opción escribe o elimina la entrada en `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.
- [x] **Arranque Silencioso**: Soporte para el flag `--autostart` para que la ventana permanezca oculta en la bandeja al encender el sistema.
- [x] **Calidad de Código**: `bun run build` pasó con 0 errores de TypeScript y `cargo test --features mpv` superó 17 pruebas unitarias al 100%.

---

## 2. Registro de Pruebas y Evidencia

- **Frontend Compilation**: `bun run build` compiló sin errores en 1.03s.
- **Rust Backend**: `cargo check --features mpv` finalizó limpio.
- **Rust Test Suite**: `cargo test --features mpv` ejecutó 17 pruebas unitarias (17 passed, 0 failed).
