param([string]$Executable = 'src-tauri/target/release/prisma.exe')
$ErrorActionPreference = 'Stop'
$exe = (Resolve-Path -LiteralPath $Executable).Path
$root = Join-Path (Get-Location) ('temp/handoff-tests/session-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path (Join-Path $root 'media') -Force | Out-Null
Copy-Item -LiteralPath 'src-tauri/icons/128x128.png' -Destination (Join-Path $root 'media/test.png')
$previousRoot = $env:PRISMA_HANDOFF_DIAGNOSTICS_DIR
$env:PRISMA_HANDOFF_DIAGNOSTICS_DIR = $root
$started = @()
$evidence = [ordered]@{ executable = $exe; root = $root; cases = @() }
function Read-State([string]$Role) {
    try { Get-Content -Raw -LiteralPath (Join-Path $root "$Role-state.json") | ConvertFrom-Json } catch { $null }
}
function Wait-State([string]$Role, [scriptblock]$Predicate) {
    $limit = (Get-Date).AddSeconds(60)
    do {
        $snapshot = Read-State $Role
        if ($snapshot -and (& $Predicate $snapshot)) { return $snapshot }
        Start-Sleep -Milliseconds 200
    } while ((Get-Date) -lt $limit)
    throw "No se alcanzó el estado esperado de $Role. Último estado: $($snapshot | ConvertTo-Json -Depth 4 -Compress)"
}
function Start-Role([string]$Role) {
    $arguments = @('--wallpaper-handoff-diagnostics', '--autostart')
    if ($Role -eq 'dev') { $arguments += '--dev' }
    Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root "$Role-output.log") -RedirectStandardError (Join-Path $root "$Role-error.log")
}
function Exit-Role([string]$Role, $Process) {
    Set-Content -LiteralPath (Join-Path $root "$Role-exit") -Value 'exit'
    if (!$Process.HasExited) { Wait-Process -Id $Process.Id -Timeout 20 }
}
try {
    $stable = Start-Role 'stable'; $started += $stable
    $before = Wait-State 'stable' { param($s) !$s.state.controlBlocked -and $s.state.baseActive -and $s.state.compositorEnabled -and $s.compositionWindow }
    $dev = Start-Role 'dev'; $started += $dev
    $devActive = Wait-State 'dev' { param($s) !$s.state.controlBlocked -and $s.state.baseActive -and $s.state.compositorEnabled -and $s.compositionWindow }
    $ceded = Wait-State 'stable' { param($s) $s.state.controlBlocked -and !$s.state.isActive -and !$s.compositionWindow -and $s.blockedCommandRejected }
    Exit-Role 'dev' $dev
    $restored = Wait-State 'stable' { param($s) !$s.state.controlBlocked -and $s.state.baseActive -and $s.state.compositorEnabled -and $s.compositionWindow }
    if ($before.state.currentMedia -ne $restored.state.currentMedia) { throw 'No se recuperó el medio de Stable' }
    $evidence.cases += @{ name = 'Stable -> Dev -> Stable'; before = $before; dev = $devActive; suspended = $ceded; restored = $restored }
    Exit-Role 'stable' $stable
    foreach ($role in @('stable', 'dev')) { Remove-Item -LiteralPath (Join-Path $root "$role-exit"); Remove-Item -LiteralPath (Join-Path $root "$role-state.json") }
    $dev = Start-Role 'dev'; $started += $dev
    $devFirst = Wait-State 'dev' { param($s) !$s.state.controlBlocked -and $s.state.compositorEnabled }
    $stable = Start-Role 'stable'; $started += $stable
    $waited = Wait-State 'stable' { param($s) $s.state.controlBlocked -and !$s.state.isActive -and !$s.compositionWindow }
    Exit-Role 'dev' $dev
    $lateStable = Wait-State 'stable' { param($s) !$s.state.controlBlocked -and $s.state.baseActive -and $s.state.compositorEnabled }
    $evidence.cases += @{ name = 'Dev -> Stable en espera -> Stable'; dev = $devFirst; suspended = $waited; restored = $lateStable }
    Exit-Role 'stable' $stable
    $evidence.result = 'passed'
    Write-Host "Cesión y recuperación verificadas en ambos órdenes. Evidencia: $root/evidence.json"
} finally {
    foreach ($role in @('stable', 'dev')) { Set-Content -LiteralPath (Join-Path $root "$role-exit") -Value 'exit' }
    foreach ($process in $started) {
        if (!$process.HasExited) { try { Wait-Process -Id $process.Id -Timeout 10 } catch { Write-Warning "La instancia de diagnóstico $($process.Id) sigue abierta" } }
    }
    $evidence | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $root 'evidence.json') -Encoding utf8
    $env:PRISMA_HANDOFF_DIAGNOSTICS_DIR = $previousRoot
}
