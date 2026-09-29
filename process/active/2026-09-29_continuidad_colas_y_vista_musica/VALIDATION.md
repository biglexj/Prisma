# Validación

- Estado: EN CURSO
- Fecha: 2026-09-29

## Hallazgos verificados en código

- `advanceNext` ya aplica salto circular a la primera cola no vacía si salto y bucle están habilitados.
- El sondeo se desactivaba al recibir una ruta nula. La carga de mpv lee el estado inmediatamente tras `loadfile`, lo que permite un estado transitorio todavía vacío.
- Las consultas en vuelo carecían de protección frente a cargas nuevas. El avance también se disparaba 350 ms antes del final, incluso con EOF explícitamente falso o pausa manual.
- La ruta se renderizaba solo desde el snapshot cargado y el diagnóstico de salida de vídeo era incondicional.

## Cambios

Sondeo activo también en reposo, cargas identificadas por generación y protección transitoria de cinco segundos hasta una lectura de la nueva pista sin EOF. Se descartan resultados tardíos de consultas previas. El salto automático usa EOF real cuando existe y la repetición reanuda la pista. La ruta utiliza la selección desde el arranque y conserva una fila de altura estable.

## Evidencia pendiente

- `bun test tests/playback-snapshot-guard.test.ts tests/flyout-auto-hide.test.ts tests/system-volume-writer.test.ts`: 17/17, 42 aserciones.
- Siete pruebas de transición: lectura antigua del EOF, estado vacío transitorio, otra selección concurrente, pausa explícita, espera limitada de archivos que no cargan, fallo anterior y detección de fin real.
- `bun run build`: TypeScript y Vite correctos, 275 módulos; advertencia preexistente de tamaño del bundle.
- Revisión con `vercel:react-best-practices`: efectos con limpieza, bloqueo de consultas simultáneas, descarte de consultas obsoletas y texto de estado coherente con la pausa.
- Repetir la misma pista utiliza la carga protegida para limpiar EOF y la marca de fin anterior.
- La continuidad acústica entre última y primera cola y la ausencia de movimiento visual requieren comprobación en la app. Las pruebas automatizadas no acreditan sonido real.
