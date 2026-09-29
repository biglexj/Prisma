# Salidas de Audio Múltiples Simultáneas — Validación

- Estado: `PENDING`

## Comprobaciones

- [x] V01 — Agente — `bun run check`: 0 errores de TypeScript (2026-09-28).
- [x] V02 — Agente — `cargo test --manifest-path src-tauri/Cargo.toml --features mpv`: 38/38 pruebas aprobadas, incluidas fase de remuestreo, límite de cola y retardo por salida (2026-09-28).
- [ ] V03 — Tester — Detección de dispositivos. Comprobar que el selector enumere todos los dispositivos de salida activos en Windows (altavoces, auriculares, bluetooth).
- [ ] V04 — Tester — Emisión simultánea. Biglex confirmó que ambas salidas seleccionadas suenan bien. Falta comprobar el retardo relativo y descartar cortes prolongados.
- [ ] V05 — Tester — Control de ganancia. Verificar que alterar el volumen de un dispositivo secundario no afecte al primario.
- [ ] V06 — Tester — Atajo de teclado. Probar `Ctrl+Mayús+O` para encender/apagar la duplicación al instante.
- [ ] V08 — Tester — Retardo individual. Ajustar principal y secundaria con flechas de 10 ms; verificar que se alinea el audio sin cortar la reproducción.
- [ ] V09 — Tester — Pulsar `Ctrl+Mayús+Alt+O` desde otra aplicación, con Prisma visible y minimizada, y comprobar encendido/apagado sin doble activación por tecla mantenida.
- [x] V07 — Agente — Inspección visual en `Prisma (Dev)`: el selector cerrado permanece en la cabecera; abierto usa panel flotante con casillas, volumen y retardo por salida. El ecualizador conserva su posición.

## Evidencia adicional

- `bun run build`: compilación de frontend correcta; advertencia preexistente de tamaño de chunk.
- `Get-PnpDevice -Class AudioEndpoint -Status OK`: se observaron varias salidas activas y Prisma Audio Enhancer. La enumeración visible en Prisma incluyó MIXLINE, Realtek, LG, Voicemod, Alto TS415 y DM30.
- Biglex confirmó escucha simultánea y buena calidad en las dos salidas seleccionadas. Queda pendiente medir o apreciar la alineación tras ajustar el retardo manual.
- La captura de `Prisma (Dev)` mostró el control de retardo en la salida principal. La prueba de pulsación se interrumpió al detectar interacción simultánea de Biglex con la ventana; no se registra como comprobación funcional.
- La compilación y las pruebas de código no verifican la calidad audible, la latencia relativa ni los atajos en uso real. V03–V06 y V08–V09 requieren prueba funcional.

## Registro de fallos

- Sin fallos registrados por el momento.
