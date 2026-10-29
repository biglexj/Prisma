param([string]$Filter = 'wallpapers')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    $messages = & cargo test --manifest-path src-tauri/Cargo.toml --lib --no-run --message-format=json
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el ejecutable de pruebas.' }
    $artifact = $messages | ForEach-Object {
        try { $_ | ConvertFrom-Json } catch { }
    } | Where-Object { $_.reason -eq 'compiler-artifact' -and $_.profile.test -and $_.executable } | Select-Object -Last 1
    if (-not $artifact) { throw 'Cargo no devolvió un ejecutable de pruebas.' }
    $testExe = [IO.Path]::GetFullPath($artifact.executable)
    # El harness libtest no recibe el manifiesto del ejecutable principal Tauri.
    # Common Controls v6 es necesario para resolver TaskDialogIndirect al cargar.
    $manifest = "$testExe.manifest"
    # Mantener también la compatibilidad Windows 10/11: las superficies
    # WS_EX_LAYERED hijas deben probarse con el mismo contrato que la app.
    Copy-Item -LiteralPath (Join-Path $root 'src-tauri/windows-app.manifest') -Destination $manifest -Force
    $mt = Get-Command mt.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
    if (-not $mt) {
        $sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
        $mt = Get-ChildItem -LiteralPath $sdk -Recurse -Filter mt.exe | Where-Object { $_.Directory.Name -eq 'x64' } |
            Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $mt) { throw 'Se necesita mt.exe del SDK de Windows para el harness de pruebas.' }
    & $mt -nologo -manifest $manifest "-outputresource:$testExe;#1"
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo añadir el manifiesto al harness.' }
    $runtime = Split-Path (Split-Path $testExe -Parent) -Parent
    $previousPath = $env:PATH
    $env:PATH = "$runtime;$previousPath"
    Push-Location $runtime
    try {
        & $testExe $Filter --test-threads=1
        if ($LASTEXITCODE -ne 0) { throw "Pruebas fallidas: $LASTEXITCODE" }
    } finally {
        Pop-Location
        $env:PATH = $previousPath
    }
} finally { Pop-Location }
