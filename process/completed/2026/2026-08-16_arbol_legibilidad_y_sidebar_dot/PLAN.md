# Plan: Corrección de Legibilidad en Árbol Multimedia, Eliminación de Punto Verde y Navegación desde Tray

## Contexto y Diagnóstico
1. **Punto Verde en Configuración (Sidebar)**:
   - En `src/app/ui/AppSidebar.tsx` se renderizaba un elemento `<span className="engine-dot" />` dentro del botón de Configuración. Esto generaba confusión visual al simular un estado o notificación inexistente.
2. **Navegación a Configuración desde Tray Menu (Widget de la bandeja de Windows)**:
   - Al pulsar "Configuración" en el menú contextual de la bandeja de Windows (system tray), Tauri emitía `"prisma://navigate"` con `"settings"`, pero `App.tsx` no contaba con un listener para dicho evento, por lo que la ventana se enfocaba pero no cambiaba la vista.
3. **Contexto Multimedia en Vista de Árbol (`MediaTreeView`)**:
   - `MediaTreeView` asumía comportamientos exclusivos de música:
     - El botón de crear lista de reproducción M3U se renderizaba de forma no semántica en imágenes y videos.
     - El icono de la carpeta virtual "Todos los elementos" estaba fijado como `disc`, en lugar de adaptarse semánticamente (`disc` para música, `image` para imágenes, `video` para vídeos).
     - Las acciones de cola o reproducción en carpetas de imágenes generaban incoherencia.
4. **Legibilidad y Contraste en Estado Normal y Hover (Light Mode / Material Expressive)**:
   - En modo claro, los botones de acción (`.media-tree-play-btn`, `.media-tree-queue-btn`, `.media-tree-playlist-btn`) tenían `color: #fff` y fondos translúcidos claros en el hover de la fila, haciéndose invisibles o ilegibles hasta que el cursor tocaba exactamente el botón individual.
   - Las filas de carpetas en estado normal carecían de jerarquía visual, guías estructurales de anidamiento, y los badges flotaban sin contraste.

## Objetivos
1. Remover el punto verde (`engine-dot`) del botón de Configuración en el sidebar.
2. Agregar el listener `"prisma://navigate"` en `App.tsx` para abrir la sección correspondiente (ej. Configuración) al seleccionarla desde el menú de la bandeja del sistema.
3. Adaptar semánticamente `MediaTreeView` según `mediaType` ("music", "image", "video"), mostrando solo las acciones pertinentes y los iconos adecuados.
4. Rediseñar la vista de árbol en `media-tree.css` con contraste impecable en modo claro y oscuro, guías visuales de niveles jerárquicos, botones de acción nítidos y legibles en hover de fila, y badges consistentes con Material 3 Expressive.

## Archivos Afectados
- `src/app/App.tsx`
- `src/app/ui/AppSidebar.tsx`
- `src/app/ui/app-sidebar.css`
- `src/shared/ui/MediaTreeView.tsx`
- `src/shared/ui/media-tree.css`
- `src/features/visual_library/ui/VisualLibrary.tsx`
