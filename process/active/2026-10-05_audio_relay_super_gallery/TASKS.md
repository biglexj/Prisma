# Audio en directo — Tareas

- Estado: `IN_PROGRESS`; código escrito y pruebas físicas en curso.

- [ ] T01 — Confirmar la ubicación/estado del backend nativo vigente sin recuperar ni sobrescribir trabajo concurrente.
- [ ] T02 — Coordinar corrección de rutas con el proceso Android y definir capacidades/estados de sesión.
- [ ] T03 — Validar PCM/TLS nativo; medir retardo y congestión antes de consolidar el transporte. WebRTC/Opus queda como alternativa no prototipada.
- [ ] T04 — Reutilizar Synapse y conectar automáticamente sin un segundo emparejamiento, conservando la identidad pública para reconexiones.
- [ ] T05 — Separar captura WASAPI de render físico y conectar la cola de red sin bloquear el hilo de audio.
- [ ] T06 — Integrar recepción Android y destino móvil en Ecualizador junto a salidas múltiples, preservando las salidas físicas y sus controles.
- [ ] T10 — Implementar intención habilitada independiente de señal/transporte, continuidad durante silencios, reconexión mientras esté habilitada y desactivación sincronizada sin reintentos.
- [ ] T11 — Integrar atajo global configurable que alterne el mismo control del Ecualizador, con aviso breve y detección de conflictos sin ocupar los atajos actuales.
- [ ] T09 — Actualizar documentación funcional y ROADMAP cuando el resultado esté verificado.

## Segunda etapa, fuera de esta entrega

T07 (emisor Android/receptor Windows) y T08 (captura de otras apps Android) quedan aplazadas. Abrir un proceso posterior cuando Biglex retome el sentido inverso; no ejecutarlas ni exigirlas para entregar PC → teléfono.

Las comprobaciones y resultados pertenecen a VALIDATION.md.

### Avance

Receptor, conexión automática Synapse, captura, panel y atajo implementados; TLS físico aún bajo diagnóstico. Eliminadas la ruta persistida y su reaplicación en Android; observado el AudioTrack efectivo y abierto el selector del sistema. Las casillas requieren la aceptación funcional completa de VALIDATION.md, no solo existencia de código.
