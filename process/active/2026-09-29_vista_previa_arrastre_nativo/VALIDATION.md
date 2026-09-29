# Validación

- `bun run build`: correcto tras la corrección; TypeScript y Vite compilaron el frontend.
- `bun run check`: correcto tras los últimos cambios.
- `bun test test/nativeDragPreview.test.ts`: 3 pruebas correctas. Cubren reconocimiento de imagen/vídeo/música, conversión de miniatura cargada a PNG de 176 × 176 y recuperación cuando el WebView bloquea la lectura del lienzo.
- `git diff --check`: correcto.
- En Prisma de desarrollo se inició el arrastre de una tarjeta de imagen sin cerrar la aplicación. Al soltarla dentro de la propia ventana apareció un error de lectura de carpeta; se añadió una protección para esa ruta. La sesión visual se interrumpió por actividad del usuario antes de repetir la prueba con la protección.
- Biglex confirmó que el archivo se puede soltar, pero el arrastre todavía no mostraba la miniatura de imagen o vídeo. Se corrigió el bitmap entregado a Windows: DIB de 32 bits con alfa directo, posición centrada y aviso de error de inicialización en la terminal de desarrollo.
- `cargo check --offline --manifest-path src-tauri/vendor/drag/Cargo.toml`: correcto. Compila la adaptación nativa aislada sin abrir una segunda instancia de Prisma.
- Pendiente: observar en Windows el arrastre actualizado de imagen, música y vídeo. La compilación no prueba que el sistema muestre la vista previa.
