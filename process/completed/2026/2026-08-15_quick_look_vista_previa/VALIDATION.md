# Validación: Prisma Quick Look (Previsualización Rápida con Espacio)

## 1. Criterios de Aceptación

- [x] **Detección de Selección**: Al presionar `Espacio` sobre un archivo de imagen, vídeo o música en el Explorador de Windows o Escritorio, se obtiene la ruta exacta vía COM (`IShellWindows` / `IFolderView`).
- [x] **No interferencia en edición**: Al renombrar un archivo o escribir en una caja de texto (`Edit`, `RichEdit`, etc.), la barra espaciadora no activa la vista previa y se escribe con normalidad.
- [x] **Apertura instantánea**: La ventana flotante `quicklook` se mantiene precargada y responde en milisegundos sin renderizar la app principal completa.
- [x] **Vista Previa de Música**: Tarjeta reducida con carátula cuadrada, título, artista, duración, scrubber de reproducción y paleta adaptativa.
- [x] **Vista Previa de Imagen**: Visualización de imágenes con auto-fit, zoom suave y badge de dimensiones.
- [x] **Vista Previa de Vídeo**: Reproducción fluida y controles esenciales sobrepuestos.
- [x] **Cierre y Liberación**: Al pulsar `Espacio` de nuevo, `Esc` o perder foco, la ventana se oculta y la reproducción se detiene (consumo 0%).
- [x] **Abrir en Prisma**: Al pulsar *"Abrir en Prisma"*, la ventana principal `main` se restaura y carga el medio automáticamente.
- [x] **Calidad de Código**: TypeScript compila sin errores (`bun run build`) y Rust supera el 100% de pruebas unitarias (`cargo test` -> 17 pruebas pasadas).

---

## 2. Registro de Pruebas y Evidencia

- **TypeScript / Bundle**: `bun run build` completado exitosamente en 983ms. Cero errores de tipos.
- **Rust Compiler & Check**: `cargo check --features mpv` completado con éxito sin errores.
- **Rust Test Suite**: `cargo test --features mpv` ejecutó 17 pruebas unitarias exitosas (incluyendo `test_media_type_detection` y `test_format_file_size`).
- **Navegación Dinámica**: Handlers de eventos de flechas (`TriggerEvent::Navigation`) y actualización reactiva sin parpadeo validados.
