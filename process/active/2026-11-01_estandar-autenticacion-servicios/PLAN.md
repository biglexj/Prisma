# Estándar de Autenticación y Servicios Conectados — Plan

- Estado: `DRAFT`
- Fecha: `2026-11-01`
- Proyecto: `Prisma`
- Documento Core de referencia: `Docs/features/authentication/authentication-baseline.md` y `Docs/features/media/connected-media-services.md`

## Objetivo

Establecer un estándar unificado y reusable de autenticación cliente (OAuth 2.0 PKCE con esquema URI `prisma://auth/callback` y respaldo por Device Code) y conectar exclusivamente dos servicios clave con la identidad de Biglex J:
1. **Letras**: Aportes anónimos sin login; aportes con autoría de usuario y seguimiento con sesión activa.
2. **Aurora Wallpapers**: Exploración y descarga pública sin login; desbloqueo de versiones VIP, acceso a contenido +18 (según reglas y permisos de la cuenta) y subida comunitaria con sesión activa.

## Modelo de Experiencia (Anónimo vs. Autenticado)

| Capacidad | Sin Iniciar Sesión (Anónimo / Público) | Con Sesión Iniciada (Usuario Biglex J) |
|---|---|---|
| **Aportes de Letras** | Aporte anónimo libre (como opera actualmente) | Aportes asociados a tu perfil (`user_id` / nombre) y panel de seguimiento de estado |
| **Aurora Wallpapers (Catálogo)** | Exploración y descarga de wallpapers públicos estándar | Desbloqueo de versiones **VIP** y contenido **+18** (sujeto a cumplimiento de reglas/permisos de la cuenta) |
| **Aurora Wallpapers (Comunidad)** | Solo lectura y descarga | Subida de wallpapers comunitarios al catálogo con autoría |

## Alcance

- Incluye:
  - Estándar de autenticación cliente con navegador del sistema (PKCE), callback por protocolo de enlace profundo `prisma://auth/callback` y respaldo por código de vinculación (`biglexj.com/vincular`).
  - Almacenamiento seguro en bóveda del sistema operativo (`keyring` / DPAPI en Rust) para tokens de refresco y token de acceso en memoria volátil.
  - Servicio 1: Identificación y trazabilidad de aportes de letras cuando la sesión esté activa (preservando el envío anónimo cuando no lo esté).
  - Servicio 2: Aurora Wallpapers con soporte para cabecera de autenticación (`Authorization: Bearer <token>`) en `/api/v1/wallpapers` o `/api/v2/catalog`, visualización de contenido VIP y filtros/desbloqueo +18 (validando `isAuthorized !== false`), y modal para subida comunitaria.
  - Estados de sesión canónicos: `signedOut`, `authenticating`, `active`, `renewing`, `expired`, `networkError`.
- No incluye:
  - Sistema de créditos o compras integradas (los roles VIP se administran desde Aurora/Ecosistema).
  - Almacenamiento de tokens en texto plano o `localStorage`.

## Enfoque

1. **Estándar de Autenticación Core & Rust Infrastructure**:
   - Registro en Windows del protocolo de URI `prisma://auth/callback` (y `prisma-dev://` para entorno local).
   - Servidor/handler de callback PKCE con intercambio seguro de código por tokens ante Supabase/Aurora Auth.
   - Flujo alternativo de Device Code (código alfanumérico temporal visible en UI para autorizar en navegador móvil o web).
   - Almacén en bóveda segura nativa (Keyring) y difusión de estado de sesión a React mediante eventos Tauri.
2. **Servicio de Letras (Lyrics Attribution)**:
   - Preservar envío anónimo si no hay sesión.
   - Si la sesión está activa, inyectar el token de usuario para asociar autoría y habilitar panel de estado de aportes.
3. **Servicio Aurora Wallpapers (Niveles VIP y +18)**:
   - Pasar el token de usuario a la API de Aurora Wallpapers para desbloquear elementos VIP y +18 autorizados según el perfil.
   - Sincronización de favoritos del usuario y diálogo para subida comunitaria de wallpapers.

## Criterios de finalización

- [ ] Estándar documentado y compatible con las reglas de `Docs/features/authentication`.
- [ ] Flujo de login por navegador con PKCE y retorno a `prisma://auth/callback` verificado en Windows.
- [ ] Flujo de respaldo con código de dispositivo (`biglexj.com/vincular`) operativo ante bloqueos de protocolo.
- [ ] Tokens almacenados con seguridad en la bóveda del sistema operativo; cierre de sesión revoca credenciales.
- [ ] Aporte anónimo funcional sin sesión; aporte con autoría verificado con sesión activa.
- [ ] Desbloqueo de wallpapers VIP y +18 comprobado para cuentas con permisos válidos.
- [ ] Subida comunitaria de wallpapers funcional.

## Autorización

- [x] Alcance autorizado por Biglex: corregir autenticación y redirecciones de Prisma/Prisma Dev, contrastar Intelligence/Hub y promover el componente reutilizable a Core. Sin publicación ni cambio remoto de permisos.

## Ajuste acotado del 2 de noviembre de 2026

Cuenta disponible sin interruptor global; Letras y Wallpapers independientes, conservando la elección anterior al migrar. Servidor personalizado secundario y exclusivo del catálogo. Perfil de presentación desde public.users por el UUID autenticado, igual que la web; no crear cuentas ni emparejarlas por correo. Consulta con token del usuario y clave pública, respetando RLS; no modifica permisos. Implementación y revisión locales, sin publicar. Device Code, favoritos y subida comunitaria siguen fuera de este ajuste.
