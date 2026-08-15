# Tareas: Mover a la Papelera de Reciclaje

- [x] **1. Backend Rust**: Sanitizar rutas UNC en `media_delete_items` (`src-tauri/src/app/commands/media.rs`) antes de llamar a `trash::delete`.
- [x] **2. Capas de UI y Estilos**: Elevar Z-Index de menús contextuales y modales (`src/shared/ui/media-menu.css`) a `> 100000` para que se posicionen sobre los visores de cine.
- [x] **3. Visor de Imágenes (`ImageViewer.tsx`)**:
  - [x] Añadir menú contextual de clic derecho (`onContextMenu`) con opción "Mover a la papelera".
  - [x] Añadir botón de Papelera en la barra de acciones superior.
  - [x] Refactorizar el listener de teclado `handleKeyDown` para capturar `Delete`, `Del`, `Supr` y evitar problemas de stale closure o foco.
  - [x] Conectar `ConfirmDialog` respetando el flag `confirmDeletion`.
- [x] **4. Visor de Vídeo (`VideoPlayer.tsx`)**:
  - [x] Integrar hook `useMediaDelete` con props `confirmDeletion` y `onRefresh`.
  - [x] Añadir atajo de teclado para la tecla Suprimir (`Delete` / `Supr`).
  - [x] Añadir menú contextual de clic derecho con "Mover a la papelera", "Mostrar en explorador" y "Favoritos".
  - [x] Añadir botón de Papelera en la barra superior de acciones.
  - [x] Manejar transición automática al siguiente vídeo si quedan elementos en la cola al mover a la papelera.
- [x] **5. Coordinación en `App.tsx` y Bibliotecas**:
  - [x] Pasar `confirmDeletion` y `onRefresh` a `VideoPlayer`.
  - [x] Unificar mensajes y textos de confirmación ("Mover a la papelera de reciclaje").
  - [x] Afinar textos en `AppSettings.tsx`.
- [x] **6. Verificación y Pruebas**: Compilación TypeScript (`bun run build`) y Rust (`cargo check`) exitosa al 100%.
