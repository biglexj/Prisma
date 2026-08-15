# Tareas — Gestión de Colas, Reproducción y Árbol de Carpetas

- Estado: `COMPLETED`
- Fecha: `2026-08-14`

## Fase 1 — Modelo y Operaciones Matemáticas de Cola

- [x] `T1.1` Crear `src/features/playback/model/queue.ts` con los tipos `MusicQueueItem`, `MusicQueue`, `RepeatMode`.
- [x] `T1.2` Crear `src/features/playback/model/queueOperations.ts` implementando `moveItemKeepingCurrent`, `removeItemKeepingCurrent`, `shuffleQueueKeepingCurrentFirst`, `rewindQueue`, `resolveRestoredItemIndex`.
- [x] `T1.3` Crear test suite unitaria para verificar todas las invariantes matemáticas de cola (`test/queueOperations.test.ts`).

## Fase 2 — Controlador de Cola y Persistencia

- [x] `T2.1` Crear `src/features/playback/usePlaybackQueue.ts` para orquestar la cola activa, historial, shuffle, repeat y persistencia en disco/localStorage.
- [x] `T2.2` Integrar `usePlaybackQueue` con `usePlaybackController.ts` para soportar avance automático continuo (auto-play next) al finalizar pistas y control anterior/siguiente de cola.

## Fase 3 — UI de Cola y Controles de Transporte

- [x] `T3.1` Crear `src/features/playback/ui/components/PlaybackQueuePanel.tsx` con estilos adaptables y Material Expressive.
- [x] `T3.2` Desbloquear en `PlaybackPreview.tsx` el botón de vista "Cola", el botón "Aleatorio" y el botón "Repetición" con soporte funcional y badges/indicadores activos.
- [x] `T3.3` Añadir soporte para reordenamiento visual y eliminación directa de pistas de la cola.

## Fase 4 — Árbol de Carpetas y Breadcrumbs

- [x] `T4.1` Crear `src/shared/ui/FolderBreadcrumbHeader.tsx` para navegación multinivel por migas de pan.
- [x] `T4.2` Integrar navegación jerárquica por subcarpetas y mosaicos de carpetas en `MusicLibrary.tsx` y `VisualLibrary.tsx`.
- [x] `T4.3` Añadir acciones de reproducción de carpeta completa ("▶ Reproducir carpeta", "▶ Reproducir todo" y "+ Añadir a la cola").

## Fase 5 — Validación y Cierre

- [x] `T5.1` Ejecutar `npm run build` y pruebas (`test/queueOperations.test.ts`, `cargo test`).
- [x] `T5.2` Validar visualmente la cola, árbol de carpetas y persistencia.
- [x] `T5.3` Actualizar `ROADMAP.md` y documentar.
