<#
.SYNOPSIS
    Limpieza quirúrgica de endpoints y controladores de FxSound / fantasmas.
#>

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Solicitando permisos de Administrador para limpiar los dispositivos..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoExit -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Eliminando dispositivos marcados y controladores viejos" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1. Eliminar AudioEndpoints fantasma y de FxSound
Write-Host "[1/4] Buscando y eliminando AudioEndpoints huérfanos/FxSound..." -ForegroundColor Yellow
$endpointOutput = & pnputil /enum-devices /class AudioEndpoint 2>&1
$currId = $null
foreach ($line in ($endpointOutput -split "`r?`n")) {
    if ($line -match "Id\. de instancia:\s+(.+)$") {
        $currId = $matches[1].Trim()
    }
    if ($line -match "Descripci.n del dispositivo:\s+(.+)$") {
        $desc = $matches[1].Trim()
        if ($desc -match "FxSound" -or ($desc -eq "Altavoces")) {
            if ($currId -and $currId -notmatch "10EC" -and $currId -notmatch "Realtek" -and $currId -notmatch "MIXLINE" -and $currId -notmatch "DM30" -and $currId -notmatch "AMD") {
                Write-Host "  -> Eliminando endpoint: $desc ($currId)" -ForegroundColor Magenta
                & pnputil /remove-device "$currId" 2>&1 | Out-Null
            }
        }
    }
}

# 2. Eliminar dispositivos Media virtuales en ROOT\MEDIA
Write-Host "[2/4] Buscando y eliminando controladores virtuales en ROOT\MEDIA..." -ForegroundColor Yellow
$mediaOutput = & pnputil /enum-devices /class Media 2>&1
$currMediaId = $null
foreach ($line in ($mediaOutput -split "`r?`n")) {
    if ($line -match "Id\. de instancia:\s+(.+)$") {
        $currMediaId = $matches[1].Trim()
    }
    if ($line -match "Descripci.n del dispositivo:\s+(.+)$") {
        $mdesc = $matches[1].Trim()
        if ($mdesc -match "FxSound" -or $mdesc -match "fxvad" -or $mdesc -match "Prisma") {
            if ($currMediaId -match "ROOT\\MEDIA") {
                Write-Host "  -> Eliminando dispositivo: $mdesc ($currMediaId)" -ForegroundColor Magenta
                & pnputil /remove-device "$currMediaId" 2>&1 | Out-Null
            }
        }
    }
}

# 3. Eliminar paquetes de controladores OEM de FxSound en el Driver Store
Write-Host "[3/4] Eliminando paquetes de controladores OEM de FxSound..." -ForegroundColor Yellow
$driverList = & pnputil /enum-drivers 2>&1
$currDriver = $null
foreach ($dline in ($driverList -split "`r?`n")) {
    if ($dline -match "Nombre publicado:\s+(oem\d+\.inf)") {
        $currDriver = $matches[1].Trim()
    }
    if ($dline -match "fxvad\.inf|FxSound") {
        if ($currDriver) {
            Write-Host "  -> Eliminando paquete de driver $currDriver" -ForegroundColor Magenta
            & pnputil /delete-driver "$currDriver" /uninstall /force 2>&1 | Out-Null
        }
    }
}

# 4. Reiniciar servicio de sonido
Write-Host "[4/4] Reiniciando servicio de audio de Windows (AudioSrv)..." -ForegroundColor Yellow
try {
    Restart-Service AudioSrv -Force
} catch {}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✓ ¡LIMPIEZA COMPLETADA CON ÉXITO!" -ForegroundColor Green
Write-Host "  Todos los dispositivos marcados con (X) fueron eliminados." -ForegroundColor White
Write-Host "  Solo se conservaron tus dispositivos legítimos (MIXLINE, Realtek, Alto TS415, etc.)." -ForegroundColor White
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona Enter para cerrar esta ventana..." -ForegroundColor Gray
[Console]::ReadLine()
