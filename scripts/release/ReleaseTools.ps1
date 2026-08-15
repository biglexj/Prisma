# ==============================================================================
# ReleaseTools.ps1 — Prisma
# Ecosistema Biglex - Documentación Core (Core-Docs)
# ==============================================================================

Set-StrictMode -Version Latest

function Invoke-Checked {
    param(
        [Parameter(Mandatory)] [string]$Executable,
        [Parameter(Mandatory)] [AllowEmptyString()] [string[]]$ArgumentList
    )

    & $Executable @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "El comando '$Executable' terminó con código de error $LASTEXITCODE."
    }
}

function Get-WindowsSdkTool {
    param([Parameter(Mandatory)] [string]$Name)

    $sdkRoot = "C:\Program Files (x86)\Windows Kits\10\bin"
    if (-not (Test-Path -LiteralPath $sdkRoot)) {
        throw "No se encontró el directorio base de Windows Kits en '$sdkRoot'."
    }

    $sdk = Get-ChildItem -LiteralPath $sdkRoot -Directory |
        Where-Object Name -Match '^10\.' |
        Sort-Object { [version]$_.Name } -Descending |
        Select-Object -First 1
    if (-not $sdk) {
        throw "No se encontró ningún SDK de Windows instalado en '$sdkRoot'."
    }

    $tool = Join-Path $sdk.FullName "x64\$Name"
    if (-not (Test-Path -LiteralPath $tool)) {
        throw "No se encontró la herramienta '$Name' en Windows SDK ('$tool')."
    }
    return $tool
}

function Assert-SemanticVersion {
    param([Parameter(Mandatory)] [string]$Version)

    if ($Version -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
        throw "La versión '$Version' no cumple el formato semántico estricto mayor.menor.parche (ej. 1.2.3)."
    }
    if ([int]$Matches[3] -gt 9) {
        throw "Regla del .9: El parche '$Version' excede 9. Avanza la versión menor (ej. de 1.0.9 pasa a 1.1.0)."
    }
}

function Assert-PublishPreflight {
    param(
        [Parameter(Mandatory)] [string]$Root,
        [Parameter(Mandatory)] [string]$Repository,
        [Parameter(Mandatory)] [string]$Tag
    )

    Push-Location $Root
    try {
        $branch = (& git branch --show-current).Trim()
        if ($LASTEXITCODE -ne 0 -or $branch -ne "main") {
            throw "La publicación oficial exige estar en la rama 'main' (rama actual: '$branch')."
        }

        $origin = (& git remote get-url origin).Trim()
        if ($LASTEXITCODE -ne 0 -or $origin -notmatch "github\.com[/:]$([regex]::Escape($Repository))(\.git)?$") {
            throw "El remoto origin ('$origin') no corresponde al repositorio esperado '${Repository}'."
        }

        Invoke-Checked git @("fetch", "origin", "main", "--tags")
        if ((& git rev-parse HEAD).Trim() -ne (& git rev-parse origin/main).Trim()) {
            throw "La rama 'main' local no está sincronizada con 'origin/main'. Realiza git pull/push antes de publicar."
        }

        Invoke-Checked gh @("auth", "status")

        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "SilentlyContinue"

        & git rev-parse --quiet --verify "refs/tags/$Tag" *> $null
        $tagExists = ($LASTEXITCODE -eq 0)

        & gh release view $Tag --repo $Repository *> $null
        $releaseExists = ($LASTEXITCODE -eq 0)

        $ErrorActionPreference = $oldPreference

        if ($tagExists) {
            throw "El tag '$Tag' ya existe local o remotamente. No se permite re-etiquetar versiones ya creadas."
        }
        if ($releaseExists) {
            throw "El GitHub Release '$Tag' ya existe en '${Repository}'. Incrementa la versión antes de publicar."
        }
    } finally {
        Pop-Location
    }
}

function Assert-SignedArtifact {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$Publisher
    )

    $signature = Get-AuthenticodeSignature -LiteralPath $Path
    if (-not $signature.SignerCertificate -or $signature.SignerCertificate.Subject -ne $Publisher) {
        throw "La firma digital de '$Path' no es válida o no corresponde al firmante esperado '$Publisher'."
    }
}
