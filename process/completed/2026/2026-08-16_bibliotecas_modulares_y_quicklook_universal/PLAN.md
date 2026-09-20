# Bibliotecas Modulares Personalizables y Quick Look Universal — Plan

- Estado: `DRAFT`
- Fecha: `2026-08-16`
- Proyecto: `Prisma`

## Objetivo

Diseñar e implementar una arquitectura modular de bibliotecas extensibles (Documentos, Libros, Proyectos DaVinci, Affinity, Krita y tipos personalizados) junto con un motor universal de previsualización Quick Look para cualquier tipo de archivo de Windows (PDF, texto/código/Markdown, carpetas, imágenes de proyectos y tarjeta informativa fallback).

## Alcance

- Incluye:
  - **Subsistema de Bibliotecas Modulares en Barra Lateral**:
    - Módulos predeterminados opcionales: Documentos (PDF, TXT, MD, DOCX, XLSX, PPTX), Libros (EPUB, PDF, CBZ, CBR), Krita (`.kra`, `.krz`, `.ora`), Affinity (`.afphoto`, `.afdesign`, `.afpub`), DaVinci Resolve (`.drp`, `.dra`, `.drb`), Gráficos/Vectores (`.psd`, `.psb`, `.svg`).
    - Panel de gestión en Configuración: activar/desactivar módulos, asociar carpetas raíz específicas por módulo y configurar aplicación externa predeterminada de apertura.
    - Creador de Módulos Personalizados por el Usuario: nombre de sección, icono Material 3, extensiones de archivo asignadas y aplicación de apertura.
    - Vista genérica y extensible `CustomLibraryView` con Bento Grid, vista de carpetas, árbol jerárquico, ordenación y filtrado.
  - **Quick Look Universal**:
    - Previsualización nativa de PDF con paginación fluida y controles de zoom.
    - Previsualización de Texto / Código / Markdown con resaltado sintáctico y métricas de archivo.
    - Previsualización de Carpetas (Folder Card): conteo de archivos internos, peso acumulado y listado de contenido inmediato.
    - Extracción instantánea de miniaturas embebidas en proyectos (extractores ZIP para `.kra` / Krita, headers para `.psd` y renderizado SVG interactivo).
    - Tarjeta Fallback Universal para formatos no reproducibles: metadata completa del archivo (nombre, extensión, peso, fecha) y botón directo *"Abrir con [App]"*.
- No incluye:
  - Soporte para descompresión masiva de archivos ZIP/RAR/7z en el visor.
  - Edición en línea de documentos PDF o suites ofimáticas (Prisma es visor y estación de gestión local-first).

## Enfoque

1. **Rust Core (Backend Modular & Fast Extractors)**:
   - Crear extractor ultrarrápido de miniaturas para paquetes ZIP Krita (`.kra`/`mergedimage.png`) y PSD.
   - Crear escáner de metadatos de carpetas para Quick Look.
   - Definir estructura de persistencia para módulos personalizados (`custom_libraries.json`).
2. **Frontend UI & Sidebar Extensible**:
   - Refactorizar la barra lateral de navegación para renderizar dinámicamente tanto las bibliotecas fijas (`Música`, `Imágenes`, `Vídeos`) como los módulos activos del usuario.
   - Crear la pantalla `CustomLibraryView.tsx` reutilizable con los modos *Tiempo*, *Carpetas* y *Árbol*.
   - Añadir gestor de secciones modulares en `AppSettings.tsx`.
3. **Visores Especializados de Quick Look**:
   - `QuickLookPdf.tsx`: Visor PDF interactivo.
   - `QuickLookText.tsx`: Visor de texto plano, código y Markdown.
   - `QuickLookFolder.tsx`: Ficha informativa y exploratoria de carpetas.
   - `QuickLookProject.tsx`: Previsualizador de archivos Krita, PSD y proyectos creativos.
   - `QuickLookFallback.tsx`: Tarjeta universal de archivo con botón de apertura en app externa.

## Criterios de finalización

- [ ] Las secciones activadas por el usuario se muestran en la barra lateral con su icono y conteo correspondiente.
- [ ] La creación de módulos personalizados permite definir nombre, icono, extensiones y carpetas monitoreadas.
- [ ] Quick Look abre y previsualiza archivos PDF, Markdown, texto y carpetas con la tecla Espacio.
- [ ] Archivos de Krita (`.kra`) y PSD muestran su miniatura de alta resolución al instante en Quick Look.
- [ ] Cualquier otro archivo sin soporte directo muestra la tarjeta informativa fallback con botón de apertura externa.
- [ ] Compilación limpia en frontend (`bun run build`) y Rust (`cargo build`).

## Autorización

- [ ] Plan aprobado para ejecución.
