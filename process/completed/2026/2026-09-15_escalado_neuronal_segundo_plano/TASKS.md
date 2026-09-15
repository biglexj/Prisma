# Tareas: Inferencia y Escalado Neuronal en Segundo Plano

- [x] **Fase 1: Backend Rust (Comando `upscale_image_native`)**
  - [x] Implementar función para resolver la ruta del motor Vulkan (`realesrgan-ncnn-vulkan.exe`) y su carpeta de modelos.
  - [x] Implementar comando `upscale_image_native` con ejecución silenciosa en segundo plano, soporte de tiling adaptativo y downscale Lanczos3 para escalas menores.
  - [x] Registrar el comando en `src-tauri/src/lib.rs`.

- [x] **Fase 2: Frontend (Integración en `PrismaUpscalerView.tsx`)**
  - [x] Agregar estados de procesamiento (`isProcessing`, `elapsedSeconds`, `lastResult`).
  - [x] Conectar la ejecución nativa en segundo plano al botón principal de Paso 4.
  - [x] Mostrar indicador de carga e información de progreso con Material 3 Expressive.
  - [x] Incorporar botones de acción pos-escalado: «Comparar Antes / Después» y «Abrir en Carpeta».

- [x] **Fase 3: Verificación y Estilos**
  - [x] Validar compilación con `tsc --noEmit && vite build`.
  - [x] Probar inferencia local y verificar que no abre la ventana externa de Prisma Upscaler.
  - [x] Documentar en notas de versión y resguardo en Git.
