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

### Fase 3: Música Pública y Streams Personales (Opcional)
- [ ] T07 — Implementar cliente de consulta de música y streams propios en Aurora/Biglex J con autenticación de usuario.
- [ ] T08 — Añadir interruptor explícito de activación/desactivación en Ajustes y en la vista Música para controlar el consumo de red y no sobrecargar el servidor.

### Fase 4: Fondos Vivos Comunitarios
- [ ] T09 — Integrar sincronización de favoritos de Wallpapers con el backend de Aurora.
- [ ] T10 — Crear diálogo/modal de subida de fondos comunitarios hacia el catálogo público de Aurora (respetando que la música permanece restringida a la web).

### Fase 5: Validación y Cierre
- [ ] T11 — Ejecutar pruebas automatizadas de estados de sesión, tokens expirados y revocación.
- [ ] T12 — Documentar el estándar de autenticación en Core (`Docs/features/authentication/`) para su reutilización en futuras apps del ecosistema.
- [ ] T13 — Preparar la validación y aprobación final.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.
