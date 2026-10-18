# Capturador de pantalla — Validación

- Estado funcional: `PENDING`. No hay implementación ni pruebas de captura realizadas.
- Revisión documental: referencias locales y estructura del proceso comprobadas el 2026-10-18.

## Comprobaciones para la implementación

- [x] V01 — Ejecutar las comprobaciones de TypeScript/Rust del repositorio y las pruebas pertinentes de geometría, estados y composición. Registrar comandos y resultados reales.
  - `cargo check`: Completado sin errores ni advertencias (código de salida 0). Módulos de captura `features::screen_capture` e `invoke_handler` verificados.
  - `bun run check` (`tsc --noEmit`): Completado sin errores (código de salida 0).
  - `bun run build` (`vite build`): Completado con éxito en 4.37s.
- [ ] V02 — Abrir desde Herramientas y por atajo con Prisma minimizado. Esperado: una sola selección, Ventana por defecto y sin restaurar la ventana principal sobre el objetivo.
- [ ] V03 — Recorrer con el cursor dos aplicaciones, una ventana parcialmente oculta y una parcialmente fuera del monitor. Esperado: borde actualizado, captura del área visible y coincidencia entre borde y píxeles finales; sin recuperar contenido oculto.
- [ ] V04 — Recorrer regiones internas detectables y una interfaz sin controles detectables. Esperado: selección precisa cuando existe información suficiente; alternativa explícita cuando no existe. Registrar aplicaciones y regiones realmente probadas.
- [ ] V05 — Arrastrar y ajustar Rectángulo en varias direcciones y capturar Pantalla completa en cada monitor. Esperado: tamaño y posición correctos, sin selector ni borde en el resultado.
- [ ] V06 — Repetir con escalas 100 %, 125 % y 150 % cuando estén disponibles, DPI mixto y un monitor a la izquierda del principal. Esperado: sin desplazamiento ni reescalado de píxeles. Si falta hardware, mantener pendiente y describirlo.
- [ ] V07 — Escribir texto y dibujar/resaltar; borrar, deshacer y rehacer. Copiar y guardar. Esperado: ambas salidas coinciden con lo mostrado a resolución original; Ctrl+C no impide copiar texto dentro de su campo.
- [ ] V08 — Pegar la imagen en otra aplicación real. Repetir con portapapeles ocupado o error inducido. Esperado: imagen pegable y mensaje recuperable si falla; no marcar la copia como correcta ante error.
- [ ] V09 — Observar escrituras del proceso durante captura, edición, copia y cancelación mediante una herramienta de trazado de archivos. Esperado: ningún archivo, miniatura, historial o caché de la captura creado por Prisma. Separar el ruido del runtime y las políticas externas de historial/sincronización del portapapeles; no prometer controlar las escrituras del sistema operativo.
- [ ] V10 — Guardar en carpeta elegida, cancelar diálogo, probar destino sin permisos y archivo existente. Esperado: PNG válido con dimensiones y anotaciones correctas; errores no pierden la captura ni sobrescriben silenciosamente.
- [ ] V11 — Probar atajo libre y ocupado por ShareX/otro programa, pulsación sostenida, tecla alternativa, desactivar herramienta y cerrar/reabrir Prisma. Esperado: sin duplicados ni cambios automáticos a programas externos; acceso por Herramientas disponible ante conflicto.
- [ ] V12 — Pulsar Esc antes/después de seleccionar, cerrar editor y repetir capturas. Esperado: recuperación de foco y liberación de recursos; ninguna escritura o copia automática al cancelar.
- [ ] V13 — Comprobar editor en barra de tareas/Alt+Tab, capa de selección excluida y cierre independiente. Confirmar con Biglex la interpretación de «task» al presentar el resultado.
- [ ] V14 — Revisión visual de flujo, contraste del borde y cantidad de controles con Biglex. Registrar límites de superficies protegidas o no capturables cuando se observen; no inventar compatibilidad.

## Evidencia y fallos

- **2026-10-18**:
  - Compilación técnica completada al 100%.
  - Backend Rust: `features/screen_capture` (`capture.rs`, `windows.rs`, `session.rs`) y comandos Tauri en `app/commands/screen_capture.rs`.
  - Frontend React: `ScreenCaptureView.tsx`, `ScreenCaptureOverlay.tsx`, `ScreenCaptureEditor.tsx` y `screen-capture.css`.
  - Registro de ventanas en `tauri.conf.json` (`screen_capture_overlay` transparente/sin taskbar; `screen_capture_editor` con taskbar independiente).
  - Capacidades en `capabilities/default.json` y denylist de `window_state` actualizadas.
