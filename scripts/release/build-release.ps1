param(
    [string]$Version,
    [string]$ReleaseNotes,
    [switch]$LocalOnly,
    [switch]$SkipBuild,
    [switch]$SkipAuroraUpload,
    [string]$BuildManifest,
    [switch]$PreflightOnly,
    [switch]$SyncAuroraOnly
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $root
$repo = 'biglexj/Prisma'
$baseUrl = 'https://www.biglexj.com'
$package = Get-Content package.json -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $Version) { $Version = $package.version }
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'A stable SemVer version is required.' }
$tauri = Get-Content src-tauri/tauri.conf.json -Raw -Encoding UTF8 | ConvertFrom-Json
$cargo = Get-Content src-tauri/Cargo.toml -Raw
$cargoVersion = [regex]::Match($cargo, '(?m)^version\s*=\s*"([^"]+)"').Groups[1].Value
if ($package.version -ne $Version -or $tauri.version -ne $Version -or $cargoVersion -ne $Version) { throw 'Version manifests disagree.' }
if ($ReleaseNotes) { throw 'Use RELEASE_MESSAGE.md as the canonical public message.' }
$notesPath = Join-Path $root 'RELEASE_MESSAGE.md'
$notes = [IO.File]::ReadAllText($notesPath, [Text.Encoding]::UTF8)
if (-not $notes.Contains("Prisma $Version") -or $notes -match '(?i)(?<![a-z])[a-z]:[\\/]') { throw 'Invalid public release message.' }
$tag = "v$Version"
$installer = Join-Path $root "release/Prisma_$($Version)_x64-setup.exe"
$assetName = Split-Path $installer -Leaf
$assetUrl = "https://github.com/$repo/releases/download/$tag/$assetName"
$releaseUrl = "https://github.com/$repo/releases/tag/$tag"
function Invoke-CheckedNative {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed (exit $LASTEXITCODE)." }
}
function Invoke-AuroraAdmin {
    param([string]$Method, [string]$Path, $Body)
    $request = @{Uri="$baseUrl$Path"; Method=$Method; Headers=@{Authorization="Bearer $script:auroraServiceKey"}; TimeoutSec=60}
    if ($null -ne $Body) {
        $request.ContentType = 'application/json; charset=utf-8'
        $request.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 10))
    }
    try { Invoke-RestMethod @request }
    catch {
        $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'unavailable' }
        throw "Aurora admin request failed (HTTP $status)."
    }
}
function Get-GitHubRelease {
    (Invoke-CheckedNative gh @('api', "repos/$repo/releases/tags/$tag")) | ConvertFrom-Json
}
if (-not $LocalOnly) {
    Invoke-CheckedNative gh @('auth','status') | Out-Host
    if (-not $SyncAuroraOnly) {
        $branch = (Invoke-CheckedNative git @('branch','--show-current')).Trim()
        if ($branch -ne 'preview') { throw 'Publish from preview.' }
        if (Invoke-CheckedNative git @('status','--porcelain')) { throw 'Commit the reviewed release snapshot first.' }
        Invoke-CheckedNative git @('fetch','origin','main','preview','--no-tags') | Out-Host
        Invoke-CheckedNative git @('merge-base','--is-ancestor','origin/main','HEAD')
        Invoke-CheckedNative git @('merge-base','--is-ancestor','origin/preview','HEAD')
        if (Invoke-CheckedNative git @('ls-remote','--tags','origin',"refs/tags/$tag","refs/tags/$tag^{}")) { throw 'Remote tag already exists; increment the version.' }
        $null = & git show-ref --verify --quiet "refs/tags/$tag"
        if ($LASTEXITCODE -eq 0) { throw 'Local tag already exists; investigate before publication.' }
        if ($LASTEXITCODE -ne 1) { throw 'Could not inspect local tags.' }
        $releaseTags = @(Invoke-CheckedNative gh @('api',"repos/$repo/releases",'--paginate','--jq','.[].tag_name'))
        if ($releaseTags -contains $tag) { throw 'Release already exists; increment the version.' }
    }
    $latest = Invoke-RestMethod -Uri "$baseUrl/api/v1/apps/prisma/latest?check=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" -TimeoutSec 60
    if (-not $latest.success -or $latest.app.slug -ne 'prisma') { throw 'Invalid Aurora app response.' }
    $appId = $latest.app.id
    if (-not $SyncAuroraOnly -and $latest.latestRelease -and [version]$latest.latestRelease.versionName -ge [version]$Version) { throw 'Version already public on Aurora; increment it.' }
    if (-not $SkipAuroraUpload) {
        $envPath = 'D:\Proyectos\biglexj\Aurora---Blog\frontend\.env'
        $envContent = [IO.File]::ReadAllText($envPath)
        $script:auroraServiceKey = [regex]::Match($envContent, '(?m)^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)$').Groups[1].Value.Trim().Trim('"').Trim("'")
        $envContent = $null
        if (-not $script:auroraServiceKey) { throw 'Configured Aurora publishing credential is missing.' }
        $history = Invoke-AuroraAdmin GET "/api/admin/developer-app-releases?appId=$appId" $null
        if (-not $history.success) { throw 'Aurora preflight failed.' }
        $existing = @($history.releases | Where-Object versionName -eq $Version)
        if ($existing.Count -and -not $SyncAuroraOnly) { throw 'Version already registered on Aurora; increment it.' }
        $parts = $Version.Split('.')
        $semverCode = [int]$parts[0]*10000 + [int]$parts[1]*100 + [int]$parts[2]
        $maxCode = ($history.releases | Measure-Object versionCode -Maximum).Maximum
        $versionCode = if ($existing.Count) { [int]$existing[0].versionCode } else { [Math]::Max($semverCode, [int]$maxCode+1) }
        Write-Host "Aurora preflight OK: $Version / code $versionCode"
    }
    if ($PreflightOnly) {
        $script:auroraServiceKey = $null
        Write-Host 'Preflight complete. No publication changes made.'
        exit 0
    }
}
if (-not $SkipBuild -and -not $SyncAuroraOnly) {
    Invoke-CheckedNative bun @('run','tauri','build')
    Invoke-CheckedNative bun @('scripts/copy-build-releases.ts')
}
if (-not (Test-Path -LiteralPath $installer)) { throw 'Prepared installer is missing.' }
$hash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
$bytes = (Get-Item -LiteralPath $installer).Length
if ($SkipBuild -and -not $SyncAuroraOnly) {
    $manifestPath = $BuildManifest
    if (-not $manifestPath) {
        $candidates = @(Get-ChildItem -LiteralPath (Join-Path $root 'process') -Filter BUILD_MANIFEST.json -Recurse | Where-Object {
            $candidate = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
            $candidate.version -eq $Version -and $candidate.sha256 -eq $hash
        })
        if ($candidates.Count -ne 1) { throw 'Specify the unique prepared BuildManifest for SkipBuild.' }
        $manifestPath = $candidates[0].FullName
    }
    if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Prepared build manifest is required for SkipBuild.' }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.version -ne $Version -or $manifest.sha256 -ne $hash -or $manifest.bytes -ne $bytes) { throw 'Installer does not match its build manifest.' }
    $knownPaths = @($manifest.uncommittedSourceHashes.PSObject.Properties.Name)
    $changed = @(Invoke-CheckedNative git @('diff','--name-only',$manifest.sourceCommit,'--','src','src-tauri'))
    foreach ($path in $changed) { if ($path -notin $knownPaths) { throw "Source changed since build: $path" } }
    foreach ($property in $manifest.uncommittedSourceHashes.PSObject.Properties) {
        if ((Get-FileHash -LiteralPath $property.Name -Algorithm SHA256).Hash -ne $property.Value) { throw "Source hash changed since build: $($property.Name)" }
    }
    Write-Host 'Prepared installer and source snapshot verified.'
}
[IO.File]::WriteAllText("$installer.sha256", "$hash  $assetName" + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
if ($LocalOnly) { Write-Host "Local installer verified: $assetName ($hash)"; exit 0 }
if (-not $SyncAuroraOnly) {
    Invoke-CheckedNative git @('tag','-a',$tag,'-m',"Prisma $Version")
    Invoke-CheckedNative git @('push','--atomic','origin','HEAD:refs/heads/preview','HEAD:refs/heads/main',"refs/tags/$tag")
    Invoke-CheckedNative gh @('release','create',$tag,$installer,"$installer.sha256",'--repo',$repo,'--verify-tag','--latest','--title',"Prisma $Version",'--notes-file',$notesPath)
}
$published = Get-GitHubRelease
if ($published.draft -or $published.prerelease -or $published.tag_name -ne $tag -or $published.body.Trim() -ne $notes.Trim()) { throw 'GitHub release readback differs from the prepared release.' }
$asset = @($published.assets | Where-Object name -eq $assetName)
if ($asset.Count -ne 1 -or $asset[0].size -ne $bytes -or $asset[0].browser_download_url -ne $assetUrl) { throw 'GitHub installer asset verification failed.' }
if (-not $asset[0].digest -or $asset[0].digest -ne "sha256:$hash") { throw 'GitHub installer checksum verification failed.' }
try { $head = Invoke-WebRequest -Uri $assetUrl -Method Head -UseBasicParsing -TimeoutSec 60 }
catch { throw 'Public GitHub download check failed.' }
if ($head.StatusCode -ne 200) { throw 'GitHub download is not publicly available.' }
Write-Host "GitHub release and public download verified: $releaseUrl"
if (-not $SkipAuroraUpload) {
    $payload = [ordered]@{appId=$appId; versionName=$Version; versionCode=$versionCode; downloadUrl=$assetUrl; releaseNotes=$notes; status='published'; sha256Checksum=$hash}
    $result = Invoke-AuroraAdmin POST '/api/admin/developer-app-releases' $payload
    if (-not $result.success) { throw 'Aurora rejected release metadata.' }
    $history = Invoke-AuroraAdmin GET "/api/admin/developer-app-releases?appId=$appId" $null
    $record = @($history.releases | Where-Object versionName -eq $Version)
    if ($record.Count -ne 1 -or $record[0].versionCode -ne $versionCode -or $record[0].sha256Checksum -ne $hash -or $record[0].releaseNotes.Trim() -ne $notes.Trim() -or $record[0].downloadUrl -ne $assetUrl -or $record[0].status -ne 'published') { throw 'Aurora metadata readback failed.' }
    $script:auroraServiceKey = $null
    Write-Host "Aurora metadata verified: $baseUrl/desarrollo/prisma"
}
Write-Host "Published Prisma $Version. SHA-256: $hash"
