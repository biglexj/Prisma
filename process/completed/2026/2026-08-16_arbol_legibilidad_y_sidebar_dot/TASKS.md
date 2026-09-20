# Tareas: Corrección de Legibilidad en Árbol Multimedia, Punto Verde, Navegación desde Tray y Curvatura de Quick Look

- [x] 1. Remover el punto de estado (`engine-dot`) de la barra lateral en Configuración (`AppSidebar.tsx` y `app-sidebar.css`).
- [x] 2. Conectar el listener de eventos `"prisma://navigate"` en `App.tsx` para permitir que el widget/tray dirija a la sección de Configuración.
- [x] 3. Ajustar `MediaTreeView.tsx` para respetar estrictamente el tipo de medio (`music`, `image`, `video`):
  - [x] 3.1 Adaptar icono y título de "Todos los elementos" (`disc`, `image`, `video`).
  - [x] 3.2 Omitir creación de listas M3U y cola para bibliotecas que no correspondan (imágenes).
  - [x] 3.3 Ajustar llamadas en `VisualLibrary.tsx`.
- [x] 4. Mejorar el diseño y legibilidad del árbol en `media-tree.css`:
  - [x] 4.1 Corregir contraste de botones de acción en hover de fila (reemplazar `#fff` y transparencias que fallaban en modo claro por tokens semánticos).
  - [x] 4.2 Implementar guías de árbol jerárquico y bordes sutiles para subcarpetas y archivos.
  - [x] 4.3 Refinar badges, chevrons, iconos de carpetas y estados normal/hover con Material 3 Expressive.
- [x] 5. Sincronizar el radio de curvatura (`border-radius`) de la ventana de Quick Look (`quick-look.css`) con el radio nativo de Windows 11 (8px) para eliminar la doble curvatura en la cabecera.
- [x] 6. Validación de compilación y verificación estética.
