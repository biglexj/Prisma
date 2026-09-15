# Plan: Escalado e Inferencia Neuronal en Segundo Plano (Vulkan NCNN)

## Contexto y Diagnóstico
En la sección **Prisma Upscaler**, la acción de escalado enviaba la imagen y abría obligatoriamente la aplicación de escritorio externa `PrismaUpscaler.exe`. El usuario solicitó que Prisma procese y escale directamente en segundo plano utilizando el motor CLI de super-resolución local (`realesrgan-ncnn-vulkan.exe`), sin abrir ventanas externas ni interrumpir el flujo de trabajo del usuario.

## Objetivos
1. Ejecución nativa y silenciosa en segundo plano utilizando el binario local `realesrgan-ncnn-vulkan.exe` con flag `CREATE_NO_WINDOW` (0x08000000).
2. Detección automática del motor en múltiples ubicaciones (`%LOCALAPPDATA%\PrismaUpscaler\engine`, monorepo adyacente, y carpeta de ejecución).
3. Redimensionamiento Lanczos3 para escalas 2x y 3x mediante el crate `image` para compatibilidad universal con modelos 4x.
4. Soporte anti-OOM con tiling adaptativo (64 -> 32) para estabilidad en GPUs integradas (AMD Radeon 780M / Intel Iris) y dedicadas (NVIDIA RTX / AMD Radeon).
5. Interfaz de usuario con cronómetro en vivo, indicador de estado de GPU Vulkan, y visualizador interactivo de comparación de pantalla dividida (Antes / Después).
6. Conservar el botón de apertura de la App Desktop en la cabecera como acción secundaria opcional.
