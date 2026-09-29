# Salidas de Audio Múltiples Simultáneas — Tareas

- Estado: `PENDING`

## Ejecución

- [ ] T01 — Refactorizar el motor WASAPI en `src-tauri/src/infrastructure/media/passthru/wasapi_passthru.rs` para soportar múltiples instancias de renderizado concurrentes (`Vec<RenderDeviceSlot>`).
- [ ] T02 — Implementar el algoritmo de clonación de buffers y conversión lineal de tasa de muestreo (sample rate) si los dispositivos difieren en su reloj maestro (ej. 44.1 kHz vs 48 kHz).
- [ ] T03 — Exponer los comandos Tauri en `src-tauri/src/app/commands/playback.rs` (`playback_set_multi_output_devices`, `playback_toggle_multi_output`) y registrarlos en `lib.rs`.
- [ ] T04 — Crear el hook de frontend `useMultiAudioOutput.ts` con persistencia en `localStorage` / configuración del sistema.
- [ ] T05 — Diseñar el componente UI `MultiAudioOutputSelector.tsx` en el Ecualizador con selectores estilo pill, medidor de señal y sliders de ganancia por endpoint.
- [ ] T06 — Integrar atajo de teclado dedicado en el gestor global de atajos y notificador OSD en `App.tsx`.
- [ ] T07 — Ejecutar validación de rendimiento, chequeo de tipos TypeScript y tests unitarios de Rust.

Las pruebas se documentan en `VALIDATION.md`.
