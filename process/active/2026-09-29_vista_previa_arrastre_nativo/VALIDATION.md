# Validación

- `bun run build`: correcto; TypeScript y Vite compilaron el frontend.
- `bun run check`: correcto tras los últimos cambios.
- `bun test test/nativeDragPreview.test.ts`: 3 pruebas correctas. Cubren reconocimiento de imagen/vídeo/música, conversión de miniatura cargada a PNG de 152 × 152 y recuperación cuando el WebView bloquea la lectura del lienzo.
- `git diff --check`: correcto.
- En Prisma de desarrollo se inició el arrastre de una tarjeta de imagen sin cerrar la aplicación. Al soltarla dentro de la propia ventana apareció un error de lectura de carpeta; se añadió una protección para esa ruta. La sesión visual se interrumpió por actividad del usuario antes de repetir la prueba con la protección.
- Pendiente: observar el cursor de arrastre en Windows y soltar una imagen, canción y vídeo en otra aplicación. La compilación no prueba la apariencia de OLE ni la aceptación del archivo por destino.
