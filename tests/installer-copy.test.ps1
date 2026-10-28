#requires -Version 5.1
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../scripts/packaging/InstallerCopy.ps1')
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('prisma-installer-copy-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
function Assert-True($condition, $message) { if (-not $condition) { throw $message } }
try {
    $source = Join-Path $testRoot 'source.exe'
    $target = Join-Path $testRoot 'Prisma_2.0.1-setup.exe'
    [IO.File]::WriteAllText($source, 'new installer')
    $hash = Get-Sha256 $source

    $result = Copy-VerifiedInstaller $source $target $hash -RetryDelayMilliseconds 0
    Assert-True ($result -eq $target -and (Get-Sha256 $target) -eq $hash) 'No se copió un destino nuevo.'
    [IO.File]::WriteAllText($target, 'old installer')
    $result = Copy-VerifiedInstaller $source $target $hash -RetryDelayMilliseconds 0
    Assert-True ((Get-Sha256 $target) -eq $hash) 'No se reemplazó un destino anterior.'

    # Reproducir el bloqueo real de Windows: lectura permitida, reemplazo prohibido.
    [IO.File]::WriteAllText($target, 'locked old installer')
    $lock = [IO.File]::Open($target, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        $result = Copy-VerifiedInstaller $source $target $hash -AllowAlternateName -RetryDelayMilliseconds 0 -WarningVariable copyWarnings -WarningAction SilentlyContinue
        Assert-True ($result -ne $target -and (Get-Sha256 $result) -eq $hash) 'No se generó el instalador alternativo verificado.'
        Assert-True ([IO.File]::ReadAllText($target) -eq 'locked old installer') 'Se alteró el instalador bloqueado.'
        Assert-True ($copyWarnings.Count -gt 0) 'No se avisó de la copia anterior bloqueada.'
        $failed = $false
        try { Copy-VerifiedInstaller $source $target $hash -RetryDelayMilliseconds 0 | Out-Null }
        catch { $failed = $_.Exception.Message.Contains($source) }
        Assert-True $failed 'Un destino obligatorio bloqueado debe fallar con la ruta utilizable.'
    } finally { $lock.Dispose() }

    [IO.File]::Copy($source, $target, $true)
    $lock = [IO.File]::Open($target, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        $result = Copy-VerifiedInstaller $source $target $hash -RetryDelayMilliseconds 0
        Assert-True ($result -eq $target) 'Una copia idéntica bloqueada no debe fallar.'
    } finally { $lock.Dispose() }

    $failed = $false
    try { Copy-VerifiedInstaller $source $target ('0' * 64) -RetryDelayMilliseconds 0 | Out-Null }
    catch { $failed = $true }
    Assert-True ($failed -and (Get-Sha256 $target) -eq $hash) 'Un hash inválido debe conservar el destino.'
    Assert-True (@(Get-ChildItem -LiteralPath $testRoot -Filter '*.tmp' -Force).Count -eq 0) 'Quedaron copias temporales.'
    Write-Host 'OK: copia nueva, reemplazo, bloqueo opcional/obligatorio, copia idéntica y hash inválido.'
} finally {
    # Ruta temporal creada explícitamente por esta prueba, nunca una ruta del usuario.
    $cleanupPath = [IO.Path]::GetFullPath($testRoot)
    $tempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
    if ((Split-Path -Parent $cleanupPath).TrimEnd('\') -ne $tempParent -or
        -not (Split-Path -Leaf $cleanupPath).StartsWith('prisma-installer-copy-')) {
        throw "Ruta de limpieza fuera del directorio temporal de la prueba: $cleanupPath"
    }
    Remove-Item -LiteralPath $cleanupPath -Recurse -Force
}
