# Plan de Optimización de Memoria en WebView — Prisma

## 📌 Contexto y Diagnóstico del Problema

El objetivo fundamental de Prisma es ofrecer una experiencia multimedia ligera y de ultra-bajo consumo de recursos en escritorio. Sin embargo, durante el renderizado de galerías visuales (imágenes y miniaturas), el consumo de memoria del proceso Edge WebView2 se dispara a más de **3 GIGABYTES de RAM**.

### Causas Raíz Identificadas

1. **Serialización Base64 de Imágenes Originales sin Redimensionado (Rust Backend)**:
   - En `src-tauri/src/infrastructure/media_preview/mod.rs`, la función `load_image_data_url` lee directamente archivos de imagen completos (de hasta 120 MB cada uno), los convierte íntegros a cadenas `data:image/...;base64,...` y los transmite mediante IPC a JavaScript.
   - Al renderizar un elemento `<img src={dataUrl} />`, Chromium/WebView2 decodifica la fotografía en resolución completa (p. ej. 24 MP - 50 MP, 6000x4000) directamente en memoria de textura GPU/RGBA (~50 MB a 100 MB de RAM por foto), **incluso si solo se muestra dentro de una tarjeta de miniatura de 200px**.
   - Con 30 o 40 fotos en la pantalla, el consumo alcanza de 3 a 4 GB de RAM.

2. **Uso de Data URLs en lugar del Protocolo Nativo `asset://` para Vista Completa**:
   - Al hacer clic en una foto para verla ampliada en `VisualLibrary.tsx`, el visor volvía a pedir la vista previa en Base64 en lugar de aprovechar el protocolo streaming nativo `convertFileSrc` (`asset://`) de Tauri v2.

3. **Miniaturas de Video Sin Compresión en Windows**:
   - La API de Windows genera un `HBITMAP` de 320x200 que se serializaba como un archivo `BMP` de 32 bits en bruto sin compresión ni downscaling.

---

## 🎯 Solución Propuesta

### 1. Generación y Redimensionado de Miniaturas Ultra-Ligeras en Rust (`image` crate)
- Incorporar la crate `image` (con soporte optimizado JPEG, PNG, WebP) en `src-tauri/Cargo.toml`.
- En `src-tauri/src/infrastructure/media_preview/mod.rs`:
  - Leer la imagen y redimensionar la miniatura a una dimensión máxima de **480px** (preservando el aspect ratio).
  - Codificar la miniatura redimensionada en formato **JPEG/WebP al 80% de calidad**.
  - **Resultado**: El tamaño de la data URL se reduce de **10–120 MB** a **15–40 KB** por miniatura, y el consumo de RAM en WebView2 por miniatura en la GPU cae de **80 MB** a **~0.6 MB**. ¡Una reducción de más del 99%!

### 2. Uso del Protocolo Nativo `convertFileSrc` (`asset://`) para el Visor Ampliado
- En `VisualLibrary.tsx`, cuando el usuario abre una foto a pantalla completa en el modal `image-viewer`, usar `convertFileSrc(selectedImage.path)` para pedir la imagen original directamente al sistema de archivos mediante streaming local nativo, evitando serializar megabytes a través de IPC JSON.

### 3. Compresión de Miniaturas de Vídeo
- Comprimir la miniatura de vídeo capturada en Windows a JPEG en lugar de BMP sin compresión.

---

## 📋 Pasos de Ejecución

1. Registrar la dependencia `image = { version = "0.25", default-features = false, features = ["jpeg", "png", "webp"] }` en `src-tauri/Cargo.toml`.
2. Refactorizar `load_image_data_url` en `media_preview/mod.rs` para realizar downscaling a 480px máx y compresión JPEG/WebP.
3. Actualizar `VisualLibrary.tsx` para usar `convertFileSrc` en la vista a pantalla completa del visor de imágenes.
4. Compilar y comprobar en Rust (`cargo check`) y TypeScript (`bun run build`).
5. Verificar la reducción drástica de memoria RAM del proceso WebView.
