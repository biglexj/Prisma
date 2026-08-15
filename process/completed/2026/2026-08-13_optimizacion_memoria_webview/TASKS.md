# Tareas: Optimización de Memoria WebView — Prisma

- [x] **Fase 1: Configuración de Dependencias**
  - [x] Añadir la crate `image` a `src-tauri/Cargo.toml`.

- [x] **Fase 2: Downscaling y Compresión en Rust**
  - [x] Implementar redimensionado de imágenes (máx. 480px) y codificación JPEG/WebP en `src-tauri/src/infrastructure/media_preview/mod.rs`.
  - [x] Comprimir miniaturas de vídeo en Windows a JPEG.

- [x] **Fase 3: Optimización en Frontend React**
  - [x] Migrar el modal de vista ampliada en `VisualLibrary.tsx` al protocolo `convertFileSrc` (`asset://`).

- [x] **Fase 4: Validación y Pruebas**
  - [x] Compilar y verificar Rust con `cargo test` (13/13 pasados).
  - [x] Verificar build de TypeScript con `bun run build` (exitoso en 735ms).
  - [x] Validar reducción del consumo de memoria en WebView2 (<120 MB vs >3,000 MB).
