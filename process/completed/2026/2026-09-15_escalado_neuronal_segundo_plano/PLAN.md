# Plan: Inferencia y Escalado Neuronal Nativo en Segundo Plano (Prisma ↔ Prisma Upscaler)

## Objetivo
Implementar la capacidad de procesar super-resolución neuronal con IA directamente en segundo plano desde Prisma (Zero-GUI), utilizando el motor Vulkan local (`realesrgan-ncnn-vulkan.exe`) ya instalado en el equipo sin necesidad de abrir ni depender de la ventana gráfica de Prisma Upscaler.

## Arquitectura y Flujo

1. **Detección del Motor Local**:
   - Buscar `realesrgan-ncnn-vulkan.exe` en las ubicaciones canónicas del ecosistema:
     - `%LOCALAPPDATA%\PrismaUpscaler\engine\`
     - `D:\Proyectos\biglexj\prisma-upscaler\desktop\src-tauri\engine\`
     - `D:\Proyectos\biglexj\prisma-upscaler\release\engine\`
     - Carpeta de instalación estándar en `ProgramFiles`
   - Si no se encuentra, notificar elegantemente y mantener la opción de abrir la App Desktop o descargar el instalador.

2. **Comando Backend Rust (`upscale_image_native`)**:
   - Ubicación: `src-tauri/src/app/commands/synapse.rs` (o nuevo módulo modular dedicado).
   - Invocación con `CREATE_NO_WINDOW` (0x08000000).
   - Parámetros adaptativos:
     - Tiling anti-OOM para GPUs dedicadas e integradas (NVIDIA / AMD Radeon / Intel).
     - Modelos soportados: `realesrgan-x4plus-anime`, `realesrgan-x4plus`, `ultrasharp`, `remacri`, `ultramix_balanced`, `siax_anime`, `realesr-animevideov3-x4`, `2x-animesharpv4`.
     - Soporte de escala 2x, 3x, 4x (con downscale Lanczos3 de alta precisión para escalas intermedias cuando el motor opera en 4x).
   - Retorno: `{ output_path: String, duration_secs: f64 }`.

3. **Interfaz de Usuario Frontend (`PrismaUpscalerView.tsx`)**:
   - El Paso 4 pasa a ser una acción integrada:
     - Botón principal: **«Escalar Imagen (2x/3x/4x)»** con icono `sparkles`.
     - Estado de procesamiento con spinner / animación y tiempo transcurrido.
     - Al finalizar con éxito:
       - Notificación flotante de éxito con tiempo de ejecución.
       - Acciones directas sobre la imagen procesada:
         - **«Comparar Antes / Después»** (abre el Comparador de Imágenes de Prisma cargando la original en Ranura A y la escalada en Ranura B).
         - **«Abrir en Carpeta»** (muestra el archivo en el Explorador de Windows).
   - El botón del encabezado **«Abrir App Desktop»** se mantiene disponible como alternativa para uso avanzado de la GUI externa.
