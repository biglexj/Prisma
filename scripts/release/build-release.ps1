param(
    [string]$Version,
    [string]$ReleaseNotes,
    [switch]$LocalOnly,
    [switch]$SkipBuild,
    [switch]$SkipAuroraUpload
)

$ErrorActionPreference = "Stop"

$root = if (Test-Path (Join-Path $PSScriptRoot "package.json")) {
    $PSScriptRoot
} else {
    (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$releaseDir = Join-Path $root "release"
$packageFile = Join-Path $root "package.json"

# 1. Determinar versión
if (-not $Version) {
    $packageJson = Get-Content $packageFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $Version = $packageJson.version
    if (-not $Version) {
        throw "No se pudo determinar la versión en package.json"
    }
}

Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  Prisma — Release v$Version" -ForegroundColor Magenta
Write-Host "══════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

# 2. Compilar Aplicación (Tauri v2 + NSIS)
if (-not $SkipBuild) {
    Write-Host "[1/4] Compilando instalador de Prisma (Tauri v2)..." -ForegroundColor Yellow
    Set-Location $root
    bun run tauri build
    if ($LASTEXITCODE -ne 0) { throw "La compilación de Tauri falló con código $LASTEXITCODE" }
    bun scripts/copy-build-releases.ts
} else {
    Write-Host "[1/4] Compilación omitida (-SkipBuild)..." -ForegroundColor DarkGray
}

if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
}

$installerTarget = Join-Path $releaseDir "Prisma_${Version}_x64-setup.exe"
if (-not (Test-Path $installerTarget)) {
    # Intentar buscar en bundle nativo si no se copió
    $bundleSource = Join-Path $root "src-tauri\target\release\bundle\nsis\Prisma_${Version}_x64-setup.exe"
    if (Test-Path $bundleSource) {
        Copy-Item $bundleSource $installerTarget -Force
    } else {
        throw "No se encontró el instalador generado en: $installerTarget"
    }
}

Write-Host "Instalador empaquetado en: $installerTarget" -ForegroundColor Green

if ($LocalOnly) {
    Write-Host "Build local completado (-LocalOnly)." -ForegroundColor Green
    exit 0
}

# 3. Git commit & tag
Write-Host "[2/4] Registrando en Git..." -ForegroundColor Yellow
$currentBranch = (& git branch --show-current).Trim()
if (-not $currentBranch) { $currentBranch = "main" }

git add .
$hasStagedChanges = (& git status --porcelain)
if ($hasStagedChanges) {
    git commit -m "release: v$Version - Publicación oficial Prisma"
}
git tag -a "v$Version" -m "Release v$Version" -f

$hasRemote = (& git remote)
if ($hasRemote) {
    git push origin "$currentBranch" --tags --force
    if ($currentBranch -ne "main") {
        git push origin "${currentBranch}:main" --force
    }
}

# 4. GitHub Release
Write-Host "[3/4] Publicando GitHub Release v$Version..." -ForegroundColor Yellow
$releaseNotesFile = Join-Path $root "RELEASE_MESSAGE.md"

try { gh release delete "v$Version" --yes 2>$null } catch {}
if (-not $ReleaseNotes) {
    if (Test-Path $releaseNotesFile) {
        gh release create "v$Version" $installerTarget --title "Prisma v$Version" -F $releaseNotesFile
    } else {
        gh release create "v$Version" $installerTarget --title "Prisma v$Version" --notes "Lanzamiento oficial de Prisma v$Version"
    }
} else {
    gh release create "v$Version" $installerTarget --title "Prisma v$Version" --notes $ReleaseNotes
}

Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ¡Release v$Version publicado en GitHub con éxito!" -ForegroundColor Green
Write-Host "══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  https://github.com/biglexj/Prisma/releases/tag/v$Version" -ForegroundColor Cyan

# 5. Publicar en Aurora Blog (biglexj.com)
Write-Host ""
if ($SkipAuroraUpload) {
    Write-Host "[4/4] Aurora Upload omitido (-SkipAuroraUpload)." -ForegroundColor DarkGray
} else {
    Write-Host "[4/4] Publicando en Aurora Blog (biglexj.com)..." -ForegroundColor Yellow

    $auroraEnvPath = "D:\Proyectos\biglexj\Aurora---Blog\frontend\.env"
    if (Test-Path $auroraEnvPath) {
        $auroraEnv     = Get-Content $auroraEnvPath -Raw -Encoding UTF8
        $serviceKey    = [regex]::Match($auroraEnv, '(?m)^SUPABASE_SERVICE_ROLE_KEY=(.+)$').Groups[1].Value.Trim()
        
        if ($serviceKey) {
            $baseUrl   = "https://www.biglexj.com"
            $slug      = "prisma"
            $mimeType  = "application/octet-stream"
            $fileName  = Split-Path $installerTarget -Leaf

            $releaseMsg = if (Test-Path $releaseNotesFile) {
                [System.IO.File]::ReadAllText($releaseNotesFile, [System.Text.Encoding]::UTF8)
            } else { "Prisma v$Version" }

            try {
                # ── PASO A: Presigned URL de R2 ──
                Write-Host "  [A] Obteniendo Presigned URL de R2..." -ForegroundColor DarkYellow
                $encodedMime = [Uri]::EscapeDataString($mimeType)
                $encodedFile = [Uri]::EscapeDataString($fileName)
                $presignUri  = "$baseUrl/api/admin/developer-app-presign?slug=$slug&fileName=$encodedFile&contentType=$encodedMime&type=package&os=windows"

                $presignData = Invoke-RestMethod -Uri $presignUri -Method GET `
                               -Headers @{ Authorization = "Bearer $serviceKey" }

                if ($presignData.success) {
                    Write-Host "  Presigned URL obtenida." -ForegroundColor DarkGreen

                    # ── PASO B: Subir binario a R2 ──
                    Write-Host "  [B] Subiendo instalador a R2 ($fileName)..." -ForegroundColor DarkYellow
                    $fileBytes = [System.IO.File]::ReadAllBytes($installerTarget)
                    Invoke-RestMethod -Uri $presignData.presignedUrl -Method PUT `
                                      -Body $fileBytes -ContentType $mimeType | Out-Null
                    Write-Host "  Instalador en R2: $($presignData.publicUrl)" -ForegroundColor DarkGreen

                    # ── PASO C: Registrar en Supabase vía Aurora API ──
                    Write-Host "  [C] Registrando release en Aurora Manager..." -ForegroundColor DarkYellow
                    $sha256Hash = (Get-FileHash -Path $installerTarget -Algorithm SHA256).Hash.ToLower()
                    Write-Host "  SHA-256: $sha256Hash" -ForegroundColor DarkGray

                    $releaseBody = @{
                        slug           = $slug
                        downloadUrl    = $presignData.publicUrl
                        versionName    = $Version
                        versionCode    = 1
                        releaseNotes   = $releaseMsg
                        sha256Checksum = $sha256Hash
                    } | ConvertTo-Json -Depth 5

                    Invoke-RestMethod -Uri "$baseUrl/api/admin/developer-apps" -Method PUT `
                                      -Headers @{
                                          "Content-Type" = "application/json"
                                          Authorization  = "Bearer $serviceKey"
                                      } `
                                      -Body $releaseBody | Out-Null

                    Write-Host ""
                    Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
                    Write-Host "  ✅ Prisma v$Version en biglexj.com" -ForegroundColor Cyan
                    Write-Host "  $($presignData.publicUrl)" -ForegroundColor Cyan
                    Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
                } else {
                    Write-Host "  ⚠️ No se pudo presignar R2 para el slug '$slug': $($presignData.error)" -ForegroundColor DarkYellow
                }
            } catch {
                Write-Host "  ⚠️ Error durante la publicación en biglexj.com: $_" -ForegroundColor DarkYellow
            }
        } else {
            Write-Host "  ⚠️ No se encontró SUPABASE_SERVICE_ROLE_KEY en $auroraEnvPath" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  ⚠️ No se encontró $auroraEnvPath" -ForegroundColor DarkGray
    }
}
