# Estándar de Autenticación y Servicios Conectados — Validación

- Estado: `PENDING`

## Comprobaciones

- [ ] V01 — Agente — Comprobar registro del esquema `prisma://auth/callback` en Windows sin solicitar elevación de permisos (HKCU). Esperado: URL reconocida por el sistema operativo.
- [ ] V02 — Agente — Comprobar flujo de login PKCE en navegador y retorno de tokens a la aplicación. Esperado: sesión pasa a `active` y persiste en Keyring.
- [ ] V03 — Agente — Comprobar flujo alternativo por Device Code. Esperado: vinculación exitosa sin depender del esquema URI.
- [ ] V04 — Agente — Comprobar aporte de letras en modo anónimo (sin login). Esperado: el envío sigue siendo admitido sin requerir credenciales obligatorias.
- [ ] V05 — Agente — Comprobar aporte de letras con sesión iniciada. Esperado: payload incluye token de usuario y el servidor registra la autoría con el `user_id` del colaborador.
- [ ] V06 — Agente — Comprobar catálogo de Aurora Wallpapers sin login. Esperado: visualización y descarga de wallpapers públicos normales; items VIP y +18 bloqueados o filtrados.
- [ ] V07 — Agente — Comprobar catálogo de Aurora Wallpapers con cuenta VIP / +18 autorizada. Esperado: elementos VIP y +18 accesibles y descargables (`isAuthorized === true`).
- [ ] V08 — Agente — Comprobar subida comunitaria de wallpapers con sesión activa. Esperado: envío completado y en cola de moderación.
- [ ] V09 — Tester — Comprobar cierre de sesión local y revocación en servidor. Esperado: tokens eliminados de memoria y bóveda segura; sesión vuelve a `signedOut` y catálogo vuelve a modo público estándar.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
