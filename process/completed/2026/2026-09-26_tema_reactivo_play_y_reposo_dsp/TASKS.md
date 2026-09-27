# Tareas — Activación Estricta de Tema Reactivo y Reposo Absoluto del Visualizador DSP

- [x] **Tarea 1: Corrección de `isAudioPlaying` en `App.tsx` y `usePlaybackController`**
  - [x] Determinar el estado exacto de reproducción activa (descartar ítems en cola sin `Play`).
  - [x] Validar que `applyMusicPalette` solo reciba la paleta si la música está sonando en tiempo real.
- [x] **Tarea 2: Diagnóstico profundo del visualizador de espectro DSP y liberación de SMTC**
  - [x] Corregir `read_snapshot` en `mpv.rs` para devolver `paused: true` y campos limpios en estado idle/sin ruta.
  - [x] Actualizar `useMediaSessionSync.ts` para pausar audio silencioso, asignar `playbackState = "none"` y limpiar metadatos en reposo.
  - [x] Garantizar reposo plano a 3px y ausencia de animación cuando no haya audio activo.
- [x] **Tarea 3: Verificación y Compilación**
  - [x] Ejecutar `cargo check` y `bun run build`.
  - [x] Registrar evidencias en `VALIDATION.md`.
  - [x] Registrar aprobación en `APPROVAL.md`.
