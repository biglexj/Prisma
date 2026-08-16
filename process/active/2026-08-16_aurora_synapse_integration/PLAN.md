# Aurora Synapse Protocol — Integración en Prisma — Plan

- Estado: `APPROVED`
- Fecha: `2026-08-16`
- Proyecto: `Prisma`

## Objetivo

Implementar la interoperabilidad completa del ecosistema Aurora Synapse en Prisma (Desktop/Windows), habilitando emisión de presencia LAN (UDP Beacon en puerto 49289), microservidor HTTP receptor de Handoff multimedia y recepción inalámbrica de archivos (puerto 49288), e invocación por Deep Links (`prisma://`).

## Alcance

- Incluye:
  - Módulo nativo Rust `src-tauri/src/features/synapse/`:
    - `beacon.rs`: Emisor periódico de paquetes UDP Broadcast (puerto 49289 cada 6 segundos) con identificación de nodo.
    - `server.rs`: Microservidor HTTP/TCP (puerto 49288) para endpoints `/api/v1/synapse/handoff`, `/api/v1/synapse/upload` y `/api/v1/synapse/status`, además de compatibilidad con raw URI/IPC.
    - `deep_link.rs`: Registro automático del esquema `prisma://` en Windows Registry (`HKCU\Software\Classes\prisma`) y parser de URIs (`prisma://open?path=...&autoplay=true&position=...`).
    - `model.rs`: Tipos de datos serializables para payloads Synapse.
  - Vinculación en `src-tauri/src/lib.rs` (arranque del servidor y beacon en background, despacho en Single-Instance).
  - Integración en frontend `src/app/App.tsx` para responder a eventos `prisma://open-media` con posición en tiempo exacto, y notificación al recibir archivos LAN con refresco de biblioteca.
  - Actualización del perfil en `.agents/rules/core_profile.md` y `ROADMAP.md`.
- No incluye:
  - Transferencia cloud externa (el protocolo es 100% LAN local-first).
  - Modificación de motores de renderizado de vídeo.

## Enfoque

1. Crear módulo `features/synapse/` en Rust con modelos de datos, UDP beacon, servidor HTTP/TCP y registro de esquema Deep Link.
2. Integrar servicios en el ciclo de vida de Tauri (`lib.rs`) y en el manejador de instancia única (`tauri_plugin_single_instance`).
3. Reforzar el frontend en `App.tsx` para admitir `position_ms` / `currentTime` preciso y notificaciones de archivos recibidos.
4. Validar compilación, pruebas de endpoints con scripts/requests y documentación.

## Criterios de finalización

- [x] Beacon UDP transmite periódicamente en `255.255.255.255:49289` con el payload de Prisma.
- [x] Endpoint `POST /api/v1/synapse/handoff` recibe parámetros, resuelve el archivo y reanuda en el milisegundo exacto.
- [x] Endpoint `POST /api/v1/synapse/upload` almacena archivos en `Downloads/Prisma/` con sanitización de nombres.
- [x] Esquema `prisma://` registrado en el registro de Windows y operable vía Single-Instance.
- [x] Compilación y pruebas de verificación superadas con éxito.

## Autorización

- [x] Plan aprobado para ejecución.
