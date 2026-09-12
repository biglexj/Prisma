# Tareas: QuickLook Refinement, Multi-ventana Desacoplada y Motor de Duplicados

- [x] **Fase 1: QuickLook UI & Apertura Completa de Documentos**
  - [x] Ajustar tamaños de ventana en Rust `service.rs` para documentos (Markdown/Texto: 830x630, EPUB: 830x630, Archive: 750x580).
  - [x] Implementar comando `quick_look_edit_file` en Rust (`ShellExecuteW` con verbo "edit" o fallback "open").
  - [x] Añadir botón «Editar» en `QuickLookHeader.tsx` para documentos Markdown/Texto/Código.
  - [x] Conectar «Abrir» (`onOpenInMain`) en `App.tsx` para renderizar `DocumentViewer` directamente al abrir un archivo de texto/markdown/código.
- [x] **Fase 2: Estabilidad Multi-ventana y Carga de Rutas Especiales**
  - [x] Crear helper `toSafeAssetUrl(path)` que codifique los componentes de ruta (`encodeURIComponent`) para que rutas con `@` (como `@ely_vtuber`) no fallen en WebView2.
  - [x] Aplicar `toSafeAssetUrl` en `QuickLookImage.tsx` y visores relevantes.
  - [x] Modificar `PREV_BOUNDS` y `IS_CUSTOM_MAXIMIZED` en Rust para aislar el estado por etiqueta de ventana (`window.label()`).
  - [x] Optimizar `handleClose` en `QuickLookWindow.tsx` para que ventanas desacopladas cierren al instante (`window.close()`) sin transicionar a estado vacío huérfano.
  - [x] Prevenir el menú contextual por defecto de WebView2 en QuickLook (`onContextMenu={(e) => e.preventDefault()}`).
  - [x] Renombrar tooltip a «Desacoplar en ventana independiente» para clarificar que no es un nuevo proceso en la bandeja de Windows.
- [x] **Fase 3: Motor de Duplicados (dupeGuru Engine) e Interfaz**
  - [x] Implementar módulo en Rust para análisis de duplicados:
    - Nivel 1: Detección por coincidencia de tamaño en bytes + hash BLAKE3/SHA-256.
    - Nivel 2: Detección perceptual para imágenes (dHash / luminancia diferencial) con cálculo de similitud porcentual.
  - [x] Exponer comandos Tauri para escaneo de duplicados y cancelación.
  - [x] Crear componente UI `DuplicatesScannerModal.tsx` en `visual_library/ui/duplicates/` con filtros de similitud, previsualización, botón «Comparar» (usando `ImageComparisonModal`) y acciones de resolución segura.
  - [x] Integrar botón de acceso en la barra superior de `VisualLibrary.tsx`.
- [x] **Fase 4: Verificación y Compilación**
  - [x] Comprobar compilación de TypeScript (`bun run tsc --noEmit` o `npm run tsc --noEmit`).
  - [x] Comprobar compilación de Rust (`cargo check`).
  - [x] Registrar validación en `VALIDATION.md` y formalizar `APPROVAL.md`.
- [x] **Fase 5: Corrección de Imágenes PNG, Dimensionamiento por Porcentaje de Pantalla y Contraste M3**
  - [x] Corregir `toSafeAssetUrl`: eliminar la mutación artificial de `@` por `%40` que provocaba doble codificación y fallos 404 en carpetas como `@ely_vtuber`.
  - [x] Dimensionamiento porcentual dinámico en Rust (`resolve_media_size`): 70% del ancho y 80% del alto de la pantalla actual para documentos (Markdown, texto, EPUB, PDF, HTML y proyectos).
  - [x] Soporte de restauración de pantalla completa/maximizado con base al 70%x80% en `quick_look_toggle_maximize`.
  - [x] Incorporar tokens Material 3 faltantes en `styles.css` (`--surface-dim` y `--surface-container-lowest`) para temas claro y oscuro.
  - [x] Rediseñar el visor `DocumentViewer`: corregir contraste texto-fondo (blanco puro/hoja elevada en modo claro, oscuro profundo en modo oscuro), cálculo reactivo del tamaño del archivo en disco (`effectiveSizeBytes`) eliminando `0 B`, y estandarización del canal de números de línea alineado 1:1.


