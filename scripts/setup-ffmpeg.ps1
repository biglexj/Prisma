param([string]$SourceDirectory)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$destination = Join-Path $projectRoot 'src-tauri/vendor/ffmpeg'
if (-not $SourceDirectory) {
    $packages = Join-Path $env:LOCALAPPDATA 'Microsoft/WinGet/Packages'
    $package = Get-ChildItem $packages -Directory -Filter 'Gyan.FFmpeg_*' | Select-Object -First 1
    if ($package) {
        $binary = Get-ChildItem $package.FullName -Recurse -Filter ffmpeg.exe | Select-Object -First 1
        if ($binary) { $SourceDirectory = Split-Path $binary.DirectoryName -Parent }
    }
}
if (-not $SourceDirectory) { throw 'Indica -SourceDirectory con una distribución estática completa de FFmpeg (bin, LICENSE y README.txt).' }
foreach ($name in @('ffmpeg.exe', 'ffprobe.exe')) {
    $binaryPath = Join-Path $SourceDirectory "bin/$name"
    if (-not (Test-Path $binaryPath)) { throw "Falta $binaryPath" }
    $versionOutput = & $binaryPath -version; Write-Output $versionOutput[0]
    if ($LASTEXITCODE -ne 0) { throw "No se pudo ejecutar $name" }
}
New-Item $destination -ItemType Directory -Force | Out-Null
foreach ($name in @('ffmpeg.exe', 'ffprobe.exe')) { Copy-Item -LiteralPath (Join-Path $SourceDirectory "bin/$name") -Destination $destination -Force }
foreach ($name in @('LICENSE', 'README.txt')) { Copy-Item -LiteralPath (Join-Path $SourceDirectory $name) -Destination $destination -Force }
Get-FileHash (Join-Path $destination '*.exe') -Algorithm SHA256 | Select-Object Hash,Path | ConvertTo-Json | Set-Content (Join-Path $destination 'manifest.json')

