# Salidas de Audio Múltiples Simultáneas — Validación

- Estado: `PENDING`

## Comprobaciones

- [ ] V01 — Agente — Comprobación de tipos en TypeScript. Ejecutado: `bun run check`. Esperado: 0 errores.
- [ ] V02 — Agente — Pruebas unitarias de Rust. Ejecutado: `cargo test --features mpv`. Esperado: todas aprobadas.
- [ ] V03 — Tester — Detección de dispositivos. Comprobar que el selector enumere todos los dispositivos de salida activos en Windows (altavoces, auriculares, bluetooth).
- [ ] V04 — Tester — Emisión simultánea. Habilitar 2 dispositivos y verificar que el audio se reproduce al unísono en ambos sin desfases notorios ni cortes de buffer.
- [ ] V05 — Tester — Control de ganancia. Verificar que alterar el volumen de un dispositivo secundario no afecte al primario.
- [ ] V06 — Tester — Atajo de teclado. Probar el atajo de conmutación rápida para encender/apagar la duplicación al instante.

## Registro de fallos

- Sin fallos registrados por el momento.
