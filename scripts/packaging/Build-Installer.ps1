#requires -Version 5.1
<#
.SYNOPSIS
    Empaquetado de Prisma para Windows con Inno Setup (instalador EXE).

.DESCRIPTION
    Genera los archivos derivados del empaquetado (version.iss, associations.iss,
    associations.pas e icon.ico), compila la app con Tauri sin el bundle NSIS,
    prepara la carpeta de staging con el ejecutable y los recursos (libmpv,
    libunwind, ffmpeg) y compila el instalador con ISCC.

    Antes de invocar ISCC.exe sincroniza la plantilla visual compartida
    (Scripts\tools\inno\BiglexModernUI.iss) y pasa el validador de invariantes
    de empaquetado (Scripts\tools\inno\Check-Packaging.ps1), que aborta la
    compilacion si el arranque post-instalacion vuelve a lanzar la app
    directamente desde el instalador (fallo 0xc00004bc), si el nombre de salida
    lleva el sufijo obsoleto _x64 o si la plantilla visual diverge de la
    compartida.

    El instalador generado se copia a release\Prisma_<version>-setup.exe,
    que es el nombre que espera el flujo de publicacion (scripts/release/build-release.ps1).

.PARAMETER Version
    Version a empaquetar. Por defecto, la de package.json.

.PARAMETER SkipAppBuild
    No recompila la app: reutiliza src-tauri\target\release\prisma.exe.

.PARAMETER SkipCopyToRelease
    No copia el instalador a la carpeta release.

.PARAMETER ForceStale
    Empaqueta aunque el ejecutable sea mas viejo que las fuentes. Solo para
    depurar: publicar asi reintroduce el binario obsoleto.

.PARAMETER ISCCPath
    Ruta al compilador de Inno Setup. Por defecto se busca en
    Scripts\tools\InnoSetup del workspace y luego en el PATH.
#>
param(
    [string]$Version,
    [switch]$SkipAppBuild,
    [switch]$SkipCopyToRelease,
    [switch]$CompileLightVariant,
    # Empaqueta aunque el ejecutable sea mas viejo que las fuentes. Solo para
    # depurar: publicar asi reintroduce el binario obsoleto.
    [switch]$ForceStale,
    [string]$ISCCPath = ''
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$packagingDir = Join-Path $root 'packaging\windows'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-Utf8File {
    param([string]$Path, [string]$Content)
    # Normaliza los finales de linea a CRLF (Windows) sin BOM.
    $normalized = ($Content -replace "`r`n", "`n") -replace "`n", "`r`n"
    [IO.File]::WriteAllText($Path, $normalized, $utf8NoBom)
}

function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments, [string]$Label)
    Write-Host "==> $Label"
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Label falló (código $LASTEXITCODE): $Command $($Arguments -join ' ')" }
}

function Get-Sha256 {
    # Se calcula con .NET y no con Get-FileHash: el hook posttauri:build puede
    # ejecutarse en un entorno donde ese cmdlet no está disponible.
    param([string]$Path)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $stream = [System.IO.File]::OpenRead($Path)
        try { $bytes = $sha.ComputeHash($stream) } finally { $stream.Dispose() }
    } finally { $sha.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

function Write-Step {
    param([string]$Text)
    Write-Host "==> $Text"
}

function Write-Fail {
    param([string]$Text)
    Write-Host "ERROR: $Text" -ForegroundColor Red
    throw $Text
}

# --- Puerta de calidad de empaquetado (validador compartido) -----------------
# La plantilla visual y el arranque post-instalacion son fuente unica del
# workspace. Un [Run] editado a mano que lance la app directamente desde el
# instalador hace que el proceso herede el contexto del instalador y muera con
# 0xc00004bc (STATUS_REDIRECTION_TRUST_FAILURE), asi que el validador compartido
# aborta la compilacion antes de invocar ISCC.exe.
function Resolve-SharedInno {
    $dir = $PSScriptRoot
    for ($i = 0; $i -lt 8; $i++) {
        $candidate = Join-Path $dir 'Scripts\tools\inno'
        if (Test-Path -LiteralPath $candidate) { return $candidate }
        $parent = Split-Path -Parent $dir
        if (-not $parent -or $parent -eq $dir) { break }
        $dir = $parent
    }
    return $null
}

function Sync-SharedTemplate {
    param([string]$SharedDir, [string]$PackagingDir)
    $pinPath = Join-Path $PackagingDir 'template-lock.json'
    if (Test-Path -LiteralPath $pinPath) {
        $pin = Get-Content -LiteralPath $pinPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $appVersion = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
        if ($pin.version -ne $appVersion -or $pin.template -ne 'BiglexModernUI.iss') {
            throw 'Revisa la plantilla fijada antes de compilar una version diferente.'
        }
        $pinnedTemplate = Join-Path $PackagingDir 'BiglexModernUI.iss'
        if ((Get-Sha256 $pinnedTemplate) -ne $pin.sha256) {
            throw 'La plantilla local difiere de la revision aprobada para esta version.'
        }
        $script:usesReviewedTemplate = $true
        Write-Host "==> Plantilla de release verificada: revision $($pin.reviewedCommit)."
        return
    }
    if (-not $SharedDir) { return }
    $src = Join-Path $SharedDir 'BiglexModernUI.iss'
    $dst = Join-Path $PackagingDir 'BiglexModernUI.iss'
    if ((Test-Path -LiteralPath $src) -and (Test-Path -LiteralPath $PackagingDir)) {
        Copy-Item -LiteralPath $src -Destination $dst -Force
        Write-Host '==> Plantilla visual sincronizada con la copia compartida del workspace.'
    }
}

function Assert-PackagingInvariants {
    param([string]$SharedDir, [string[]]$SetupFiles)
    if (-not $SharedDir) {
        Write-Host 'AVISO: no se encontro la carpeta compartida Scripts\tools\inno.' -ForegroundColor Yellow
        Write-Host '       Se omite la validacion de invariantes de empaquetado.' -ForegroundColor Yellow
        return
    }
    $checker = Join-Path $SharedDir 'Check-Packaging.ps1'
    if (-not (Test-Path -LiteralPath $checker)) {
        Write-Host "AVISO: no se encontro $checker. Se omite la validacion." -ForegroundColor Yellow
        return
    }
    # Get-Command puede devolver varias rutas (alias de Store y MSIX): se toma
    # la primera que exista de verdad.
    $shellExe = $null
    foreach ($name in @('pwsh', 'powershell')) {
        foreach ($candidate in @(Get-Command $name -CommandType Application -ErrorAction SilentlyContinue)) {
            if ($candidate.Source -and (Test-Path -LiteralPath $candidate.Source)) {
                $shellExe = $candidate.Source
                break
            }
        }
        if ($shellExe) { break }
    }
    if (-not $shellExe) {
        Write-Host 'AVISO: no se encontro pwsh ni powershell: se omite la validacion.' -ForegroundColor Yellow
        return
    }
    foreach ($setup in $SetupFiles) {
        $checkerArguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $checker, '-SetupIss', $setup)
        # El hash fijado se comprueba arriba; conservar las demas invariantes.
        if ($script:usesReviewedTemplate) { $checkerArguments += '-SkipTemplateCheck' }
        & $shellExe @checkerArguments
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: las invariantes de empaquetado fallan para $setup." -ForegroundColor Red
            Write-Host '       No se compila el instalador. Corrige lo anterior.' -ForegroundColor Red
            exit 1
        }
    }
}

# --- Candado anti-binario-obsoleto ------------------------------------------
# Tauri incrusta dist/ DENTRO del ejecutable. Si el .exe es mas viejo que el
# codigo fuente o que dist/, el instalador empaqueta un binario obsoleto aunque
# se compile "recien" y aunque dist/ este al dia. Regla de Core:
# Docs/global/architecture/command-scripts-standard.md, principio 2.
function Get-NewestWriteTime {
    param([string[]]$Paths)
    $best = $null
    $bestPath = $null
    foreach ($path in $Paths) {
        if (-not (Test-Path -LiteralPath $path)) { continue }
        $item = if (Test-Path -LiteralPath $path -PathType Container) {
            Get-ChildItem -LiteralPath $path -Recurse -File -Force -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending | Select-Object -First 1
        }
        else {
            Get-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        }
        if ($item -and (-not $best -or $item.LastWriteTime -gt $best)) {
            $best = $item.LastWriteTime
            $bestPath = $item.FullName
        }
    }
    return [pscustomobject]@{ Time = $best; Path = $bestPath }
}

function Assert-BinaryFresh {
    param([string]$Exe, [string]$AppRoot, [switch]$Force)
    if (-not (Test-Path -LiteralPath $Exe)) {
        Write-Fail "No se encontro el ejecutable compilado: $Exe`n  Compila la app sin el flag de omision."
    }
    $exeItem = Get-Item -LiteralPath $Exe
    $newest = Get-NewestWriteTime -Paths @(
        (Join-Path $AppRoot 'src'),
        (Join-Path $AppRoot 'src-tauri\src'),
        (Join-Path $AppRoot 'dist'),
        (Join-Path $AppRoot 'src-tauri\Cargo.toml'),
        (Join-Path $AppRoot 'src-tauri\tauri.conf.json'),
        (Join-Path $AppRoot 'src-tauri\build.rs'),
        (Join-Path $AppRoot 'src-tauri\capabilities'),
        (Join-Path $AppRoot 'package.json')
    )
    if (-not $newest.Time) { return }
    if ($exeItem.LastWriteTime -ge $newest.Time) {
        Write-Step "Ejecutable al dia: $($exeItem.LastWriteTime.ToString('dd/MM HH:mm:ss'))"
        return
    }
    $rel = if ($newest.Path) { $newest.Path.Substring($AppRoot.Length).TrimStart('\') } else { '(desconocido)' }
    if ($Force) {
        Write-Host "AVISO: se empaqueta un binario OBSOLETO por -ForceStale." -ForegroundColor Yellow
        Write-Host "       exe $($exeItem.LastWriteTime.ToString('dd/MM HH:mm:ss')) < fuente $($newest.Time.ToString('dd/MM HH:mm:ss')) $rel" -ForegroundColor Yellow
        return
    }
    Write-Fail ("El ejecutable es MAS VIEJO que el codigo fuente:`n" +
                "  ejecutable : $($exeItem.LastWriteTime.ToString('dd/MM HH:mm:ss'))  $Exe`n" +
                "  fuente     : $($newest.Time.ToString('dd/MM HH:mm:ss'))  $rel`n`n" +
                "Tauri incrusta dist/ dentro del ejecutable, asi que un .exe viejo publica`n" +
                "tambien un frontend viejo aunque dist/ este al dia. Vuelve a compilar la app" +
                ", o usa -ForceStale solo para depurar.")
}

# Localiza ISCC.exe sin rutas absolutas: primero la copia del workspace,
# subiendo desde este script; despues el PATH del sistema.
function Resolve-Iscc {
    $dir = $PSScriptRoot
    for ($i = 0; $i -lt 8; $i++) {
        $candidate = Join-Path $dir 'Scripts\tools\InnoSetup\ISCC.exe'
        if (Test-Path -LiteralPath $candidate) { return $candidate }
        $parent = Split-Path -Parent $dir
        if (-not $parent -or $parent -eq $dir) { break }
        $dir = $parent
    }
    $onPath = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }
    return $null
}

# --- 1. Version -------------------------------------------------------------
$package = Get-Content (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$tauri = Get-Content (Join-Path $root 'src-tauri\tauri.conf.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$cargo = Get-Content (Join-Path $root 'src-tauri\Cargo.toml') -Raw
$cargoVersion = [regex]::Match($cargo, '(?m)^version\s*=\s*"([^"]+)"').Groups[1].Value
if (-not $Version) { $Version = [string]$package.version }
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Se requiere una versión SemVer estable (X.Y.Z).' }
if ([string]$package.version -ne $Version -or [string]$tauri.version -ne $Version -or $cargoVersion -ne $Version) {
    throw "Los manifiestos de versión no coinciden: package=$($package.version) tauri=$($tauri.version) cargo=$cargoVersion solicitada=$Version"
}
Write-Host "==> Versión: $Version"

# --- 2. Archivos base del empaquetado (copias locales de la plantilla) ------
foreach ($required in @('setup.iss', 'identity.iss', 'BiglexModernUI.iss')) {
    $requiredPath = Join-Path $packagingDir $required
    if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Falta el archivo de empaquetado: $requiredPath" }
}

# --- 3. version.iss ---------------------------------------------------------
$versionIss = @"
; ---------------------------------------------------------------------------
; version.iss - generado por scripts/packaging/Build-Installer.ps1
; ---------------------------------------------------------------------------
#define MyAppVersion "$Version"
"@
Write-Utf8File (Join-Path $packagingDir 'version.iss') $versionIss
Write-Host "==> version.iss generado ($Version)"

# --- 3. associations.iss / associations.pas (desde tauri.conf.json) ---------
$assocGroups = @($tauri.bundle.fileAssociations)
if ($assocGroups.Count -eq 0) { throw 'tauri.conf.json no declara bundle.fileAssociations.' }

$regLines = New-Object System.Collections.Generic.List[string]
$pasLines = New-Object System.Collections.Generic.List[string]
$progIds = New-Object System.Collections.Generic.List[object]
$index = 0
$extSeen = @{}

foreach ($group in $assocGroups) {
    $progId = ([string]$group.name).Trim()
    $description = ([string]$group.description).Trim()
    if (-not $progId) { throw 'bundle.fileAssociations contiene un grupo sin nombre.' }
    $description = $description.Replace('"', '""')
    foreach ($rawExt in @($group.ext)) {
        $ext = ([string]$rawExt).Trim().TrimStart('.').ToLowerInvariant()
        if (-not $ext) { continue }
        if ($extSeen.ContainsKey($ext)) { throw "La extensión '$ext' está declarada en más de un grupo." }
        $extSeen[$ext] = $true
        if ($index -gt 255) { throw 'Demasiadas extensiones: el límite del instalador es 256.' }
        # Valor por defecto de la extensión -> ProgID (lo limpia/restaura el desinstalador).
        # Valor por defecto de la extension -> ProgID. uninsdeletevalue permite
        # que Inno lo retire al desinstalar; el valor previo se restaura desde
        # el codigo (ver associations.pas).
        $regLines.Add("Root: HKCU; Subkey: `"Software\Classes\.$ext`"; ValueType: string; ValueName: `"`"; ValueData: `"$progId`"; Flags: uninsdeletevalue")
        $pasLines.Add("  AssocData[$index] := '$ext=$progId';")
        $index++
    }
    $progIds.Add([pscustomobject]@{ Name = $progId; Description = $description })
}

# Entradas del ProgID (equivalentes a APP_ASSOCIATE del NSIS de Tauri).
# En Inno, las comillas dobles dentro de un valor se escapan duplicandolas.
$commandValue = '"""{app}\prisma.exe"" ""%1"""'
foreach ($prog in $progIds) {
    $name = $prog.Name
    $regLines.Add("Root: HKCU; Subkey: `"Software\Classes\$name`"; ValueType: string; ValueName: `"`"; ValueData: `"$($prog.Description)`"; Flags: uninsdeletekey")
    $regLines.Add("Root: HKCU; Subkey: `"Software\Classes\$name\DefaultIcon`"; ValueType: string; ValueName: `"`"; ValueData: `"{app}\prisma.exe,0`"; Flags: uninsdeletekey")
    $regLines.Add("Root: HKCU; Subkey: `"Software\Classes\$name\shell`"; ValueType: string; ValueName: `"`"; ValueData: `"open`"; Flags: uninsdeletekey")
    $regLines.Add("Root: HKCU; Subkey: `"Software\Classes\$name\shell\open`"; ValueType: string; ValueName: `"`"; ValueData: `"Open with Prisma`"; Flags: uninsdeletekey")
    $regLines.Add("Root: HKCU; Subkey: `"Software\Classes\$name\shell\open\command`"; ValueType: string; ValueName: `"`"; ValueData: $commandValue; Flags: uninsdeletekey")
}

$registryHeader = @"
; ---------------------------------------------------------------------------
; associations.iss - generado por scripts/packaging/Build-Installer.ps1
; Origen: src-tauri/tauri.conf.json (bundle.fileAssociations)
; Las extensiones se registran en HKCU\Software\Classes, igual que el
; instalador NSIS de Tauri en modo currentUser.
; ---------------------------------------------------------------------------
"@
Write-Utf8File (Join-Path $packagingDir 'associations.iss') ($registryHeader + "`r`n" + ($regLines -join "`r`n") + "`r`n")

$pascalHeader = @"
// ---------------------------------------------------------------------------
// associations.pas - generado por scripts/packaging/Build-Installer.ps1
// Datos de las asociaciones (extension -> ProgID) para respaldar y restaurar
// el valor previo de cada extension durante la desinstalacion.
// ---------------------------------------------------------------------------
procedure InitAssocData;
begin
  AssocCount := $index;
"@
Write-Utf8File (Join-Path $packagingDir 'associations.pas') ($pascalHeader + "`r`n" + ($pasLines -join "`r`n") + "`r`nend;`r`n")
Write-Host "==> associations.iss / associations.pas generados ($index extensiones, $($progIds.Count) ProgID)"

# --- 4. Icono real de la app ------------------------------------------------
# Regenerar antes de copiar: el staging del instalador debe usar el mismo icono
# que el ejecutable, incluso cuando se omite recompilar la aplicación.
Invoke-Checked 'bun' @('run', 'icons:generate') 'Verificando iconos nativos'
$iconSource = Join-Path $root 'src-tauri\icons\icon.ico'
if (-not (Test-Path -LiteralPath $iconSource)) { throw "Falta el icono de la app: $iconSource" }
Copy-Item -LiteralPath $iconSource -Destination (Join-Path $packagingDir 'icon.ico') -Force
Write-Host "==> icon.ico copiado desde src-tauri\icons"

# --- 5. Compilar la app (Tauri sin el bundle NSIS) -------------------------
if (-not $SkipAppBuild) {
    Invoke-Checked 'bun' @('run', 'tauri', 'build', '--no-bundle') 'Compilando Prisma (Tauri, sin bundle NSIS)'
}

$binary = Join-Path $root 'src-tauri\target\release\prisma.exe'
Assert-BinaryFresh -Exe $binary -AppRoot $root -Force:$ForceStale

# --- 6. Staging: ejecutable + recursos embebidos ---------------------------
$stagingDir = Join-Path $root 'src-tauri\target\inno\staging'
if (Test-Path -LiteralPath $stagingDir) { Remove-Item -LiteralPath $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

Copy-Item -LiteralPath $binary -Destination $stagingDir -Force
Copy-Item -LiteralPath (Join-Path $root 'src-tauri\vendor\libmpv\bin\libmpv-2.dll') -Destination $stagingDir -Force
Copy-Item -LiteralPath (Join-Path $root 'src-tauri\vendor\libunwind.dll') -Destination $stagingDir -Force
$ffmpegStage = Join-Path $stagingDir 'ffmpeg'
New-Item -ItemType Directory -Path $ffmpegStage -Force | Out-Null
Copy-Item -Path (Join-Path $root 'src-tauri\vendor\ffmpeg\*') -Destination $ffmpegStage -Force

$staged = Get-ChildItem -LiteralPath $stagingDir -Recurse -File
Write-Host "==> Staging listo: $($staged.Count) archivos, $([math]::Round(($staged | Measure-Object -Property Length -Sum).Sum / 1MB, 1)) MB"

# --- 7. Compilar el instalador con Inno Setup ------------------------------
if (-not $ISCCPath) { $ISCCPath = Resolve-Iscc }
if (-not $ISCCPath) { Write-Fail 'No se localizo ISCC.exe en Scripts\tools\InnoSetup ni en el PATH.' }
if (-not (Test-Path -LiteralPath $ISCCPath)) { throw "No se encontró el compilador de Inno Setup: $ISCCPath" }
$outputDir = Join-Path $root 'src-tauri\target\inno\output'
if (Test-Path -LiteralPath $outputDir) { Get-ChildItem -LiteralPath $outputDir -File | Remove-Item -Force }
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$setupIss = Join-Path $packagingDir 'setup.iss'
# Puerta de calidad: plantilla visual sincronizada + invariantes validadas
# antes de tocar ISCC.exe.
$sharedInno = Resolve-SharedInno
Sync-SharedTemplate -SharedDir $sharedInno -PackagingDir $packagingDir
Assert-PackagingInvariants -SharedDir $sharedInno -SetupFiles @($setupIss)
Write-Host "==> Compilando instalador Inno Setup"
$compileStarted = Get-Date
Push-Location $packagingDir
try {
    & $ISCCPath $setupIss
    if ($LASTEXITCODE -ne 0) { throw "ISCC falló (código $LASTEXITCODE)." }
} finally {
    Pop-Location
}

$installerName = "Prisma_${Version}-setup.exe"
$builtInstaller = Join-Path $outputDir $installerName
if (-not (Test-Path -LiteralPath $builtInstaller)) { throw "ISCC no generó el instalador esperado: $builtInstaller" }
if ((Get-Item -LiteralPath $builtInstaller).LastWriteTime -lt $compileStarted) {
    throw "El instalador generado es anterior a esta compilación: $builtInstaller"
}

# --- 8. Publicar en la carpeta release -------------------------------------
if (-not $SkipCopyToRelease) {
    $releaseDir = Join-Path $root 'release'
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
    Copy-Item -LiteralPath $builtInstaller -Destination (Join-Path $releaseDir $installerName) -Force
    Write-Host "==> Instalador copiado a release\$installerName"
} else {
    Write-Host "==> Instalador en $builtInstaller (no copiado a release)"
}

$hash = Get-Sha256 $builtInstaller
$size = (Get-Item -LiteralPath $builtInstaller).Length
Write-Host "==> Instalador: $installerName ($([math]::Round($size / 1MB, 1)) MB) SHA-256 $hash"

# --- 9. Variante de tema claro (solo verificacion visual) ------------------
if ($CompileLightVariant) {
    $lightDir = Join-Path $root 'src-tauri\target\inno\output-light'
    if (Test-Path -LiteralPath $lightDir) { Get-ChildItem -LiteralPath $lightDir -File | Remove-Item -Force }
    New-Item -ItemType Directory -Path $lightDir -Force | Out-Null
    Write-Host '==> Compilando variante de tema claro (verificacion visual)'
    Push-Location $packagingDir
    try {
        & $ISCCPath "/DMyAppTheme=light" "/DMyAppOutputDir=$lightDir" $setupIss
        if ($LASTEXITCODE -ne 0) { throw "ISCC falló en la variante clara (código $LASTEXITCODE)." }
    } finally {
        Pop-Location
    }
    $lightInstaller = Join-Path $lightDir $installerName
    if (-not (Test-Path -LiteralPath $lightInstaller)) { throw "ISCC no generó la variante clara: $lightInstaller" }
    Write-Host "==> Variante clara: $lightInstaller"
}
