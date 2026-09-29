# Validación

- [x] `cargo check --manifest-path src-tauri/Cargo.toml --no-default-features --features mpv`: correcto tras el cambio de configuración de DLL.
- [x] Prisma de desarrollo volvió a compilar y se observó `src-tauri/target/debug/prisma.exe` ejecutándose después de los cambios del escáner Rust.
- [x] `bun run check`: TypeScript sin errores.
- [x] `bun run build`: Vite completó el empaquetado; conserva la advertencia existente de tamaño de chunk.
- [x] Comprobación geométrica de marca de agua en lienzo de 1000 × 600: esquina inferior derecha a 1 % de ambos bordes y superior izquierda a 1 %.
- [x] `bun test test/watermarkLayout.test.ts`: seis pruebas de escala independiente, cinco disposiciones y margen del 1 %.
- [x] `bun run build`: TypeScript y Vite correctos tras los controles de logotipo; persiste la advertencia existente sobre el tamaño de los chunks.
- [x] `git diff --check`: sin errores de espacios.
- [ ] Probar el arrastre desde cada tipo de tarjeta de Inicio a una aplicación externa.
- [ ] Probar Enter, regreso a edición y guardado de un recorte.
- [ ] Probar trazos continuos y puntos aislados, antes y después del recorte.
- [ ] Probar marca de agua con texto, fecha y logo; arrastrar y exportar en varias proporciones de imagen.

La observación de una ventana ejecutándose y la compilación no prueban por sí solas las interacciones manuales ni la salida visual exportada.
