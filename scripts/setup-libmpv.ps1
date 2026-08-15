param(
    [string]$Build = "20260809-git-dd5d17d328",
    [ValidateSet("baseline", "v3")]
    [string]$Variant = "baseline",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $projectRoot "src-tauri\vendor\libmpv"
$importLibrary = Join-Path $destination "lib\libmpv.dll.a"

if ((Test-Path -LiteralPath $importLibrary) -and -not $Force) {
    Write-Host "libmpv ya está preparada en $destination"
    exit 0
}

$sevenZip = Get-Command 7z -ErrorAction Stop
$curl = Get-Command curl.exe -ErrorAction Stop
$variantSegment = if ($Variant -eq "baseline") { "" } else { "-$Variant" }
$archiveName = "mpv-dev-x86_64$variantSegment-$Build.7z"
$downloadUrl = "https://sourceforge.net/projects/mpv-player-windows/files/libmpv/$archiveName/download"
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "prisma-libmpv-$([guid]::NewGuid())"
$archivePath = Join-Path $temporaryRoot $archiveName
$extractionPath = Join-Path $temporaryRoot "extracted"

try {
    New-Item -ItemType Directory -Force -Path $extractionPath | Out-Null
    Write-Host "Descargando $archiveName..."
    & $curl.Source --location --fail --retry 3 --user-agent "Prisma-libmpv-setup/1.0" --output $archivePath $downloadUrl
    if ($LASTEXITCODE -ne 0) {
        throw "La descarga terminó con el código $LASTEXITCODE."
    }

    $signature = [System.IO.File]::ReadAllBytes($archivePath)[0..5]
    $expectedSignature = [byte[]](0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C)
    if ([System.BitConverter]::ToString($signature) -ne [System.BitConverter]::ToString($expectedSignature)) {
        throw "SourceForge no entregó un archivo 7z válido. No se conservará la respuesta descargada."
    }

    Write-Host "Extrayendo libmpv..."
    & $sevenZip.Source x $archivePath "-o$extractionPath" -y | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "7-Zip terminó con el código $LASTEXITCODE."
    }

    $sourceImportLibrary = Get-ChildItem -LiteralPath $extractionPath -Recurse -File -Filter "libmpv.dll.a" |
        Select-Object -First 1
    $sourceRuntime = Get-ChildItem -LiteralPath $extractionPath -Recurse -File -Filter "libmpv-*.dll" |
        Select-Object -First 1

    if (-not $sourceImportLibrary -or -not $sourceRuntime) {
        throw "El paquete descargado no contiene libmpv.dll.a y una DLL mpv compatible."
    }

    New-Item -ItemType Directory -Force -Path (Join-Path $destination "lib"), (Join-Path $destination "bin") | Out-Null
    Copy-Item -LiteralPath $sourceImportLibrary.FullName -Destination $importLibrary -Force
    Copy-Item -LiteralPath $sourceRuntime.FullName -Destination (Join-Path $destination "bin\$($sourceRuntime.Name)") -Force

    $sourceInclude = Get-ChildItem -LiteralPath $extractionPath -Recurse -Directory |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "mpv\client.h") } |
        Select-Object -First 1
    if ($sourceInclude) {
        Copy-Item -LiteralPath $sourceInclude.FullName -Destination (Join-Path $destination "include") -Recurse -Force
    }

    Get-ChildItem -LiteralPath $extractionPath -Recurse -File |
        Where-Object { $_.Name -match "^(LICENSE|COPYING)" } |
        Copy-Item -Destination $destination -Force

    Write-Host "libmpv quedó preparada en $destination"
    Write-Host "Ya puedes ejecutar: bun tauri dev --features mpv"
}
finally {
    $systemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    $resolvedTemporaryRoot = [System.IO.Path]::GetFullPath($temporaryRoot)
    if ($resolvedTemporaryRoot.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedTemporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
