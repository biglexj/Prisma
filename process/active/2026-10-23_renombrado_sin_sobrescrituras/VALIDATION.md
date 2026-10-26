# Validación

- [x] `bun run build`: TypeScript y Vite correctos; aviso de tamaño de chunks.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml --lib app::commands::renamer -- --nocapture`: 16 pruebas aprobadas. Incluyen movimientos reales de Windows sin reemplazo, conflictos externos y entre destinos, intercambio de nombres, cambio de mayúsculas, carpetas, fallos inyectados de preparación/finalización/restauración e historial conservado tras fallos. Se añade enumeración de nombres fuera de la selección y renombrado/deshacer de 20 imágenes con 07–14 protegidos y verificación SHA-256.
- [ ] Prueba manual en la app instalada actualizada.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml --lib`: correcto, incluida la lectura de Shift en eventos OLE.
- [x] `bun test tests/renamer-source-selection.test.ts`: 7 pruebas aprobadas; orden de tres tandas, sustitución sin Shift, rutas duplicadas, conservación de exclusiones, recarga en orden, continuación desde 11, serialización de cargas y notificaciones duplicadas.
- [x] `bun test tests/renamer-skip-occupied.test.ts tests/renamer-source-selection.test.ts`: 17 pruebas aprobadas. Diez casos del salto automático incluyen el ejemplo 01–06, 15–28, contador independiente, transformación posterior de extensión/nombre, inicio e incremento personalizados, mayúsculas, carpetas, exclusiones, nombres propios sin cambios y salida acotada cuando otra regla elimina el contador.
- [ ] Comprobar en la interfaz nativa la nueva numeración automática con archivos de prueba. Las comprobaciones automatizadas cubren el cálculo y las operaciones de disco; no constituyen una prueba del flujo completo de WebView a sistema de archivos.
- [ ] Gesto físico Shift + arrastrar desde el Explorador en una instalación actualizada, incluida pulsación/liberación de Shift durante el arrastre.

Las pruebas de archivos usan exclusivamente carpetas temporales sintéticas y comparan contenidos. El caso 10+5 compara SHA-256 de los 15 archivos antes y después. No se han manipulado imágenes del usuario ni actualizado la instalación.
