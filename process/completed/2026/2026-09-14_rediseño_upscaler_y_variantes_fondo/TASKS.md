# Proceso: Rediseño de Prisma Upscaler y Variantes de Color de Fondo — Tareas

- Estado: `COMPLETED`
- Proceso: `2026-09-14_rediseño_upscaler_y_variantes_fondo`

## Tareas

- [x] **Fase 1: Variantes de Color de Fondo (Background Variants)**
  - [x] Extender `useTheme.ts` con tipo `BackgroundVariantId` ("prisma", "neutral", "miku"), persistencia en `localStorage` y atributo `data-bg`.
  - [x] Implementar variables CSS para `[data-bg="neutral"]` y `[data-bg="miku"]` en `src/app/styles.css`.
  - [x] Añadir interfaz selectora de Variante de Fondo en `src/app/ui/AppSettings.tsx` (Apariencia).
  - [x] Conectar `useTheme()` en `App.tsx` para suministrar las propiedades a `AppSettings`.

- [x] **Fase 2: Rediseño de la Suite Prisma Upscaler**
  - [x] Crear componente `src/features/prisma_upscaler/ui/ModelSelectModal.tsx` adaptado a la iconografía y diseño de Prisma.
  - [x] Rediseñar `src/features/prisma_upscaler/ui/PrismaUpscalerView.tsx` adoptando el selector compacto estilo botón + modal, selector de escala y DropZone interactiva con preview.
  - [x] Actualizar estilos en `src/features/prisma_upscaler/ui/prisma-upscaler.css`.

- [x] **Fase 3: Verificación y Cierre Inicial**
  - [x] Verificar compilación con `bun run build`.
  - [x] Registrar evidencias en `VALIDATION.md` y aprobar en `APPROVAL.md`.
  - [x] Crear checkpoint commit en la rama `preview`.

- [x] **Fase 4: Depuración Arquitectónica y Ajuste de Layout en Prisma Upscaler**
  - [x] Eliminar tarjetas inferiores de servidor remoto ("Inferencia en GPU Desacoplada", "Semáforo Concurrente Unitario", "Sinergia Ecosistema Aurora") y la barra daemon de Axum/NCNN (`http://localhost:8085`), reflejando la arquitectura de aplicación de escritorio local.
  - [x] Simplificar subtítulos y etiquetas (concisión directa sin sobre-explicaciones técnicas).
  - [x] Eliminar el espacio en blanco inferior bajo el Paso 4 configurando `.upscaler-main-layout` con `align-items: stretch; flex: 1; min-height: 0;` y anclando la tarjeta de acción con `margin-top: auto;`.
  - [x] Permitir que la Dropzone y la vista previa de imagen se expandan verticalmente al 100% de la altura disponible.
  - [x] Eliminar estilos CSS obsoletos en `prisma-upscaler.css` reduciendo el archivo de 1210 a 1074 líneas (bajo la regla estricta de deuda técnica).
  - [x] Verificar compilación con `bun run build`.

- [x] **Fase 5: Generalización de Nomenclatura en Variante Azul Oscuro**
  - [x] Renombrar variante "Miku Code" a "Azul Oscuro" de forma general en `src/app/useTheme.ts`.
  - [x] Actualizar badge a "Nocturno" y descripción a "Azul profundo nocturno", preservando el color exacto `#16161e`.
  - [x] Soportar `dark_blue` en `BackgroundVariantId`, `localStorage` y selectores CSS en `src/app/styles.css`, manteniendo retrocompatibilidad transparente.
  - [x] Verificar compilación con `bun run build`.

- [x] **Fase 6: Icono de Expansión para Upscaler y Reorganización Ergonómica de Apariencia**
  - [x] Añadir icono SVG `expand` (4 flechas diagonales en expansión ↖ ↗ ↘ ↙) en `src/shared/ui/Icon.tsx`.
  - [x] Actualizar icono de `prisma_upscaler` en `AppSidebar.tsx` y `ToolsSettingsPanel.tsx` a `expand`, eliminando la duplicación visual de `sparkles` con Wallpapers Aurora.
  - [x] Reubicar "Tema reactivo a la música en reproducción" directamente debajo de "Color de Énfasis Principal" en `AppSettings.tsx`.
  - [x] Hacer reactivas las previsualizaciones de modo "Oscuro" y "Automático" según la variante de fondo activa (`backgroundVariant`) tanto mediante inline styles dinámicos como selectores CSS de `app-settings.css`.
  - [x] Verificar compilación con `bun run build`.

- [x] **Fase 7: Separación Visual en Duplicados y Previews Neuronales en Upscaler**
  - [x] Reestructurar `DuplicatesScannerModal.tsx` separando `.duplicates-controls-card` (alcance, carpetas, barra de herramientas) y `.duplicates-results-panel` (encabezado de resultados y scroll de pares/grupos), siguiendo el patrón ergonómico de Renombrador por Lotes.
  - [x] Tokenizar `duplicates-scanner.css` reemplazando fondos monolíticos fijos por contenedores modulares con bordes redondeados (`border-radius: 14px`), `var(--surface-container-low)` y bordes `var(--outline-variant)`.
  - [x] Mapear los 5 assets de previsualización WebP en `ModelSelectModal.tsx` (`realesrgan-x4plus-anime`, `realesrgan-x4plus`, `ultrasharp`, `remacri`, `ultramix_balanced`).
  - [x] Implementar contenedor comparativo 32:9 `.upscaler-model-comparativa-wrapper` con insignias flotantes "Antes (Original)" y "Después (Super-Resolución 4x)" centradas por divisor ⚡ en `prisma-upscaler.css`.
  - [x] Añadir modelo `UltraMix Balanced` a la lista `MODELS` en `PrismaUpscalerView.tsx`.
  - [x] Verificar compilación completa con `bun run build`.

