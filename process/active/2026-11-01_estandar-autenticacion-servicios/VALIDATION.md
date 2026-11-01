# Estándar de Autenticación y Servicios Conectados — Validación

- Estado: `PENDING`

## Comprobaciones

- [ ] V01 — Agente — Comprobar registro del esquema `prisma://auth/callback` en Windows sin solicitar elevación de permisos (HKCU). Esperado: URL reconocida por el sistema operativo.
- [ ] V02 — Agente — Comprobar flujo de login PKCE en navegador y retorno de tokens a la aplicación. Esperado: sesión pasa a `active` y persiste en Keyring.
- [ ] V03 — Agente — Comprobar flujo alternativo por Device Code. Esperado: vinculación exitosa sin depender del esquema URI.
- [ ] V04 — Agente — Comprobar envío de letras con sesión iniciada. Esperado: payload incluye token de usuario y el servidor registra la autoría en lugar de anonimato.
- [ ] V05 — Agente — Comprobar interruptor de música y streams personales. Esperado: apagado no realiza peticiones remotas de música; encendido carga el catálogo del usuario.
- [ ] V06 — Agente — Comprobar subida de fondos comunitarios. Esperado: fondo cargado y pendiente de revisión en catálogo sin permitir subidas de música no autorizadas.
- [ ] V07 — Tester — Comprobar cierre de sesión local y revocación en servidor. Esperado: tokens eliminados de memoria y bóveda segura; sesión vuelve a `signedOut`.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
