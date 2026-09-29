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
- [ ] V09 — Tester — Pulsar `Ctrl+Mayús+Alt+P` desde otra aplicación, con Prisma visible y minimizada, y comprobar encendido/apagado sin doble activación por tecla mantenida.
- [x] V07 — Agente — Inspección visual en `Prisma (Dev)`: el selector cerrado permanece en la cabecera; abierto usa panel flotante con casillas, volumen y retardo por salida. El ecualizador conserva su posición.

## Evidencia adicional

- `bun run build`: compilación de frontend correcta; advertencia preexistente de tamaño de chunk.
- `Get-PnpDevice -Class AudioEndpoint -Status OK`: se observaron varias salidas activas y Prisma Audio Enhancer. La enumeración visible en Prisma incluyó MIXLINE, Realtek, LG, Voicemod, Alto TS415 y DM30.
- Biglex confirmó escucha simultánea y buena calidad en las dos salidas seleccionadas. Queda pendiente medir o apreciar la alineación tras ajustar el retardo manual.
- La captura de `Prisma (Dev)` mostró el control de retardo en la salida principal. La prueba de pulsación se interrumpió al detectar interacción simultánea de Biglex con la ventana; no se registra como comprobación funcional.
- La compilación y las pruebas de código no verifican la calidad audible, la latencia relativa ni los atajos en uso real. V03–V06 y V08–V09 requieren prueba funcional.

## Registro de fallos

- Biglex aportó una captura con restauración rechazada por una salida desconectada; backend rechazaba la lista completa y frontend eliminaba preferencias al filtrar disponibles.
- El global Ctrl + Alt + Mayús + O estaba ocupado por AutoHotkey. El perfil real es `D:/Documentos/PowerShell/Microsoft.PowerShell_profile.ps1`, que carga `D:/Proyectos/4. Temas/2. Windows/Terminal Windows/Microsoft.PowerShell_profile.ps1`. Este define `aurora-stop`; el atajo que lo ejecuta está en `D:/Proyectos/4. Temas/2. Windows/AutoHotKey/biglexj.ahk:81`, con `aurora-stop all` en la línea 84.
- No se ejecutó ni modificó el script de AutoHotkey, el perfil o los servicios de Aurora. Biglex aprobó cambiar Prisma a Ctrl + Alt + Mayús + P; esta combinación no aparece en AutoHotkey ni en los bindings personalizados de Windows Terminal revisados. Esa búsqueda no garantiza disponibilidad en todas las aplicaciones.

## Recuperación y atajo revisados — 29 de septiembre

- `bun test tests/multi-output-recovery.test.ts tests/audio-output.test.ts tests/audio-recovery.test.ts`: 14 pruebas, 23 aserciones, correctas. Cubren principal actual, preferencias de salidas ausentes, reconexión, espera sin salida, cancelación y duplicación local sin cambiar la salida predeterminada de Windows.
- Dos expectativas antiguas de `audio-recovery.test.ts` omitían `routeSystemDefault`; se actualizaron al contrato vigente y se añadió un caso con `false`.
- `cargo test --offline --manifest-path src-tauri/Cargo.toml --lib output_selection -- --test-threads=1`: 3 pruebas correctas. Confirman deduplicación, exclusión de virtuales conocidas, conservación de ganancia/retardo de ausentes, retorno al reconectar y selección de una principal disponible.
- `bun run build`: TypeScript y Vite correctos; persiste el aviso preexistente de tamaño de bundle.
- El hilo WASAPI elimina una secundaria cuyo renderizado falla y actualiza sus IDs activos; la principal sigue procesándose. Un fallo de principal termina esa sesión para que el reconciliador abra otra salida disponible. La continuidad audible y la carrera de desconexión física requieren prueba real.
- Los errores de actualización se presentan con texto breve; los detalles técnicos quedan en consola. La indisponibilidad del global se indica en el pie del selector, sin volcar estructuras `HotKey`.
- Se observó una sola instancia Dev desde `src-tauri/target/debug/prisma.exe` tras la recompilación. No se lanzó una segunda instancia ni se activaron atajos de Aurora.
- Biglex confirmó en Prisma Dev que el selector muestra una salida preparada sin el bloque técnico y que Ctrl + Alt + Mayús + P actúa sobre Prisma desde otra aplicación sin abrir la terminal de Aurora.
- Biglex indicó que todavía no ha probado la desconexión/reconexión física de la secundaria. Sigue pendiente esa continuidad audible y recuperación de ajustes. También quedan pendientes los casos específicos de V09 con ventana minimizada y tecla mantenida.
