# Tareas: Inferencia y Escalado Neuronal en Segundo Plano

- [x] **Fase 1: Backend Rust (Comando `upscale_image_native`)**
  - [x] Implementar resolución del motor local Vulkan (`find_prisma_upscaler_engine`) buscando en AppData, ProgramFiles y árbol de proyectos.
  - [x] Implementar comando `check_prisma_upscaler_engine` para notificar al frontend sobre la disponibilidad de la GPU / motor NCNN.
  - [x] Implementar comando `upscale_image_native` con `CREATE_NO_WINDOW`, reintentos de tiling (64 y 32) y downscale Lanczos3 para escalas 2x/3x.
  - [x] Registrar comandos en `src-tauri/src/lib.rs`.

- [x] **Fase 2: Frontend & Separación Modular de Estilos**
  - [x] Extraer estilos de `ModelSelectModal` a `model-select-modal.css` para mantener `prisma-upscaler.css` bajo 1050 líneas.
  - [x] Añadir estados de procesamiento nativo en `PrismaUpscalerView.tsx` (`isProcessing`, `processingTime`, `lastResult`, `hasNativeEngine`).
  - [x] Integrar `UpscaleComparisonSlider.tsx` para visualización antes/después con slider interactivo.
  - [x] Añadir acciones post-escalado: «Ver archivo», «Volver a Escalar» y «App Desktop».

- [x] **Fase 3: Verificación y Compilación**
  - [x] Validar backend Rust con `cargo check` (0 errores, 0 advertencias).
  - [x] Validar frontend con `bun run build` (`tsc --noEmit && vite build`).
  - [x] Verificar que la inferencia no abre ventanas de consola ni aplicaciones externas.
