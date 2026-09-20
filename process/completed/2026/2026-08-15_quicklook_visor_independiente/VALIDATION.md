# Validación — Quick Look y Visor Multimedia Independiente

## Criterios de Éxito
- [x] La pulsación de `Espacio` en Windows Explorer o Escritorio abre la ventana de previsualización Quick Look para imágenes, vídeos y audios.
- [x] La navegación con flechas en Explorer actualiza la previsualización mientras Quick Look está abierto.
- [x] Al pulsar `Esc` o hacer clic fuera de la previsualización, Quick Look se cierra limpiamente.
- [x] Al abrir un archivo multimedia desde el explorador con Prisma (`Prisma.exe "ruta"`), se abre de inmediato el visor Quick Look ligero sin cargar la aplicación principal completa.
- [x] El botón «Abrir en Prisma» dentro del visor transfiere el archivo a la aplicación principal y abre la ventana principal.
- [x] No existen errores de compilación ni advertencias críticas en el backend de Rust ni en el frontend.

## Registro de Comprobaciones
| Fecha | Prueba | Resultado | Notas |
|---|---|---|---|
| 2026-08-15 | `cargo check` en `src-tauri` | Exitoso | 0 errores de compilación |
| 2026-08-15 | `cargo test` (20 tests unitarios) | Exitoso | 20 passed; 0 failed |
| 2026-08-15 | `bun run build` (Typecheck + Vite) | Exitoso | Compilación frontend limpia |
| 2026-08-15 | Sincronización de eventos QuickLook | Exitoso | Emit global + Webview listener + re-fetch al enfocar |
| 2026-08-15 | Detección de selección en Escritorio | Exitoso | `FindWindowSW` con `VARIANT::default()` |
| 2026-08-15 | Aislamiento de ventana principal | Exitoso | `visible: false` en `tauri.conf.json` y supresión de autoplay |
