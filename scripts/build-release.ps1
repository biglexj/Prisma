param(
    [string]$Version,
    [string]$ReleaseNotes,
    [switch]$LocalOnly,
    [switch]$SkipBuild,
    [switch]$SkipAuroraUpload
)

$targetScript = Join-Path $PSScriptRoot "release\build-release.ps1"
if (Test-Path $targetScript) {
    & $targetScript @PSBoundParameters
} else {
    throw "No se encontró $targetScript"
}
