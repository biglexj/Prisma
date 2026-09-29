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
- [x] T08 — Registrar `Ctrl+Mayús+Alt+P` como segundo atajo global mediante Tauri, compartir el estado con el selector y avisar si el registro falla. Sustituye O por decisión de Biglex del 29 de septiembre.
- [ ] T09 — Completar validación funcional en dispositivos reales, chequeo de tipos TypeScript y tests unitarios de Rust.

Las pruebas se documentan en `VALIDATION.md`.

- [x] Conservar preferencias de dispositivos ausentes y filtrar las salidas solo al preparar el motor.
- [x] Incluir la principal actual incluso con duplicación desactivada; conservar ajustes al cambiar la selección.
- [x] Aislar el fallo de una secundaria en el hilo WASAPI.
- [x] Identificar la colisión con AutoHotkey: Ctrl + Alt + Mayús + O ejecuta `aurora-stop all`.
- [x] Confirmar con Biglex la salida preparada, eliminación del bloque técnico y nuevo global desde otra aplicación sin abrir Aurora.
- [ ] Verificar desconexión/reconexión física en uso real.
