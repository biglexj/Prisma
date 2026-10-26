# Migración del instalador de Windows: NSIS → Inno Setup

Prisma dejó de empaquetarse con el instalador **NSIS** que genera Tauri v2 y ahora
usa un instalador **Inno Setup 6.7** propio (`packaging/windows/setup.iss`, UI
"Biglex Modern 2.0").

Los dos instaladores registran las **mismas asociaciones de archivo** (mismos
ProgID: `Archivo de Audio`, `Archivo de Vídeo`, `Archivo de Imagen`,
`Documento Markdown`, `Documento de Texto`, `Documento PDF o Libro`,
`Archivo de Letras o Subtítulos`, `Archivo Comprimido`) en
`HKCU\Software\Classes`, pero **no comparten la clave de desinstalación** ni la
carpeta de instalación.

## Procedimiento para el usuario final

1. Cerrar Prisma (icono de la bandeja o ventana principal).
2. Desinstalar la versión NSIS:
   - *Configuración → Aplicaciones → Prisma → Desinstalar*, o
   - ejecutar directamente `%LOCALAPPDATA%\Prisma\uninstall.exe`.
3. Ejecutar `Prisma_<versión>-setup.exe`.
4. Al terminar, Prisma queda en *Agregar o quitar programas* con su desinstalador
   (`unins000.exe` en `%LOCALAPPDATA%\Programs\Prisma`) y registra las
   asociaciones de archivo.

## Qué registra cada instalador

| | NSIS (Tauri v2) | Inno Setup (actual) |
|---|---|---|
| Carpeta de instalación | `%LOCALAPPDATA%\Prisma` | `%LOCALAPPDATA%\Programs\Prisma` (editable en la pantalla inicial) |
| Desinstalador | `%LOCALAPPDATA%\Prisma\uninstall.exe` | `%LOCALAPPDATA%\Programs\Prisma\unins000.exe` |
| Clave de desinstalación | `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Prisma` | `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\{9F3C5A7E-4D2B-4E6F-9A1C-8B5D3E2F7A04}_is1` |
| Identidad de actualización | `com.biglexj.prisma` (Tauri) | `AppId` `{9F3C5A7E-4D2B-4E6F-9A1C-8B5D3E2F7A04}` (estable entre versiones) |
| Asociaciones | `HKCU\Software\Classes\.<ext>` → ProgID | Igual: mismo ProgID, mismo icono y mismo comando `prisma.exe "%1"` |
| Acceso directo | Menú Inicio (`Prisma\Prisma.lnk`) | Menú Inicio (`Prisma.lnk`) + escritorio opcional (`/TASKS=desktopicon`) |
| WebView2 Runtime | Descarga el bootstrapper oficial si no está instalado | Idéntico: descarga el bootstrapper oficial con `curl.exe` si no está instalado |

El `AppId` de Inno es estable, así que **las versiones nuevas actualizan la
anterior** en lugar de crear una instalación paralela.

### Diferencias técnicas menores

- El comando de apertura de Inno entrecomilla la ruta del ejecutable
  (`"C:\...\prisma.exe" "%1"`); NSIS la escribía sin comillas
  (`C:\...\prisma.exe "%1"`). Ambas formas funcionan en Windows; la entrecomillada
  es la correcta si la ruta contiene espacios.
- Inno registra las extensiones en `HKCU\Software\Classes` igual que NSIS en modo
  `currentUser`, pero **borra el valor por defecto de cada extensión al
  desinstalar** (NSIS lo dejaba apuntando a un ProgID inexistente).
- La carpeta de instalación es distinta (`%LOCALAPPDATA%\Programs\Prisma`), de
  modo que ambas instalaciones pueden coexistir y cada una se desinstala sin
  tocar la otra.

## Coexistencia NSIS + Inno

Las dos instalaciones pueden coexistir porque viven en carpetas distintas, pero
**comparten el registro de asociaciones**:

- Instalar Inno **sobre** una instalación NSIS existente sobrescribe las claves
  de asociación (mismos ProgID): no quedan entradas duplicadas. Lo que sí
  permanece es la entrada de desinstalación de NSIS en *Agregar o quitar
  programas*, hasta que el usuario desinstale la versión NSIS.
- Desinstalar **Inno** borra las claves de asociación que creó (los ProgID de
  Prisma) y restaura la asociación previa de cada extensión si la había. La
  instalación NSIS queda intacta en disco, pero sus accesos directos y
  asociaciones dejan de funcionar hasta reinstalar o ajustar la versión NSIS.
- Desinstalar **NSIS** después de instalar Inno borra los mismos ProgID
  compartidos, con el mismo efecto sobre la instalación de Inno.

Por eso el orden recomendado es: **desinstalar NSIS primero y después instalar
el EXE de Inno**. Ninguno de los dos desinstaladores borra datos de usuario ni
instalaciones ajenas: Inno solo elimina los archivos que él mismo instaló.

## Diferencia importante: restauración de asociaciones

El instalador NSIS guardaba la asociación previa de cada extensión en un valor
`*_backup`, pero no la restauraba al desinstalar (dejaba la extensión apuntando a
un ProgID inexistente).

El instalador de Inno sí la restaura:

- Al instalar, guarda el valor anterior de cada extensión en
  `HKCU\Software\Biglex\Prisma\FileAssocBackup`.
- Al desinstalar, borra la asociación de Prisma y vuelve a escribir el valor
  previo (si lo había). La carpeta de respaldo se elimina al terminar.

## Manifiestos winget

**No existen manifiestos winget de Prisma en este repositorio** (no hay carpeta
`winget/`, ni archivos `*.yaml` de manifiesto, ni referencias a `winget` en el
código). Si aparece un manifiesto winget en otro repositorio del ecosistema, el
cambio a aplicar es:

- `InstallerType`: `nsis` → `exe`
- `InstallerSha256`: el hash del nuevo `Prisma_<versión>-setup.exe`
- nombre del instalador: `Prisma_<versión>-setup.exe` (sin cambio)
