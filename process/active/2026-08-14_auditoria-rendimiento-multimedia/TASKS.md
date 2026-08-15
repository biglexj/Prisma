# Tareas — Auditoría de rendimiento multimedia de Prisma

- Estado: `BLOCKED_BY_APPROVAL`
- Regla: ninguna tarea de código comienza antes de `G0`.

## Protocolo para el agente ejecutor

Leer primero `PLAN.md`. Trabajar secuencialmente, modificar solo los archivos necesarios para la tarea activa y registrar comandos, resultados y métricas en `VALIDATION.md`. Si una prueba empeora, detenerse y volver al checkpoint aprobado. No ampliar el alcance por iniciativa propia.

## G0 — Protección y línea base

- [ ] `P0.1` Ejecutar `git rev-parse --show-toplevel` y localizar la raíz Git real.
- [ ] `P0.2` Si Git no existe, solicitar una decisión; no inicializarlo automáticamente.
- [ ] `P0.3` Preparar audio sin portada, portada pequeña, portada de 4–8 MiB, álbum con portada compartida y vídeo 4K corto.
- [ ] `P0.4` Medir inicio vacío durante 2 minutos.
- [ ] `P0.5` Medir una canción durante 30 minutos, con muestras por minuto.
- [ ] `P0.6` Cambiar entre 100 pistas y comprobar si la memoria se estabiliza.
- [ ] `P0.7` Separar Prisma, WebView2 y MPV; registrar también el total.
- [ ] `P0.8` Presentar la evidencia a Biglex y solicitar `G0`.

## G1 — Carátulas y paletas

- [ ] `P1.1` Añadir pruebas Rust para reducción, formatos y límite de salida.
- [ ] `P1.2` Generar carátulas de máximo 512 px en Rust.
- [ ] `P1.3` Crear una identidad estable para cada portada.
- [ ] `P1.4` Deduplicar portadas compartidas por varias canciones.
- [ ] `P1.5` Aplicar LRU con presupuesto inicial de 32 MiB.
- [ ] `P1.6` Reemplazar y limitar `paletteCache`.
- [ ] `P1.7` Repetir 100 cambios de pista y comparar con la línea base.
- [ ] `P1.8` Solicitar aprobación de `G1`.

## G2 — Biblioteca virtualizada

- [ ] `P2.1` Medir tarjetas e imágenes montadas al abrir Música.
- [ ] `P2.2` Implementar virtualización o ventana incremental con overscan pequeño.
- [ ] `P2.3` Cancelar solicitudes sin consumidor visible.
- [ ] `P2.4` Probar 10,000 metadatos y 200 portadas.
- [ ] `P2.5` Solicitar aprobación de `G2`.

## G3 — Miniaturas de vídeo

- [ ] `P3.1` Añadir una prueba que impida miniaturas al tamaño original.
- [ ] `P3.2` Sustituir el canvas del frontend por el preview nativo acotado.
- [ ] `P3.3` Añadir caché por bytes y solicitudes deduplicadas.
- [ ] `P3.4` Probar 50 vídeos, incluidos 1080p y 4K.
- [ ] `P3.5` Solicitar aprobación de `G3`.

## G4 — MPV y ciclo de vida

- [ ] `P4.1` Medir audio con `audio-display` activo e inactivo.
- [ ] `P4.2` Configurar MPV según familia multimedia.
- [ ] `P4.3` Verificar carga, reemplazo, pausa, fin, cierre y liberación de archivos.
- [ ] `P4.4` Adaptar el sondeo de 500 ms según eventos, pausa y visibilidad.
- [ ] `P4.5` Confirmar cero procesos huérfanos.
- [ ] `P4.6` Solicitar aprobación de `G4`.

## G5 — Cierre

- [ ] `P5.1` Ejecutar build frontend, pruebas Rust y build Tauri de producción.
- [ ] `P5.2` Repetir la matriz completa con los mismos fixtures.
- [ ] `P5.3` Validar visualmente navegación, miniaturas, audio y vídeo.
- [ ] `P5.4` Documentar límites conocidos.
- [ ] `P5.5` Decidir con Biglex si se conserva Tauri o se abre un spike comparativo.
- [ ] `P5.6` Actualizar `ROADMAP.md` y cerrar el proceso solo después de aprobación.

