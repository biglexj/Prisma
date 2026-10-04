# Integración de Motores Multi-Vendor en Prisma Upscaler — Plan

- Estado: `EN CURSO`
- Fecha: `2026-10-04`
- Proyecto: `Prisma`
- Solicitud: Petición directa de Biglex (audio 2026-10-04) — Adaptar las nuevas herramientas implementadas en `prisma-upscaler` (AMD FSR 1, NVIDIA NIS, RTX Video y DLSS NR).

## Objetivo

Actualizar la suite integrada de Prisma Upscaler en Prisma para incorporar los nuevos motores multi-vendor implementados en `prisma-upscaler`:
1. **AMD FidelityFX FSR 1 (`fsr1`)**: Escalado de bordes EASU y enfoque RCAS acelerado por GPU (Vulkan/DirectX 12), compatible con AMD, NVIDIA e Intel, sin requerir modelos descargables de IA.
2. **NVIDIA Image Scaling (`nis`)**: Escalado espacial de alta velocidad con shaders integrados, compatible con NVIDIA, AMD e Intel.
3. **RTX Video Super Resolution (`rtx-video`)**: Escalado acelerado por IA en GPUs NVIDIA RTX vía Visual Enhancer CLI.
4. **DLSS Neural Rendering (`dlss-nr`)**: Enfoque y reconstrucción neural (escala 1x) vía Visual Enhancer CLI en GPUs NVIDIA RTX.
5. Preservar la compatibilidad total con la ruta de inferencia neuronal NCNN (`realesrgan-x4plus-anime`, `realesrgan-x4plus`, `ultrasharp`, `remacri`, `ultramix_balanced`, etc.).

## Alcance

- **Frontend**:
  - `src/features/prisma_upscaler/ui/ModelSelectModal.tsx`:
    - Incorporar los nuevos motores `nis`, `fsr1`, `rtx-video`, `dlss-nr` con sus respectivas categorías, insignias y arquitectura.
    - Soporte para escala 1x en motores que lo admiten (`nis`, `fsr1`, `dlss-nr`).
    - Iconografía y etiquetas enriquecidas con el estándar Material 3 Expressive.
  - `src/features/prisma_upscaler/ui/PrismaUpscalerView.tsx`:
    - Actualizar la lista `MODELS` con los motores `nis`, `fsr1`, `dlss-nr`, `rtx-video`.
    - Adaptar el selector de escalas para mostrar escala 1x cuando el motor seleccionado la soporte.
    - Detección de disponibilidad amplia (si se detectan adaptadores espaciales o Visual Enhancer, permitir la ejecución incluso si faltan los modelos pesados de NCNN).
- **Backend (Rust / Tauri v2)**:
  - `src-tauri/src/app/commands/synapse.rs`:
    - Actualizar `check_prisma_upscaler_engine` para verificar no solo NCNN sino también la disponibilidad de motores espaciales o la CLI de `prisma-upscaler`.
    - Actualizar `upscale_image_native` para soportar `nis`, `fsr1`, `dlss-nr` y `rtx-video`:
      - Ejecución vía motor de `prisma-upscaler` (CLI `--local --engine ...` o biblioteca nativa) con control de salida, escala y nitidez (0.5).
      - Mantenimiento intacto de la ruta NCNN con mosaicos adaptativos (tiling 64/32) para los modelos neuronales.
- **Validación y compilación**:
  - Verificación estricta de compilación en frontend (`bun run check`) y backend Rust (`cargo check`).

## Criterios de Éxito

- [ ] Los motores `fsr1`, `nis`, `rtx-video` y `dlss-nr` figuran en el selector de modelos y en la vista principal de Prisma Upscaler.
- [ ] La escala 1x está disponible y es seleccionable cuando el motor activo lo permite.
- [ ] `upscale_image_native` enruta correctamente según el motor seleccionado (`fsr1`, `nis`, `dlss-nr`, `rtx-video` o modelos neuronales NCNN).
- [ ] Compilación frontend y backend sin advertencias críticas ni errores.
