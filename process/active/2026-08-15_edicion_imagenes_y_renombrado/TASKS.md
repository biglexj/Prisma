# Edición de imágenes y renombrado multimedia — Tareas

- Estado: `COMPLETED`
- Fecha: `2026-08-15`
- Proceso: `2026-08-15_edicion_imagenes_y_renombrado`

## Tareas

- [x] **1. Backend Rust: Comandos de renombrado y guardado de imagen**
  - [x] Implementar `media_rename_item` en `src-tauri/src/app/commands/media.rs`.
  - [x] Implementar `media_save_image` en `src-tauri/src/app/commands/media.rs`.
  - [x] Registrar los comandos en `src-tauri/src/lib.rs`.
- [x] **2. Iconografía y tipos UI**
  - [x] Extender `Icon.tsx` con iconos para recorte (`crop`), rotación (`rotate-cw`, `rotate-ccw`), volteo (`flip-h`, `flip-v`), pincel (`brush`), ajustes (`sliders`), deshacer (`undo`), guardar (`save`), etc.
  - [x] Definir tipos en TypeScript para edición de imágenes, filtros y opciones de guardado en `editorTypes.ts`.
- [x] **3. Diálogo de Renombrado Multimedia**
  - [x] Crear `RenameMediaDialog.tsx` con soporte para validación de nombres, separación de extensión e interfaz Material 3.
  - [x] Crear hook `useMediaRename.ts` para unificación de renombrado en visor y biblioteca.
- [x] **4. Módulo de Edición de Imágenes (`ImageEditor`)**
  - [x] Crear componentes modulares: `ImageEditor.tsx`, `ImageEditorToolbar.tsx`, `ImageCropOverlay.tsx`, `SaveImageDialog.tsx`.
  - [x] Implementar recorte libre y por relación de aspecto (1:1, 4:3, 3:4, 16:9, 9:16) con asas interactivas de arrastre.
  - [x] Implementar rotación (90° horaria/antihoraria) y volteo (horizontal y vertical).
  - [x] Implementar filtros de color tonales inspirados en Super Gallery (`filterPresets.ts`) y ajustes (brillo, contraste, saturación, desenfoque).
  - [x] Implementar lienzo de dibujo libre (doodle) con selector de colores y grosor de pincel con deshacer (undo).
  - [x] Diseñar hojas de estilo en `image-editor.css`.
- [x] **5. Integración con Visor y Biblioteca**
  - [x] Integrar botón "Editar" y acción "Renombrar" en la barra superior y menú contextual de `ImageViewer.tsx` con atajos de teclado (`E`, `F2`).
  - [x] Integrar acción "Renombrar" y "Editar imagen" en el menú contextual de `VisualLibrary.tsx`.
  - [x] Actualizar estado y recargar la biblioteca/visor tras guardar o renombrar.
- [x] **6. Verificación y Validación**
  - [x] Comprobar compilación de frontend (`npm run build` / TypeScript).
  - [x] Comprobar compilación de backend (`cargo check`).
  - [x] Registrar pruebas en `VALIDATION.md` y actualizar `APPROVAL.md`.
