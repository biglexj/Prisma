# Validación

- La tabla anterior solo ofrecía quitar elementos. Cada resultado ya conserva `outputPath`, `targetFormat` y estado `completed`.
- El comando existente `quick_look_show_file` valida que el archivo exista y construye su vista previa según la extensión real. Sus componentes de audio y vídeo incluyen controles de reproducción y carga automática.
- La acción envía la ruta de salida, incluso en vídeo a audio. El botón se muestra únicamente tras finalizar correctamente y no navega fuera del conversor.
- `bun run build`: TypeScript y Vite correctos, 278 módulos; advertencia preexistente sobre tamaño del bundle.
- `git diff --check`: sin errores de espacios. Revisada la ruta enviada, el estado de finalización y que el botón no se bloquee por la conversión de otros archivos.
- Reproducción real y aceptación visual pendientes.
