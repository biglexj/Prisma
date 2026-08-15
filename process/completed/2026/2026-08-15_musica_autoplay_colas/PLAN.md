# Proceso: Reproducción Automática y Sistema de Colas/Carpetas estilo Super Gallery (Lienzo-Gallery)

## 1. Contexto y Diagnóstico
- **Problema 1 (Reproducción automática)**: Al hacer clic en el botón de play de una tarjeta musical en la biblioteca (`MusicLibrary`), libmpv (`MpvBackend`) ejecutaba `loadfile` sin restablecer `pause: false`. Si el motor estaba en pausa inicial o previa, el archivo se cargaba pero permanecía pausado hasta que el usuario abría el reproductor y presionaba manualmente Play.
- **Problema 2 (Colas y reproducción desordenada)**: El sistema de colas solo permitía una cola volátil única que se sobrescribía sin gestión de múltiples colas, el modo aleatorio dependía de una referencia volátil que perdía sincronización, no existía soporte para saltar entre colas o reproducir carpetas como colas aisladas nombradas, ni rebobinado o repetición avanzada como en Super Gallery (`Lienzo-Gallery`).
- **Referencia Oficial**: `D:\Proyectos\biglexj\Lienzo--Gallery` (`MusicQueue.kt`, `MusicQueueOperations.kt`, `MusicPlaybackState.kt`, `MusicTabs.kt`, `MusicScreen.kt`).

## 2. Objetivos Principales
1. **Reproducción instantánea**: Garantizar que cualquier clic en una pista, botón play de tarjeta, botón "Reproducir todo" o "Reproducir álbum/carpeta" comience a sonar de inmediato (`pause: false`), tanto en el backend como en el frontend.
2. **Arquitectura Multi-Cola de Super Gallery**:
   - `queues: MusicQueue[]` con colas persistentes (cola predeterminada, colas de carpetas/álbumes, colas de favoritos).
   - `activeQueueId`: Identificador de la cola en reproducción activa.
   - `stableMediaId`: Identidad persistente por ruta absoluta de archivo para restaurar la pista actual sin saltos accidentales al índice 0.
3. **Operaciones avanzadas de Cola (`queueOperations.ts`)**:
   - `shuffleQueueKeepingCurrentFirst`: Mantener la pista actual sonando y mezclar el resto de canciones.
   - `rewindQueue`: Rebobinar la cola colocando la canción actual al principio y rotando circularmente el resto.
   - `moveItemKeepingCurrent`: Reordenar canciones conservando el puntero exacto de la pista en reproducción.
   - `removeItemFromQueue`: Eliminar pistas ajustando el puntero sin detener la reproducción.
4. **Modos de repetición y transición entre colas**:
   - Modos de repetición: `off`, `all` (repetir cola), `one` (repetir canción).
   - `jumpToNextQueue`: Saltar automáticamente a la siguiente cola al finalizar la actual.
   - `loopQueues`: Repetir el ciclo completo de colas al llegar al final.
   - Detección precisa de fin de pista con `eof_reached` desde libmpv y fallback de posición.
5. **Panel de Cola y Reproductor enriquecidos (`PlaybackQueuePanel.tsx`, `PlaybackPreview.tsx`)**:
   - Selector / pestañas para alternar entre colas guardadas.
   - Barra de acciones: Aleatorio / Mezclar, Repetir (Off / All / One), Saltar cola, Rebobinar, Vaciar.
   - Lista interactiva con miniatura, título, artista, duración, indicador animado de pista actual, botones de subida/bajada (▲/▼) y eliminación (✕).
   - Indicador visual de canción activa en `MusicLibrary` (tarjetas con onda animada / estado de reproducción en vivo).
