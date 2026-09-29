# Salidas de Audio Múltiples Simultáneas — Tareas

- Estado: `IN_PROGRESS`

## Ejecución

- [x] T01 — Refactorizar el motor WASAPI en `src-tauri/src/infrastructure/media/passthru/wasapi_passthru.rs` para soportar múltiples instancias de renderizado concurrentes (`Vec<RenderDeviceSlot>`).
- [x] T02 — Implementar el algoritmo de clonación de buffers y conversión lineal de tasa de muestreo (sample rate) si los dispositivos difieren en su reloj maestro (ej. 44.1 kHz vs 48 kHz).
- [x] T03 — Exponer los comandos Tauri en `src-tauri/src/app/commands/playback.rs` (`playback_set_multi_output_devices`, `playback_toggle_multi_output`) y registrarlos en `lib.rs`.
- [x] T04 — Crear el hook de frontend `useMultiAudioOutput.ts` con persistencia en `localStorage`.
- [x] T05 — Diseñar el selector compacto desplegable `MultiAudioOutputSelector.tsx` en el Ecualizador con casillas y ganancias por salida, sin desplazar el resto de la vista.
- [x] T06 — Integrar el atajo `Ctrl+Mayús+O` y un aviso breve al conmutar en `App.tsx`.
- [x] T07 — Añadir retardo manual por salida, también en la principal, con controles de 10 ms y actualización en caliente.
- [ ] T08 — Completar validación funcional en dispositivos reales, chequeo de tipos TypeScript y tests unitarios de Rust.

Las pruebas se documentan en `VALIDATION.md`.
