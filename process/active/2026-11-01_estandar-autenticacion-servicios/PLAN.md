# Estándar de Autenticación y Servicios Conectados — Plan

- Estado: `DRAFT`
- Fecha: `2026-11-01`
- Proyecto: `Prisma`
- Documento Core de referencia: `Docs/features/authentication/authentication-baseline.md`

## Objetivo

Establecer un estándar unificado y reusable de autenticación cliente (OAuth 2.0 PKCE con esquema URI `prisma://auth/callback` y respaldo por Device Code) y conectar tres servicios clave con la identidad de Biglex J: atribución de aportes de letras, acceso opcional a música/streams personales y sincronización con subida comunitaria de fondos vivos.

## Alcance

- Incluye:
  - Estándar de autenticación cliente con navegador del sistema (PKCE), callback por protocolo de enlace profundo `prisma://auth/callback` y respaldo por código de vinculación (`biglexj.com/vincular`).
  - Almacenamiento seguro en bóveda del sistema operativo (`keyring` / DPAPI en Rust) para tokens de refresco y token de acceso en memoria volátil.
  - Servicio 1: Identificación y trazabilidad de aportes de letras (asociación de autoría a `user_id`, historial de estado de revisiones y visualización pública del colaborador).
  - Servicio 2: Catálogo de música pública y streams personales del usuario en Prisma, estrictamente opcional con interruptor de desactivación para evitar sobrecarga del servidor y respetar la filosofía local-first.
  - Servicio 3: Catálogo de fondos vivos de Aurora con favoritos del usuario y diálogo para subida comunitaria de wallpapers.
  - Estados de sesión canónicos: `signedOut`, `authenticating`, `active`, `renewing`, `expired`, `networkError`.
- No incluye:
  - Sistema de créditos, cobros ni pasarelas de facturación (postergado para fases posteriores).
  - Subida directa de música a los servidores desde Prisma (la subida musical se conserva exclusivamente en el portal web de Aurora).
  - Almacenamiento de tokens en texto plano, bases de datos no cifradas o `localStorage`.

## Enfoque

1. **Estándar de Autenticación Core & Rust Infrastructure**:
   - Registro en Windows del protocolo de URI `prisma://auth/callback` (y `prisma-dev://` para entorno local).
   - Servidor/handler de callback PKCE con intercambio seguro de código por tokens ante Supabase/Aurora Auth.
   - Flujo alternativo de Device Code (código alfanumérico temporal visible en UI para autorizar en navegador móvil o web).
   - Almacén en bóveda segura nativa (Keyring) y difusión de estado de sesión a React mediante eventos Tauri.
2. **Servicio de Letras (Lyrics Attribution)**:
   - Migrar el envío anónimo de letras para firmar con token de usuario autenticado cuando la sesión esté activa.
   - Visualización de autoría y lista de aportes propios pendientes/aprobados.
3. **Servicio de Música y Streams Personales (Opcional)**:
   - Consulta de obras y enlaces de audio pertenecientes al usuario en Biglex J / Aurora.
   - Interruptor global de sincronización ("Servicios conectados / Música remota") desactivado por defecto o conmutador claro.
4. **Servicio de Fondos Vivos Comunitarios**:
   - Sincronización de wallpapers favoritos y modal adaptado de Aurora para subida de fondos comunitarios.

## Criterios de finalización

- [ ] Estándar documentado y compatible con las reglas de `Docs/features/authentication`.
- [ ] Flujo de login por navegador con PKCE y retorno a `prisma://auth/callback` verificado en Windows.
- [ ] Flujo de respaldo con código de dispositivo (`biglexj.com/vincular`) operativo ante bloqueos de protocolo.
- [ ] Tokens almacenados con seguridad en la bóveda del sistema operativo; cierre de sesión revoca credenciales.
- [ ] Aportes de letras asociados al usuario autenticado.
- [ ] Reproducción de música remota propia con interruptor independiente de desactivación.
- [ ] Subida de fondos vivos comunitarios funcional sin comprometer subidas de música.

## Autorización

- [ ] Plan aprobado para ejecución.
