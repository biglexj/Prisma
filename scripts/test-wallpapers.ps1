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
    @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
 <assemblyIdentity version="1.0.0.0" processorArchitecture="amd64" name="Prisma.Tests" type="win32"/>
 <dependency><dependentAssembly><assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="amd64" publicKeyToken="6595b64144ccf1df" language="*"/></dependentAssembly></dependency>
</assembly>
'@ | Set-Content -LiteralPath $manifest -Encoding utf8
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
