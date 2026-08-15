# Plan — Gestión de Colas, Reproducción y Árbol de Carpetas (Inspirado en Lienzo)

- Estado: `IN_PROGRESS`
- Fecha: `2026-08-14`
- Proyecto: `D:\Proyectos\biglexj\Prisma`
- Proyecto de referencia: `D:\Proyectos\biglexj\Lienzo--Gallery` (Referencia conceptual y de interacción; implementación nativa TypeScript/React/Rust)

## Objetivo

Implementar en Prisma el sistema de gestión de colas de reproducción avanzadas, navegación jerárquica en árbol de carpetas con migajas de pan interactivas (breadcrumbs) y control de repetición/aleatorio, adaptando los principios probados de Lienzo (`MusicQueueOperations`, `MusicQueueSheet`, `FileBreadcrumbHeader`, `FolderNavigation`) a la arquitectura Tauri 2 + React 19 + Rust.

---

## Principios y Componentes Clave

### 1. Modelo y Operaciones Matemáticas de Cola (`queue/operations.ts`)
Adaptación pura de `MusicQueueOperations.kt` de Lienzo a TypeScript:
- **`moveItemKeepingCurrent`**: Reordena una pista y recalcula el puntero de reproducción para que siga apuntando a la canción en curso sin importar si otros elementos cruzan por delante o detrás.
- **`removeItemKeepingCurrent`**: Elimina una pista ajustando el índice actual sin desfasar la pista activa.
- **`shuffleQueueKeepingCurrentFirst`**: Mantiene la canción que suena en la posición 0 y mezcla aleatoriamente las canciones restantes.
- **`rewindQueue`**: Sitúa la canción activa al inicio y rota las demás de manera circular.
- **`resolveRestoredItemIndex`**: Restaura la pista por identidad estable (`path`) y solo recurre al índice numérico como fallback.

### 2. Controlador de Cola y Persistencia (`usePlaybackQueue.ts`)
- Cola activa con items `{ id, path, title, artist, folder, durationSeconds, sizeBytes }`.
- Modos de reproducción:
  - `repeatMode`: `"off"` | `"all"` | `"one"`.
  - `shuffleMode`: `boolean` (activa mezcla no destructiva conservando orden original si se desactiva).
- Acciones públicas:
  - `playQueue(items, startIndex)`: Carga una lista completa y reproduce desde `startIndex`.
  - `playNext(item)`: Inserta la pista inmediatamente después de la actual.
  - `addToQueue(item | items[])`: Añade al final de la cola.
  - `playQueueAt(index)`: Salta a la posición deseada.
  - `reorderQueue(fromIndex, toIndex)`
  - `removeFromQueue(index)`
  - `clearQueue()`
  - `toggleShuffle()` / `toggleRepeat()`
- Persistencia automática de la cola y última pista en `localStorage` / sesión para recuperación tras reinicio.

### 3. Interfaz de Cola (`PlaybackQueuePanel` / `PlaybackPreview`)
- Habilitación completa de los botones en `PlaybackPreview.tsx`:
  - Botón de vista **"Cola"** (modo dedicado o panel lateral de cola).
  - Botón de **Aleatorio** (Shuffle on/off con estado visual activo).
  - Botón de **Repetición** (Repeat off / all / one con badges dinámicos).
- Lista de pistas en cola con indicación de la pista en curso, drag-and-drop o botones de reordenar y eliminación rápida.

### 4. Navegación Jerárquica y Árbol de Carpetas (`FolderBreadcrumbHeader` & Subcarpetas)
- **`FolderBreadcrumbHeader`**: Barra de navegación por niveles (ej. `Música > Anime Music > Black Clover > Ending`), permitiendo hacer clic en cualquier nivel para navegar inmediatamente hacia arriba en el árbol.
- **Explorador de Carpetas en `MusicLibrary` y `VisualLibrary`**:
  - Vista por carpetas con navegación hacia dentro de subcarpetas (`openedFolder` / subdirectorios).
  - Acciones de carpeta rápida: **"▶ Reproducir carpeta"** (crea la cola con todas las pistas de la carpeta y subcarpetas) y **"+ Añadir carpeta a la cola"**.

---

## Fases de Ejecución

1. **Fase 1 — Operaciones y Modelo de Cola**:
   - Crear `src/features/playback/model/queue.ts` y `src/features/playback/model/queueOperations.ts`.
   - Pruebas unitarias de las operaciones matemáticas de cola.

2. **Fase 2 — Controlador de Cola y Persistencia**:
   - Crear `src/features/playback/usePlaybackQueue.ts` y enlazarlo con `usePlaybackController.ts` para avance automático al terminar la pista y navegación anterior/siguiente según cola.

3. **Fase 3 — UI de Cola y Controles de Transporte**:
   - Diseñar `PlaybackQueuePanel.tsx` en `src/features/playback/ui/components/`.
   - Conectar modo `"queue"` y controles `shuffle` / `repeat` en `PlaybackPreview.tsx`.

4. **Fase 4 — Árbol de Carpetas y Breadcrumbs**:
   - Crear componente compartido `FolderBreadcrumbHeader.tsx`.
   - Integrar navegación por niveles y reproducción de carpetas completas en `MusicLibrary.tsx` y `LibrarySources.tsx`.

5. **Fase 5 — Verificación y Cierre**:
   - Validar compilación, tests y funcionamiento en vivo.
