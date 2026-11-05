# Contrato de publicación de Prisma (GitHub + Aurora)

- Ámbito: cómo Prisma prepara y publica una versión oficial.
- Puente: la política de ramas, inmutabilidad y sanitización vive en Core ([protocolo de lanzamiento](../../../Docs/global/releases/protocolo_lanzamiento_actualizacion.md), [base de lanzamientos](../../../Docs/global/releases/release-baseline.md)); este documento describe únicamente la implementación propia de Prisma.

## Separación entre preparación y publicación

Mise es la interfaz única de comandos:

| Tarea | Efecto | Publica |
|---|---|---|
| `mise release` | Genera el instalador Inno Setup y los artefactos locales en `release/` | No |
| `mise publish` | Publica en GitHub Releases y sincroniza la ficha en Aurora | Sí, con preflight |

- `mise release` invoca `scripts/release/build-release.ps1 -LocalOnly -SkipTests`: compila, verifica el SHA-256 y escribe `release/<instalador>.sha256` y `release/SHA256SUMS.txt`. No consulta ni modifica el remoto.
- `mise publish` invoca el mismo script **sin** `-LocalOnly`, que es la única vía de publicación a GitHub y a Aurora. `mise publish github` omite la sincronización con Aurora (`-SkipAuroraUpload`).
- `mise publish --plan` y `mise publish --check` no publican ni instalan: solo muestran el plan o verifican requisitos locales y remotos en modo de solo lectura.
- El mensaje público es `RELEASE_MESSAGE.md` (UTF-8, sin rutas locales). El historial de cambios es `RELEASE_NOTES.md`.

## Flujo de publicación (GitHub → Aurora)

1. **Compilar** el instalador Tauri v2 (`.exe`) localmente mediante Inno Setup (`scripts/packaging/Build-Installer.ps1`).
2. **Publicar el binario en GitHub Releases** (`gh release create`). El binario vive exclusivamente en GitHub.
3. **Calcular el SHA-256** del instalador.
4. **Notificar a Aurora** (`PUT /api/admin/developer-apps` y `POST /api/admin/developer-app-releases`) con la URL del asset en GitHub como `downloadUrl`, más `versionName`, `versionCode`, `releaseNotes` y `sha256Checksum`. Aurora solo recibe metadata; **no** se sube el EXE a Cloudflare R2.
5. **Verificar** la publicación: lectura de la release en GitHub (asset, tamaño, digest y descarga pública) y lectura de la ficha en Aurora (`versionCode`, `sha256Checksum`, `downloadUrl`, `releaseNotes` y estado `published`).

## `user_id` canónico del ecosistema Aurora

`e7918151-8a32-4413-be32-a35866e2fb4e` (`biglexj`).

## Rutas y credenciales

- La credencial de publicación de Aurora se toma de `SUPABASE_SERVICE_ROLE_KEY` en el archivo `.env` del frontend de Aurora, localizado en el repositorio hermano `../Aurora---Blog/frontend/.env` respecto a la raíz de Prisma. La ruta puede sobrescribirse con la variable de entorno `AURORA_BLOG_ROOT`.
- Los scripts no contienen rutas absolutas al disco local: la raíz del repositorio se resuelve desde la ubicación del propio script.

## Documentación de referencia

- [Base de lanzamientos](../../../Docs/global/releases/release-baseline.md) — versionado, artefactos e inmutabilidad.
- [Protocolo oficial de lanzamiento](../../../Docs/global/releases/protocolo_lanzamiento_actualizacion.md) — política de ramas, verificación remota y ejecución centralizada.
- [Documentación de Aurora](../../../Aurora---Blog/docs/README.md) — índice de la documentación del portal que recibe la metadata.
- [Estándar de Release Message para la web](../../../Docs/global/releases/web-release-message-standard.md) — contrato del mensaje público.
- [Estándar de comandos mediante Mise](../../../Docs/global/architecture/mise-command-standard.md) — interfaz de tareas.
