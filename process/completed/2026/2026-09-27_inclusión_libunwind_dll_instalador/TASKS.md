# Tareas: Inclusión de libunwind.dll en el Instalador de Prisma

- [x] Copiar la DLL oficial `libunwind.dll` del toolchain de Rust gnullvm a `src-tauri/vendor/libunwind.dll`.
- [x] Registrar `"vendor/libunwind.dll": "./"` en `resources` de `src-tauri/tauri.conf.json`.
- [x] Implementar `configure_libunwind()` en `src-tauri/build.rs` para copiar automáticamente `libunwind.dll` al directorio de compilación de Cargo (`target/debug` y `target/release`).
- [x] Verificar que `cargo check` y el build script copian exitosamente `libunwind.dll` a `target/debug`.
- [x] Ejecutar `bun run build` para comprobar integridad del proyecto.
- [x] Registrar evidencias en `VALIDATION.md` y `APPROVAL.md`.
- [x] Mover proceso a `process/completed/2026/` y registrar commit de resguardo.
