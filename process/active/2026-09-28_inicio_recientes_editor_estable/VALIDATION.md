# Validación

- [x] `cargo check --manifest-path src-tauri/Cargo.toml --no-default-features --features mpv`: correcto tras el cambio de configuración de DLL.
- [x] Prisma de desarrollo volvió a compilar y se observó `src-tauri/target/debug/prisma.exe` ejecutándose después de los cambios del escáner Rust.
- [x] `bun run check`: TypeScript sin errores.
- [x] `bun run build`: Vite completó el empaquetado; conserva la advertencia existente de tamaño de chunk.
- [x] Comprobación geométrica de marca de agua en lienzo de 1000 × 600: esquina inferior derecha a 1 % de ambos bordes y superior izquierda a 1 %.
- [x] `bun test test/watermarkLayout.test.ts`: seis pruebas de escala independiente, cinco disposiciones y margen del 1 %.
- [x] `bun run build`: TypeScript y Vite correctos tras los controles de logotipo; persiste la advertencia existente sobre el tamaño de los chunks.
- [x] `bun test test/watermarkLayout.test.ts`: ocho pruebas tras añadir contorno y colores; incluye silueta de logo transparente.
- [x] `bun run build`: TypeScript y Vite correctos con el diálogo de dos columnas y los controles del conversor; persiste la advertencia de tamaño de chunks.
- [x] Tras desactivar sombra y contorno por defecto: `bun run check` correcto y ocho pruebas de marca de agua correctas.
- [x] `bun test test/cropGeometry.test.ts test/watermarkLayout.test.ts`: 15 pruebas correctas; cinco relaciones fijas llenan el eje limitante y las coordenadas y el grosor del pincel se transforman al recorte.
- [x] `bun run build`: TypeScript y Vite correctos tras conservar la vista previa en Dibujar; persiste la advertencia existente sobre el tamaño de chunks.
- [x] `git diff --check`: sin errores de espacios.
- [x] `bun test test/saveImageFormat.test.ts`: dos pruebas correctas de formato inicial, extensión, MIME y bloqueo de sobrescritura incompatible.
- [x] `bun run build`: TypeScript y Vite correctos tras el selector de formato y la selección del nombre; persiste la advertencia existente sobre el tamaño de los chunks.
- [x] `bun run build`: TypeScript y Vite correctos tras impedir volumen y avisos de audio sobre el visor de imágenes; persiste la advertencia existente sobre el tamaño de los chunks.
- [ ] Comprobar en Prisma de desarrollo que `↑`, `↓`, `+` y `−` no muestran volumen al ver una foto, y que el volumen sigue disponible en las vistas de audio.
- [ ] Probar visualmente el selector y guardar una copia en PNG, JPEG y WebP desde Prisma de desarrollo; comprobar que cada archivo abre correctamente y conserva la extensión elegida.
- [ ] Probar el arrastre desde cada tipo de tarjeta de Inicio a una aplicación externa.
- [ ] Probar Enter, regreso a edición y guardado de un recorte.
- [ ] Probar en la aplicación el cambio de relación, la vista previa al entrar en Dibujar y el grosor y ubicación del trazo exportado.
- [ ] Probar trazos continuos y puntos aislados, antes y después del recorte.
- [ ] Probar marca de agua con texto, fecha y logo; arrastrar y exportar en varias proporciones de imagen.
- [ ] Soltar un logotipo desde el Explorador en el recuadro del diálogo y comprobar que el archivo se acepta solo allí.
- [ ] Comprobar el diálogo sin scroll en una ventana de escritorio y revisar el respaldo en ventanas pequeñas.
- [ ] Comparar vista previa y exportación con contorno y colores personalizados.

La observación de una ventana ejecutándose y la compilación no prueban por sí solas las interacciones manuales ni la salida visual exportada.
