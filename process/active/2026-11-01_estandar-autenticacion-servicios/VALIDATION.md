# Estándar de Autenticación y Servicios Conectados — Validación

- Estado: `PENDING`

## Comprobaciones

- [ ] V01 — Agente — Comprobar registro del esquema `prisma://auth/callback` en Windows sin solicitar elevación de permisos (HKCU). Esperado: URL reconocida por el sistema operativo.
- [ ] V02 — Agente — Comprobar flujo de login PKCE en navegador y retorno de tokens a la aplicación. Esperado: sesión pasa a `active` y persiste en Keyring.
- [ ] V03 — Agente — Comprobar flujo alternativo por Device Code. Esperado: vinculación exitosa sin depender del esquema URI.
- [ ] V04 — Agente — Comprobar envío de letras con sesión iniciada. Esperado: payload incluye token de usuario y el servidor registra la autoría en lugar de anonimato.
- [ ] V05 — Agente — Comprobar catálogo y subida de Aurora Wallpapers. Esperado: favoritos sincronizados y wallpaper comunitario enviado al catálogo con moderación en backend.
- [ ] V06 — Tester — Comprobar cierre de sesión local y revocación en servidor. Esperado: tokens eliminados de memoria y bóveda segura; sesión vuelve a `signedOut`.
- [ ] V07 — Tester — Comprobar que Prisma no emite peticiones ni expone paneles de streaming de música remota. Esperado: la música se mantiene 100% local en Prisma y remota en la web de Aurora.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.
