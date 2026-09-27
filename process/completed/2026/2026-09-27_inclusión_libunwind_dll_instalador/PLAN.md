# Plan: Inclusión de libunwind.dll en el Instalador de Prisma (Distribución Portátil/Universal)

## Contexto y Diagnóstico
Al intentar ejecutar o instalar Prisma en una computadora distinta a la del desarrollador, Windows lanzaba el siguiente error de sistema:
> *"prisma.exe - Error del sistema: La ejecución de código no puede continuar porque no se encontró libunwind.dll. Este problema se puede solucionar reinstalando el programa."*

### Causa Raíz
1. La compilación nativa en este entorno utiliza la arquitectura de Rust `x86_64-pc-windows-gnullvm` (LLVM-MinGW).
2. Los ejecutables compilados con dicho target dependen del runtime de desenrollado de pila de LLVM: `libunwind.dll`.
3. En la máquina de desarrollo de Biglex, `libunwind.dll` se encuentra presente en el `PATH` dentro del toolchain de Rustup (`.rustup/toolchains/stable-x86_64-pc-windows-gnullvm/bin/libunwind.dll`), por lo que Prisma se ejecuta sin problemas.
4. En computadoras de usuarios finales o sistemas limpios sin toolchain de Rust ni LLVM instalado, `libunwind.dll` no existe a nivel de sistema. Como Tauri no incluía `libunwind.dll` en los recursos del instalador, `prisma.exe` no podía arrancar.

## Objetivos
1. Incorporar la biblioteca oficial `libunwind.dll` (90 KB) dentro de `src-tauri/vendor/libunwind.dll`.
2. Registrar `"vendor/libunwind.dll": "./"` en la sección `bundle.resources` de `src-tauri/tauri.conf.json`, garantizando que el instalador NSIS lo instale automáticamente en el directorio raíz junto a `prisma.exe`.
3. Actualizar `src-tauri/build.rs` con `configure_libunwind()` para copiar automáticamente `libunwind.dll` al directorio de salida de Cargo (`target/debug` y `target/release`), asegurando el funcionamiento directo tanto en desarrollo como en producción.
4. Validar compilación con `cargo check` y `bun run build`.
