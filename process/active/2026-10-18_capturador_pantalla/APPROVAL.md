# Capturador de pantalla — Autorización y estado

- Estado: `PLANNED` — listo para relevo; implementación pendiente.
- Fecha: `2026-10-18`.

## Autorización vigente

Biglex pidió únicamente planificar y guardar el plan en `process` porque otro agente se encargará de ejecutarlo. Esa instrucción autoriza estos documentos; no autoriza implementar en este turno ni representa aceptación de un producto terminado.

## Controles

- [x] Alcance, modos y corrección de Ventana por defecto registrados.
- [x] Tareas técnicas y criterios de validación preparados.
- [x] Enlace al proceso incorporado en ROADMAP.md.
- [ ] Instrucción posterior de ejecución recibida por el agente encargado.
- [ ] Validación técnica de implementación.
- [ ] Prueba funcional en Windows de captura, copia, guardado y atajo.
- [ ] Aceptación de la interfaz y del significado de «task» por Biglex.

## Decisión

No hay aprobación funcional ni cierre de implementación. Conservar en `process/active/`. El siguiente agente debe leer PLAN.md, ejecutar el alcance que se le autorice y documentar evidencia en VALIDATION.md.


## Autorización posterior — 2026-10-18

Biglex encargó ejecutar los refinamientos indicados en PLAN.md, probar la app que dejó abierta y enviar capturas al chat. Esta autorización sustituye el estado histórico de solo planificación para esos ajustes. La aprobación visual final de Biglex permanece pendiente; no atribuirle aceptación a partir de pruebas técnicas.

## Revisión y corrección autorizadas — 2026-10-20

Biglex comunica que el lápiz funciona al iniciar y falla después, incluida la anotación del recorte, y autoriza las pruebas necesarias. Se reprodujeron y corrigieron el contacto de puntero retenido y la cancelación tardía de otra sesión. Evidencia técnica en VALIDATION.md; la comprobación con su lápiz físico sigue pendiente. Esta revisión no publica una release ni sustituye la instalación habitual.

## Confirmación del lápiz físico — 2026-10-20

Biglex confirma posteriormente: «Sí, ya funciona en varias capturas», desde Probar Captura en Dev, y aporta trazos visibles. Se registra esta aceptación concreta; no equivale a aprobar toda la matriz de captura o publicar la versión. El bloqueo intermitente no reapareció durante la muestra instrumentada.

## Incidencia reabierta en producción — 2026-10-20

Tras compilar e instalar, Biglex vuelve a informar de bloqueo del lápiz tanto al seleccionar Rectángulo como al anotar; las barras siguen respondiendo. El funcionamiento anterior en Dev no valida esta secuencia de producción. Diagnóstico y corrección autorizados; aceptación física pendiente. No se declara resuelto.

## Confirmación de la transición visual — 2026-10-21

Biglex confirma «el parpadeo ya está saneado». Pide dejar abierta la aplicación y avisa que seguirá haciendo varias capturas para comunicar si vuelve a fallar el lápiz. Aprobación de esa corrección visual; el bloqueo intermitente permanece en observación. No hay autorización nueva de publicación o instalación.

## Atajo global que no respondía al arrancar — 2026-10-21

Biglex reporta que el capturador solo se habilita tras abrir la aplicación y entrar a Configuración, y que en segundo plano el atajo no hace nada. El encargo resuelto es el diagnóstico y la corrección de ese comportamiento.

Causa confirmada: el atajo global se registraba desde el frontend y solo con la preferencia activada, nunca al arrancar el proceso. En la instalación de Biglex el atajo elegido («Impr Pant») lo tiene ocupado la Herramienta Recortes, el fallo se descartaba en silencio y el estado informaba «Atajo Activo» sin ninguna tecla registrada. La vista «Capturador» tampoco era alcanzable desde la barra lateral.

Corrección aplicada: el registro pasa al backend y ocurre al arrancar, la preferencia se persiste en `screen_capture.json`, el estado es honesto, existe reserva automática a «Mayús + Impr Pant» con aviso explícito, la preferencia heredada se transfiere una sola vez y la vista «Capturador» vuelve a la barra lateral. Evidencia en VALIDATION.md, comprobada sobre la instancia de desarrollo.

Pendiente y no atribuible a este cierre: la comprobación en la instalación habitual exige recompilar e instalar, y la pulsación física del atajo por parte de Biglex. No se publica release ni se sustituye la instalación en este ciclo.
