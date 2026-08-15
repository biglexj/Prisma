# Tareas — Rediseño y Preservación de Colas

- [x] Ajustar `DEFAULT_QUEUE_NAME` a `"Árbol de Música"` en `src/features/playback/model/queue.ts`.
- [x] Refactorizar `playQueue` y `playFolder` en `src/features/playback/usePlaybackQueue.ts` para que apunten a `DEFAULT_QUEUE_ID` y nunca sobreescriban listas personalizadas.
- [x] Implementar `moveQueue` con `moveQueueInList` para reordenar la secuencia de colas.
- [x] Implementar la lógica matemática exacta de `jumpToNextQueue` (A → B → C) y `loopQueues` (C → A) en `advanceNext` y `advancePrevious`.
- [x] Añadir controles de subir/bajar cola en el administrador de colas de `PlaybackQueuePanel.tsx`.
- [x] Añadir botón conmutador de `Bucle colas` en `PlaybackQueuePanel.tsx`.
- [x] Sanitizar rutas mostradas en `PlaybackPreview.tsx` con `cleanPath`.
- [x] Validar compilación con `bun run build` y pruebas con `bun test`.
