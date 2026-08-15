# Edición de imágenes y renombrado multimedia (Referencia Super Gallery) — Plan

- Estado: `COMPLETED`
- Fecha: `2026-08-15`
- Proyecto: `Prisma`

## Objetivo

Implementar el módulo completo de edición de imágenes (recorte, giros, volteos, relaciones de aspecto, filtros tonales, ajustes de color y dibujo libre/doodle) y la capacidad nativa de renombrado de archivos multimedia, tomando como referencia la arquitectura y experiencia de Super Gallery (`Lienzo--Gallery`).

## Alcance

- Incluye:
  - Backend Rust:
    - Comando `media_rename_item`: Renombrado seguro con validación de extensiones y rutas.
    - Comando `media_save_image`: Guardado de imágenes editadas en alta fidelidad (PNG/JPEG/WEBP) con opción de sobreescritura o guardado como copia (`_editado`).
  - Frontend UI / UX:
    - Componente `ImageEditor`: Editor visual Material 3 Expressive con pestañas de:
      - **Transformar / Recortar**: Recorte interactivo libre y por relación de aspecto (1:1, 4:3, 3:4, 16:9, 9:16), giro de 90° horario/antihorario, volteo horizontal y vertical.
      - **Filtros**: Normal, Struck, Clarendon, Mars, Rise, Abril, Vintage/Sepia, Blanco y Negro (B/N), Invertir con slider de intensidad.
      - **Ajustes**: Brillo, Contraste, Saturación y Desenfoque.
      - **Dibujo (Doodle)**: Pincel libre con paleta de colores tonales, grosor ajustable y función de deshacer (Undo).
    - Diálogo `SaveImageDialog`: Opciones de guardado como copia con nombre personalizable o sobrescritura directa.
    - Diálogo `RenameMediaDialog`: Diálogo limpio de renombrado con detección de extensión y validación en tiempo real.
    - Integración en `ImageViewer` (botón de editar en barra superior y atajos `E`, `F2`) y menús contextuales de biblioteca y visor.
  - Iconos ampliados en `Icon.tsx` (recorte, rotación, volteo, pincel, ajustes, deshacer, etc.).
- No incluye:
  - Edición de vídeo ni integración directa con DaVinci Resolve (reservado para la siguiente fase según requerimiento).

## Enfoque

1. **Backend Rust**: Crear los comandos `media_rename_item` y `media_save_image` en `src-tauri/src/app/commands/media.rs` y registrarlos en `lib.rs`.
2. **Iconos UI**: Agregar los nuevos glifos SVG requeridos en `src/shared/ui/Icon.tsx`.
3. **Diálogo de Renombrado**: Crear `RenameMediaDialog.tsx` y el hook/cliente asociado.
4. **Editor de Imágenes (`ImageEditor`)**:
   - Crear `ImageEditor.tsx`, `ImageEditorToolbar.tsx`, `ImageCropOverlay.tsx`, `SaveImageDialog.tsx` y sus estilos CSS `image-editor.css`.
   - Implementar pipeline de renderizado en Canvas para transformaciones, matrices de color y trazos doodle en alta resolución.
5. **Integración en Visor y Biblioteca**: Integrar opciones de editar y renombrar en `ImageViewer.tsx` y `VisualLibrary.tsx`.
6. **Validación y Pruebas**: Probar compilación Rust, TypeScript, flujo de guardado, recorte, giros, filtros y renombrado.

## Criterios de finalización

- [x] Comandos Rust de renombrado y guardado de imagen funcionando y compilando sin errores.
- [x] Editor de imagen con soporte completo de recorte (proporciones), transformaciones (rotar/voltear), filtros, ajustes y dibujo.
- [x] Diálogo para guardar imagen como copia o sobrescribir original.
- [x] Diálogo de renombrado accesible desde visor y menú contextual.
- [x] Sin regresiones en el visor de imágenes ni en la reproducción.

## Autorización

- [x] Plan aprobado y ejecutado satisfactoriamente.
