# Soporte Universal de Arrastre de Carpetas en Herramientas — Plan

- Estado: `DRAFT`
- Fecha: `2026-09-13`
- Proyecto: `Prisma`

## Objetivo

Permitir el arrastre y soltado (*drag & drop*) fluido y confiable de carpetas completas desde el Explorador de Windows hacia todas las herramientas de Prisma (Renombrador por Lotes, Conversor Multimedia y Buscador de Duplicados), eliminando las incompatibilidades de WebView2 y detectando automáticamente los contenidos multimedia.

## Alcance

- Incluye:
  - **Renombrador**: Carga inmediata de la carpeta arrastrada, escaneando sus archivos y mostrando el overlay visual reactivo. Soporte también al soltar un archivo para cargar su carpeta contenedora.
  - **Conversor**: Escaneo recursivo de la carpeta arrastrada, auto-detección del tipo de medio predominante (audio, vídeo o imagen) si la cola está vacía, y adición automática de todos los archivos compatibles a la cola de conversión.
  - **Duplicados**: Asignación directa de la carpeta arrastrada como carpeta única o como carpeta base/depuración en el comparador de duplicados.
  - **Arquitectura Drag & Drop**: Eliminación del bloqueo de cursor 🚫 en Windows WebView2 mediante escucha global continua de `dragover`, y reemplazo de lecturas fallidas de `e.dataTransfer.files` por eventos nativos de Tauri v2 (`tauri://drag-drop` y `onDragDropEvent`).
- No incluye:
  - Modificación de la lógica interna de transcodificación FFmpeg o motor de renombres.

## Enfoque

1. Diagnosticar y resolver el bloqueo del cursor en WebView2 manteniendo activo `dragover` con `e.preventDefault()` en toda la aplicación.
2. Unificar la captura de rutas nativas en Tauri v2 para carpetas evitando el acceso a `File.path` del DOM (inexistente en WebView2).
3. Conectar la recepción de carpetas en el Renombrador (`useRenamer.ts`) para escanear y listar los elementos.
4. Adaptar el Conversor (`useMediaConverter.ts` y backend Rust) para auto-detectar el tipo de contenido al arrastrar una carpeta y agregar los archivos a la cola.
5. Adaptar Duplicados (`DuplicatesScannerModal.tsx`) para asignar las carpetas arrastradas a las zonas de escaneo.
6. Verificar en modo desarrollo (`bun run tauri:dev`) y validar con pruebas automatizadas (`bun run check`, `cargo test`).

## Criterios de finalización

- [ ] Arrastrar una carpeta al Renombrador carga la carpeta y lista sus archivos de inmediato.
- [ ] Arrastrar una carpeta al Conversor detecta los archivos compatibles y los añade a la cola de conversión.
- [ ] Arrastrar una carpeta a Duplicados la asigna correctamente a la zona correspondiente.
- [ ] El cursor de Windows Explorer muestra el indicador de copia/adición (+) en lugar del icono de prohibición (🚫).
- [ ] Chequeos de tipos (`bun run check`) y compilación limpios sin regresiones.

## Autorización

- [ ] Plan aprobado para ejecución.
