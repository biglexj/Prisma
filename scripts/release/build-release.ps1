# ==============================================================================
# build-release.ps1 — Prisma (Tauri v2)
# Ecosistema Biglex - Documentación Core (Core-Docs)
# ==============================================================================

param(
    [string]$Version,
    [string]$ReleaseNotesFile = "RELEASE_MESSAGE.md",
    [switch]$LocalOnly,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
. (Join-Path $PSScriptRoot "ReleaseTools.ps1")

$repository = "biglexj/Prisma"
$appName = "Prisma"
$releaseNotesPath = Join-Path $root $ReleaseNotesFile

$packageJsonPath = Join-Path $root "package.json"
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$currentVersion = $packageJson.version

if (-not $Version) { $Version = $currentVersion }
Assert-SemanticVersion $Version

if (-not (Test-Path -LiteralPath $releaseNotesPath)) {
    throw "No se encontró el archivo de notas de lanzamiento: $releaseNotesPath"
}

$tag = "v$Version"
$output = Join-Path $root "release"
if (-not $LocalOnly) { Assert-PublishPreflight -Root $root -Repository $repository -Tag $tag }

# Compilar con Tauri CLI
if (-not $SkipBuild) {
    Write-Host "Compilando aplicación $appName ($tag)..." -ForegroundColor Cyan
    Invoke-Checked bun @("run", "tauri", "build")
}

New-Item -ItemType Directory -Path $output -Force | Out-Null
Write-Host "Compilación finalizada exitosamente." -ForegroundColor Green
