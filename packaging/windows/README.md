# Empaquetado de Prisma para Windows (Inno Setup)

Instalador EXE propio, con pantalla única de entrada (UI "Biglex Modern 2.0"),
tema claro/oscuro automático e integración en el flujo de build del proyecto.

## Archivos

| Archivo | Origen | Descripción |
|---|---|---|
| `setup.iss` | manual (adaptado de `BiglexModern.iss`) | Empaquetado, payload, `[Registry]` y eventos de integración. |
| `BiglexModernUI.iss` | copia de la plantilla | Presentación y validación de la pantalla de entrada (2.0). |
| `PrismaInstallerUI.iss` | propio de Prisma | Botón principal turquesa, navegación regular de 26 px, selectores de marca, paquete genérico y cierre con confirmación. |
| `BiglexModern.iss` | copia de la plantilla | Plantilla base conservada como referencia del repo. |
| `identity.iss` | manual | Nombre, `AppId`, ejecutable, carpeta, icono y tema de Prisma. |
| `version.iss` | **generado** | `#define MyAppVersion` con la versión real del build. |
| `associations.iss` | **generado** | Sección `[Registry]` con las extensiones de `src-tauri/tauri.conf.json` (`bundle.fileAssociations`). |
| `associations.pas` | **generado** | Datos extensión → ProgID para respaldar/restaurar la asociación previa. |
| `icon.ico` | **generado** | Copia de `src-tauri/icons/icon.ico` (logo del asistente y del instalador). |
| `MIGRATION.md` | manual | Transición desde el instalador NSIS de Tauri. |

Los archivos generados se reescriben en cada build a partir de `package.json` y
`src-tauri/tauri.conf.json`: no se editan a mano.

Para 2.0.0, `template-lock.json` fija por SHA-256 la plantilla ya revisada de Prisma.
El builder comprueba su version y hash antes de empaquetar, y conserva las demas
invariantes de instalacion. Asi, una modificacion concurrente de la plantilla
compartida no cambia el candidato aprobado. Antes de la proxima version, revisar
la plantilla compartida y actualizar o retirar expresamente esta fijacion.

## Build

```powershell
# Build completo: app con Tauri (sin bundle NSIS) + instalador Inno Setup
powershell -ExecutionPolicy Bypass -File .\scripts\packaging\Build-Installer.ps1

# Solo el instalador (reutiliza src-tauri\target\release\prisma.exe)
powershell -ExecutionPolicy Bypass -File .\scripts\packaging\Build-Installer.ps1 -SkipAppBuild

# Variante de tema claro (verificación visual, no forma parte del release)
powershell -ExecutionPolicy Bypass -File .\scripts\packaging\Build-Installer.ps1 -SkipAppBuild -CompileLightVariant
```

También queda expuesto como script de `package.json`:

```bash
bun run build:installer   # build completo
bun run tauri:build       # app + instalador (usado por el flujo de release)
```

El instalador compilado queda en `src-tauri/target/inno/output/` y se copia a
`release/Prisma_<versión>-setup.exe`, que es el nombre que espera
`scripts/release/build-release.ps1` para publicar el asset en GitHub Releases.

## Identidad

- `AppId`: `{9F3C5A7E-4D2B-4E6F-9A1C-8B5D3E2F7A04}` — estable entre versiones, por
  lo que una versión nueva actualiza la anterior.
- Instalación por usuario: `%LOCALAPPDATA%\Programs\Prisma`, sin UAC
  (`PrivilegesRequired=lowest`).
- Tema: `modern dynamic` (claro/oscuro automático según Windows). Para la
  variante clara de prueba: `modern light`.

## Compilación directa (sin script de build)

```powershell
& "D:\Proyectos\biglexj\Scripts\tools\InnoSetup\ISCC.exe" setup.iss
& "D:\Proyectos\biglexj\Scripts\tools\InnoSetup\ISCC.exe" /DMyAppTheme=light setup.iss
```
