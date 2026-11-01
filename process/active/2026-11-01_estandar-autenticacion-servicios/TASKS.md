# Estándar de Autenticación y Servicios Conectados — Tareas

- Estado: `PENDING`

## Ejecución

### Fase 1: Estándar y Arquitectura de Autenticación
- [ ] T01 — Diseñar el módulo Rust de sesión e infraestructura PKCE en `src-tauri/src/infrastructure/auth/` con almacenamiento seguro en Keyring.
- [ ] T02 — Registrar el esquema de URL profundo `prisma://auth/callback` en Windows (`HKCU\Software\Classes`) y conectar con el listener de instancia única.
- [ ] T03 — Implementar el endpoint o flujo de respaldo Device Code (`/api/v1/auth/device`) para vincular mediante código corto de verificación.
- [ ] T04 — Construir el hook y UI en React (`useAuthSession`, diálogo/botón en la barra lateral o ajustes con estado del perfil, avatar y cierre de sesión).

### Fase 2: Atribución en el Servicio de Letras
- [ ] T05 — Conectar `TrackLyricsService` y el modal de aportes de letras para inyectar la cabecera `Authorization: Bearer <token>` cuando la sesión esté activa.
- [ ] T06 — Añadir vista/panel de «Mis aportes de letras» que consulte los envíos realizados por el usuario y su estado de revisión en Biglex J.

### Fase 3: Aurora Wallpapers (Catálogo y Subida Comunitaria)
- [ ] T07 — Integrar sincronización de favoritos en el catálogo de Aurora Wallpapers (`/api/v1/wallpapers` o `/api/v2/catalog`).
- [ ] T08 — Crear diálogo/modal de subida de wallpapers comunitarios hacia el catálogo público de Aurora.

### Fase 4: Validación y Cierre
- [ ] T09 — Ejecutar pruebas automatizadas de estados de sesión, tokens expirados y revocación.
- [ ] T10 — Documentar el estándar de autenticación en Core (`Docs/features/authentication/`) para su reutilización en futuras apps del ecosistema.
- [ ] T11 — Preparar la validación y aprobación final.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
