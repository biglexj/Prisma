# Marca de Agua Visual y Metadatos de Autoría (Individual y por Lotes) — Plan

- Estado: `IN_PROGRESS`
- Fecha: `2026-09-28`
- Proyecto: `Prisma`

## Objetivo

Implementar un sistema paramétrico de marca de agua visual (estampado de logotipo PNG y/o texto de autor/fecha con escala, opacidad y anclaje adaptativo en esquinas, bordes o centro) tanto en el **Editor de Imágenes** (edición individual interactiva con previsualización en vivo) como en el **Convertidor Prisma** (procesamiento por lotes), junto con la inyección de metadatos de autoría y derechos.

## Alcance

- Incluye:
  - Definición de tipos y modelo de configuración `WatermarkConfig` en `src/features/visual_library/model/watermark.ts` (basado en el estándar de Super Galería):
    - `enabled: boolean`
    - `text: string` (ej. nombre de autor, fotógrafo o marca)
    - `includeDate: boolean` (año o fecha formateada YYYY-MM-DD)
    - `logoDataUrl?: string` o `logoPath?: string` (logotipo PNG transparente)
    - `position: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center" | "custom"`
    - `normX: number`, `normY: number` (coordenadas relativas 0.05 a 0.95)
    - `opacity: number` (0.1 a 1.0)
    - `scale: number` (0.3 a 3.0)
    - `color: string` (blanco, negro, acento) y sombra de contraste.
  - Función de renderizado / horneado sobre canvas: `applyWatermarkToCanvas(ctx, width, height, config, logoImg)`.
  - Integración en el **Editor de Imágenes** ([ImageEditor.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/visual_library/ui/editor/ImageEditor.tsx)):
    - Botón de Marca de Agua en la barra de herramientas ([ImageEditorToolbar.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/visual_library/ui/editor/ImageEditorToolbar.tsx)).
    - Diálogo/panel modal de configuración de marca de agua (`WatermarkDialog.tsx`).
    - Renderizado interactivo sobre el canvas de previsualización con soporte para arrastrar la marca de agua libremente sobre la imagen.
    - Horneado de la marca de agua al guardar/exportar.
  - Integración en el **Convertidor Prisma** ([PrismaConvertView.tsx](file:///d:/Proyectos/biglexj/Prisma/src/features/converter/ui/PrismaConvertView.tsx)):
    - Sección desplegable o conmutador "Estampar marca de agua".
    - Parámetros de texto, logotipo, posición y opacidad para aplicar en bloque a todas las imágenes procesadas en la cola de conversión.
  - Inyección de metadatos de autoría básica en metadatos de exportación.
  - Verificación de compilación de TypeScript y build general.
- No incluye:
  - Estampado de marcas de agua en vídeo en tiempo real dentro del reproductor (el reproductor solo visualiza).

## Enfoque

1. **Modelo y Utilidades**:
   - Crear `src/features/visual_library/model/watermark.ts` con tipos y utilidades de renderizado sobre HTML5 2D Canvas.
2. **Editor de Imágenes Individual**:
   - Crear `WatermarkModal.tsx` con controles Material 3 Expressive (presets de anclaje, deslizadores de escala/opacidad, selector de logo y texto).
   - Conectar con `ImageEditor.tsx` para dibujar la marca en la previsualización y en la exportación final.
3. **Convertidor por Lotes**:
   - Extender el pipeline de conversión en `PrismaConvertView.tsx` o canvas buffer para estampar la marca de agua antes de codificar en JPEG/PNG/WebP.
4. **Validación**:
   - Compilación con `bun run build`.
   - Pruebas de exportación con logo y texto en distintas posiciones.

## Criterios de finalización

- [ ] Modelo `WatermarkConfig` y función de horneado en canvas implementados.
- [ ] Editor de imágenes con panel de marca de agua interactivo y soporte de logo PNG + texto + fecha.
- [ ] Convertidor por lotes con opción de estampar marca de agua paramétrica en todos los archivos procesados.
- [ ] Horneado exacto y de alta calidad sin pixelado ni desbordamientos de lienzo.
- [ ] Cero errores de compilación (`bun run build`).
