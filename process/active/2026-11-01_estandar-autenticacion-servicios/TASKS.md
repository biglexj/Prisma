# Estándar de Autenticación y Servicios Conectados — Tareas

- Estado: `IN_PROGRESS`

## Ejecución

### Fase 1: Estándar y Arquitectura de Autenticación
- [x] T01 — Diseñar el módulo Rust de sesión e infraestructura PKCE en `src-tauri/src/infrastructure/auth/` con almacenamiento seguro en Keyring (Windows Credential Manager / DPAPI).
- [x] T02 — Registrar el esquema de URL profundo `prisma://auth/callback` en Windows (`HKCU\Software\Classes`) y conectar con el listener de instancia única.
- [ ] T03 — Implementar el endpoint o flujo de respaldo Device Code (`/api/v1/auth/device`) para vincular mediante código corto de verificación.
- [x] T04 — Construir el hook y UI en React (`useAuthSession`, tarjeta de perfil y login en `AuroraSettingsPanel` con avatar, estados de sesión y cierre de sesión).

### Fase 2: Atribución en el Servicio de Letras
- [x] T05 — Mantener el envío anónimo de letras cuando no hay sesión iniciada.
- [x] T06 — Conectar `TrackLyricsService` y el modal de aportes de letras para inyectar `Authorization: Bearer <token>` cuando la sesión esté activa, asociando autoría al usuario.
- [ ] T07 — Añadir vista/panel de «Mis aportes de letras» que consulte los envíos realizados por el usuario y su estado de revisión en Biglex J.

### Fase 3: Aurora Wallpapers (VIP, +18 y Subida Comunitaria)
- [x] T08 — Adaptar el cliente de Aurora Wallpapers (`WallpapersView.tsx` / API client) para enviar el token de sesión en las peticiones de catálogo.
- [x] T09 — Habilitar la visualización y descarga de versiones VIP y wallpapers +18 según los permisos (`isAuthorized !== false`) y preferencias de la cuenta.
- [ ] T10 — Integrar sincronización de favoritos y crear diálogo/modal para subida comunitaria de wallpapers hacia Aurora.

### Fase 4: Validación y Cierre
- [ ] T11 — Ejecutar pruebas automatizadas de estados de sesión, tokens expirados y revocación.
- [x] T12 — Documentar el estándar de autenticación nativa y componente Rust de callbacks en Core (`Docs/features/authentication/`) para su reutilización en futuras apps del ecosistema.
- [ ] T13 — Preparar la validación y aprobación final.

Las pruebas no se documentan aquí. Deben registrarse en `VALIDATION.md`.

## Corrección de redirecciones y adaptador

- [x] Conservar el callback original, validar la ruta exacta y separar Stable/Dev conforme a los argumentos de ejecución.
- [x] Usar por defecto el proveedor real, configuración pública distribuible y formato PKCE/renovación compatible con Supabase.
- [x] Sustituir la prueba basada en reloj por entropía criptográfica y recuperar el retorno en la instancia que inició el flujo.
- [x] Exigir sesión verificada antes de habilitar acceso y evitar afirmar permisos VIP por tener sesión.
- [ ] Verificar con Biglex un login real de cada edición y su retorno completo. No equivale a compilación o prueba HTTP simulada.
