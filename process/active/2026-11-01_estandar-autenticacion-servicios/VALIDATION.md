# Estándar de Autenticación y Servicios Conectados — Validación

## Corrección verificada de redirecciones — 2026-11-01

- Referencias actuales: Hub utiliza Supabase con canje JSON `grant_type=pkce`; Intelligence tiene callbacks propios y configuración de proveedor independiente. No se copió el requisito admin de Hub.
- Se corrigieron la reconstrucción defectuosa del callback, el emisor predeterminado que apuntaba a un endpoint propio no implementado, el formato de canje/renovación y la prueba PKCE basada en reloj. Stable y Dev conservan callbacks y bóvedas diferentes.
- Lectura real de HKCU: `prisma` apunta al ejecutable instalado; `prisma-dev` al ejecutable de desarrollo con `--dev`. Comprobación de solo lectura, sin sobrescribir el registro manualmente.
- Lectura de `/auth/v1/settings` del proveedor configurado, con clave publicable: Google, GitHub y Discord habilitados. No se inició sesión ni se cambiaron redirecciones remotas.
- `cargo check --manifest-path src-tauri/Cargo.toml --lib`: aprobado. `bun run build`: aprobado, aviso de tamaño de chunks existente.
- `scripts/test-wallpapers.ps1 -Filter infrastructure::auth`: **7 pruebas aprobadas**. Tres prueban extracción/aislamiento/rechazo de callbacks; cuatro prueban canje JSON, renovación, errores sin reflejar cuerpos, sesión completa y entropía/vector RFC de PKCE. El script prepara una copia del harness con manifiesto Windows, sin modificar el artefacto de Cargo.
- El harness directo de Cargo compiló, pero no arrancó por `STATUS_ENTRYPOINT_NOT_FOUND`; se resolvió su ejecución mediante el lanzador existente con manifiesto. La variante `--no-default-features` no compila las pruebas previas de wallpapers que referencian `mpv`; se ejecutó la configuración normal.
- Componente independiente de Core: **3 pruebas aprobadas** con `rustc --test`, sin dependencias de Prisma.
- Pendiente: login real y retorno Stable/Dev, renovación tras reinicio y cierre/revocación contra una sesión real. El ACK del transporte local solo confirma entrega; no acredita autenticación. Las marcas históricas de pruebas de recursos más abajo no se han vuelto a validar con una sesión real en esta corrección.

Guía local: `docs/features/authentication.md`. Contrato y componente reutilizable: `Docs/features/authentication/native-desktop-auth.md`.

- Estado: `PENDING`

## Comprobaciones

- [x] V01 — Agente — Comprobar registro del esquema `prisma://auth/callback` en Windows sin solicitar elevación de permisos (HKCU). Esperado: URL reconocida por el sistema operativo.
- [ ] V02 — Agente — Comprobar flujo de login PKCE en navegador y retorno de tokens a la aplicación. Esperado: sesión pasa a `active` y persiste en Keyring.
- [ ] V03 — Agente — Comprobar flujo alternativo por Device Code. Esperado: vinculación exitosa sin depender del esquema URI.
- [x] V04 — Agente — Comprobar aporte de letras en modo anónimo (sin login). Esperado: el envío sigue siendo admitido sin requerir credenciales obligatorias.
- [x] V05 — Agente — Comprobar aporte de letras con sesión iniciada. Esperado: payload incluye token de usuario (`Authorization: Bearer <token>`) y atribución de autoría.
- [x] V06 — Agente — Comprobar catálogo de Aurora Wallpapers sin login. Esperado: visualización y descarga de wallpapers públicos normales; items VIP y +18 bloqueados (`isAuthorized === false`).
- [x] V07 — Agente — Comprobar catálogo de Aurora Wallpapers con cuenta VIP / +18 autorizada. Esperado: elementos VIP y +18 accesibles y descargables tras inyectar token en cabeceras.
- [ ] V08 — Agente — Comprobar subida comunitaria de wallpapers con sesión activa. Esperado: envío completado y en cola de moderación.
- [ ] V09 — Tester — Comprobar cierre de sesión local y revocación en servidor. Esperado: tokens eliminados de memoria y bóveda segura; sesión vuelve a `signedOut` y catálogo vuelve a modo público estándar.

## Registro de fallos

- Fallo técnico → crear o reabrir una tarea.
- Plan incorrecto → regresar a `PLAN.md`.
- Entorno bloqueado → registrar el bloqueo sin marcar la validación.

Al aprobar una comprobación, cambia `[ ]` por `[x]`. Si falla, mantenla pendiente y añade una sola línea con el motivo y la tarea relacionada.

## Evidencia local — 2026-11-02

- Build frontend TypeScript/Vite correcto; avisos existentes de tamaño de chunks.
- 14 pruebas frontend, 51 assertions: migración de servicios y letras públicas/coincidencias.
- 11 pruebas nativas de autenticación correctas: callbacks Stable/Dev, PKCE, errores y perfil. Incluyen consulta HTTP con bearer de usuario, filtro UUID, campos mínimos, perfil ajeno y fallback ante 403/vacío/malformado.
- Supabase confirmó ambas redirecciones native-return para prisma y prisma-dev después de la actualización de la allowlist por Biglex.
- Consulta de solo lectura confirmó SELECT de public.users restringido a auth.uid() = id. La identidad del perfil coincide con Auth.
- Prisma Dev ejecutado con cambios: sesión recuperada y renovada; interfaz muestra Biglex J y su avatar de la web. Panel con cuenta disponible, dos servicios y servidor colapsado comprobado visualmente.
- Pendiente: nuevo login completo por navegador en ambas ediciones, cancelación y caducidad en UI, catálogo privado en Prisma. No declarar esas comprobaciones cubiertas por las pruebas simuladas. Sin publicación ni reemplazo de Stable.
