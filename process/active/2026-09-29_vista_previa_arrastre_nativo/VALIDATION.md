# Validación

- `bun run build`: correcto tras la corrección; TypeScript y Vite compilaron el frontend.
- `bun run check`: correcto tras los últimos cambios.
- `bun test test/nativeDragPreview.test.ts`: 4 pruebas correctas. Cubren reconocimiento de medios, selección de formato cuadrado/16:9/9:16, dibujo completo de las tres proporciones y recuperación cuando el WebView bloquea la lectura del lienzo.
- `git diff --check`: correcto.
- En Prisma de desarrollo se inició el arrastre de una tarjeta de imagen sin cerrar la aplicación. Al soltarla dentro de la propia ventana apareció un error de lectura de carpeta; se añadió una protección para esa ruta. La sesión visual se interrumpió por actividad del usuario antes de repetir la prueba con la protección.
- Biglex confirmó que el archivo se puede soltar, pero el arrastre todavía no mostraba la miniatura de imagen o vídeo. Se corrigió el bitmap entregado a Windows: DIB de 32 bits con alfa directo, posición centrada y aviso de error de inicialización en la terminal de desarrollo.
- Biglex confirmó después que la miniatura sí llegó a mostrarse una vez y luego desapareció. La terminal de desarrollo muestra reinicios repetidos provocados por archivos temporales de `cargo check` dentro de `src-tauri/vendor/drag/target`. Se trasladaron a `temp/drag-check-target`; el último reinicio terminó correctamente. Para nuevas comprobaciones aisladas, establecer `CARGO_TARGET_DIR` fuera de `src-tauri` antes de ejecutar Cargo.
- Hay dos procesos de Prisma abiertos: la versión instalada y la de desarrollo. La prueba de esta función corresponde a `target/debug/prisma.exe`.
- `cargo check --offline --manifest-path src-tauri/vendor/drag/Cargo.toml`: correcto. Compila la adaptación nativa aislada sin abrir una segunda instancia de Prisma.
- Pendiente: observar en Windows el arrastre actualizado de imagen, música y vídeo. La compilación no prueba que el sistema muestre la vista previa.
