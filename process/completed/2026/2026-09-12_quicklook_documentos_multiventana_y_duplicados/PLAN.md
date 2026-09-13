# Proceso: QuickLook Refinement, Multi-ventana Desacoplada y Motor de Duplicados (dupeGuru) — Plan

- Estado: `APPROVED`
- Fecha: `2026-09-12`
- Proyecto: `Prisma`

## Objetivo

Resolver integralmente la experiencia de QuickLook para documentos (dimensiones ampliadas, botón de edición y apertura completa en Prisma), corregir la estabilidad de ventanas desacopladas (carga de rutas con `@` y cierre limpio sin duplicar procesos ni iconos en la bandeja del sistema) y diseñar/implementar el motor de detección de archivos e imágenes duplicadas inspirado en dupeGuru integrado con el comparador de Prisma.

## Alcance

- Incluye:
  1. **QuickLook UI**: Aumentar dimensiones de previsualización para documentos (+5% alto, +8-10% ancho).
  2. **QuickLook Header**: Añadir botón explícito de «Editar» (para abrir en el editor predeterminado del sistema o editor interno).
  3. **Apertura de Documentos en Prisma**: Conectar «Abrir» (`↗`) para que archivos Markdown, texto y código abran el visor/editor completo (`DocumentViewer`) en la ventana principal en lugar de dejar la app vacía.
  4. **Corrección de URLs para Protocolo Local (`@`, `#`)**: Sanitizar rutas de activos codificando adecuadamente los caracteres problemáticos en Chromium/WebView2 para evitar pantallas en blanco (como `@ely_vtuber/bg-404.png`).
  5. **Estabilidad Multi-ventana**: Independizar estado de maximizado por ventana, evitar bloqueos de cierre, suprimir menú contextual genérico de Edge/WebView2 y renombrar la acción a «Desacoplar en ventana independiente».
  6. **Motor de Duplicados (dupeGuru Engine)**:
     - Nivel 1: Detección rápida por coincidencia exacta (tamaño en bytes + hash BLAKE3/SHA-256).
     - Nivel 2: Detección perceptual para imágenes (dHash / aHash de luminancia y resolución) con selector de umbral de similitud (ej. 100%, 95%, 85%).
      - UI en `visual_library`: Modal/panel de búsqueda de duplicados, lista agrupada de candidatos, botón de comparación directa con `ImageComparisonModal` y acciones seguras (conservar el mejor, mover duplicado a papelera).
   7. **Comparativa y Depuración Cruzada entre Carpetas (Base vs Depurar)**:
      - Modo Carpeta Base (a proteger / intacta) vs Carpeta a Depurar (candidata a limpieza).
      - Regla de prioridad de resolución superior: si el duplicado en la carpeta a depurar tiene mayor resolución ($W \times H$), prevalece y se habilita la acción de Reemplazar/Upgrade.
      - Acciones flexibles: Eliminar a Papelera, Reemplazar versión base por HD, y Mover a carpeta externa/cuarentena.
- No incluye:
  - Eliminación destructiva forzada sin confirmación ni papelera de reciclaje.

## Enfoque

1. **Fase 1**: Refinamiento de dimensiones, botón Editar y apertura completa de documentos en QuickLook y App.
2. **Fase 2**: Corrección de URLs para caracteres especiales (`@`), per-window state y cierre inmediato en ventanas flotantes.
3. **Fase 3**: Implementación del motor de duplicados en Rust y frontend con integración al comparador visual.
4. **Fase 4**: Validación, comprobaciones automáticas y pruebas de compilación.
5. **Fase 5**: Corrección de URLs con `@`, dimensionamiento 70%x80%, tokens M3 y rediseño de DocumentViewer.
6. **Fase 6**: Comparativa y depuración cruzada entre carpetas con prioridad de mayor resolución y acciones avanzadas.

## Criterios de finalización

- [x] Las vistas de documentos en QuickLook tienen dimensiones más amplias (+5% alto, +8-10% ancho).
- [x] La cabecera de QuickLook incluye botón «Editar» funcional para documentos.
- [x] Al pulsar «Abrir» en un documento desde QuickLook, la ventana principal de Prisma muestra el documento en `DocumentViewer` completo.
- [x] Rutas con `@` o caracteres reservados se cargan sin pantalla blanca en imágenes/vídeos.
- [x] Las ventanas desacopladas cierran al primer clic sin bloquearse ni mostrar "Listo para previsualizar".
- [x] Menú contextual nativo de Edge bloqueado en la vista previa.
- [x] Motor de duplicados funcional con comparación de similitud perceptual y visualización de resultados.
- [ ] Selector de modo cruzado «Base vs Depurar» disponible en el Buscador de Duplicados.
- [ ] Emparejamiento respetando la carpeta base como protegida y carpeta a depurar como duplicado.
- [ ] Detección inteligente de mayor resolución con acción de Reemplazo HD hacia la carpeta base.
- [ ] Acción de mover duplicados a carpeta personalizada sin eliminarlos.

## Autorización

- [x] Plan aprobado para ejecución por el usuario ("Ok, tú encárgate de ello").

