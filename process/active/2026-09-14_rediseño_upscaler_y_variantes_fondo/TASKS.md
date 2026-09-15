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

- [x] **Fase 3: Verificación y Cierre**
  - [x] Verificar compilación con `bun run build`.
  - [x] Registrar evidencias en `VALIDATION.md` y aprobar en `APPROVAL.md`.
  - [x] Crear checkpoint commit en la rama `preview`.
