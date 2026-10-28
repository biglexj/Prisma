#requires -Version 5.1

function Get-Sha256 {
    param([string]$Path)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $stream = [System.IO.File]::OpenRead($Path)
        try { $bytes = $sha.ComputeHash($stream) } finally { $stream.Dispose() }
    } finally { $sha.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

function Copy-VerifiedInstaller {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][string]$ExpectedHash,
        [switch]$AllowAlternateName,
        [int]$RetryDelayMilliseconds = 500
    )

    $directory = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $staged = Join-Path $directory ('.installer-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    try {
        [IO.File]::Copy($Source, $staged)
        if ((Get-Sha256 $staged) -ne $ExpectedHash) {
            throw "La copia del instalador no coincide con el original: $staged"
        }
        $target = $Destination
        for ($attempt = 0; $attempt -lt 4; $attempt++) {
            try {
                if ([IO.File]::Exists($target)) {
                    # Una copia idéntica ya es válida aunque esté abierta.
                    if ((Get-Sha256 $target) -eq $ExpectedHash) { return $target }
                    # Reemplazo atómico: un bloqueo conserva intacto el anterior.
                    [IO.File]::Replace($staged, $target, [System.Management.Automation.Language.NullString]::Value)
                } else {
                    [IO.File]::Move($staged, $target)
                }
                return $target
            } catch [System.IO.IOException] {
                if ($attempt -lt 3) {
                    Start-Sleep -Milliseconds $RetryDelayMilliseconds
                    continue
                }
                if (-not $AllowAlternateName) {
                    throw "No se pudo actualizar '$Destination'. El instalador compilado sigue disponible en '$Source'. Detalle: $($_.Exception.Message)"
                }
                $alternate = Join-Path $directory ([IO.Path]::GetFileNameWithoutExtension($Destination) + '-build-' + $ExpectedHash.Substring(0, 12) + '.exe')
                # La misma política de verificación y reemplazo se aplica al alternativo.
                $saved = Copy-VerifiedInstaller -Source $Source -Destination $alternate -ExpectedHash $ExpectedHash -RetryDelayMilliseconds $RetryDelayMilliseconds
                Write-Warning "No se pudo actualizar '$Destination'; esa ruta conserva su copia anterior. Instalador NUEVO verificado: '$saved'. No es necesario cerrar Prisma para copiar su instalador."
                return $saved
            }
        }
    } finally {
        if ([IO.File]::Exists($staged)) { [IO.File]::Delete($staged) }
    }
}
