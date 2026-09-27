# Validación: Inclusión de libunwind.dll en el Instalador de Prisma

## Evidencias de Validación

### 1. Inspección de Dependencias de Ejecutables
- Mediante `llvm-objdump -p` sobre `prisma.exe` se identificó la dependencia directa de tiempo de ejecución con `libunwind.dll`.
- Las demás DLLs corresponden a APIs nativas de Windows (`kernel32.dll`, `user32.dll`, `shell32.dll`, UCRT) y a bibliotecas ya empaquetadas (`libmpv-2.dll`, `WebView2Loader.dll`).

### 2. Aprovisionamiento y Automatización en Build
- Se integró `src-tauri/vendor/libunwind.dll` (90 KB).
- Se configuró `src-tauri/build.rs` con `configure_libunwind()` para garantizar que cualquier compilación de desarrollo o release en Windows disponga de la DLL en el directorio de salida.
- Comprobación: `Test-Path "src-tauri\target\debug\libunwind.dll"` retornó `True`.

### 3. Empaquetado en el Instalador NSIS
- En `src-tauri/tauri.conf.json`, se añadió `"vendor/libunwind.dll": "./"` dentro de `bundle.resources`.
- Al generar el instalador de producción con Tauri v2, `libunwind.dll` queda empaquetada e instalada junto a `prisma.exe` en cualquier computadora de destino, eliminando el error de sistema.

### 4. Compilación
- **Backend Rust**: `cargo check` completado exitosamente en 12.39s (código 0).
- **Frontend TypeScript/Vite**: `bun run build` completado exitosamente.
