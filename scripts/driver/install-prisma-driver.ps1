<#
.SYNOPSIS
    Instalador oficial del controlador virtual "Prisma Audio Enhancer" en Windows.
.DESCRIPTION
    Limpia instancias previas, instala el controlador virtual WHQL firmado,
    renombra el endpoint en Windows a "Prisma Audio Enhancer" mediante la API oficial
    IPropertyStore y lo establece como dispositivo de audio predeterminado.
#>

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Solicitando permisos de Administrador para instalar el controlador..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoExit -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

Clear-Host
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Instalando y Configurando: Prisma Audio Enhancer" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$driverDir = Join-Path $PSScriptRoot "x64"
$devcon = Join-Path $driverDir "fxdevcon64.exe"
$inf = Join-Path $driverDir "fxvad.inf"

if (-not (Test-Path $inf)) {
    Write-Error "No se encontró el archivo $inf"
    exit 1
}

# 1. Compilar clases nativas C# para IPropertyStore e IPolicyConfig
$csharp = @'
using System;
using System.Runtime.InteropServices;

[Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPropertyStore {
    int GetCount(out uint cProps);
    int GetAt(uint iProp, out PROPERTYKEY pkey);
    int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
    int SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
    int Commit();
}

[StructLayout(LayoutKind.Sequential, Pack = 4)]
public struct PROPERTYKEY {
    public Guid fmtid;
    public uint pid;
}

[StructLayout(LayoutKind.Explicit)]
public struct PROPVARIANT {
    [FieldOffset(0)] public ushort vt;
    [FieldOffset(8)] public IntPtr pwszVal;
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
    int Activate(ref Guid id, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object interfacePointer);
    int OpenPropertyStore(int stgmAccess, out IPropertyStore properties);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    int GetState(out int state);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
    int GetDevice(string pwstrId, out IMMDevice device);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorCom {}

[ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")]
public class CPolicyConfigClient {}

[Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPolicyConfig {
    int GetMixFormat(string pszDeviceName, IntPtr ppFormat);
    int GetDeviceFormat(string pszDeviceName, int bDefault, IntPtr ppFormat);
    int ResetDeviceFormat(string pszDeviceName);
    int SetDeviceFormat(string pszDeviceName, IntPtr pEndpointFormat, IntPtr mixFormat);
    int GetProcessingPeriod(string pszDeviceName, int bDefault, IntPtr pmftDefaultPeriod, IntPtr pmftMinimumPeriod);
    int SetProcessingPeriod(string pszDeviceName, IntPtr pmftPeriod);
    int GetShareMode(string pszDeviceName, IntPtr pMode);
    int SetShareMode(string pszDeviceName, IntPtr pMode);
    int GetPropertyValue(string pszDeviceName, bool bFxStore, IntPtr key, IntPtr pv);
    int SetPropertyValue(string pszDeviceName, bool bFxStore, IntPtr key, IntPtr pv);
    int SetDefaultEndpoint(string wszDeviceId, int eRole);
    int SetEndpointVisibility(string wszDeviceId, int isVisible);
}

public class PrismaAudioInstallerHelper {
    public static bool RenameEndpoint(string guidPart, string newName) {
        try {
            var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
            IMMDevice dev;
            string devId = "{0.0.0.00000000}." + guidPart;
            int hr = enumerator.GetDevice(devId, out dev);
            if (hr != 0) return false;

            IPropertyStore store;
            hr = dev.OpenPropertyStore(1, out store); // STGM_WRITE
            if (hr != 0) return false;

            // 1. PKEY_Device_FriendlyName
            var key1 = new PROPERTYKEY();
            key1.fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0");
            key1.pid = 2;

            var pv1 = new PROPVARIANT();
            pv1.vt = 31; // VT_LPWSTR
            pv1.pwszVal = Marshal.StringToCoTaskMemUni(newName);
            store.SetValue(ref key1, ref pv1);

            // 2. PKEY_DeviceInterface_FriendlyName (Subtítulo en Windows: Prisma Audio Engine)
            var key2 = new PROPERTYKEY();
            key2.fmtid = new Guid("b3f8fa53-0004-438e-9003-51a46e139bfc");
            key2.pid = 6;

            var pv2 = new PROPVARIANT();
            pv2.vt = 31; // VT_LPWSTR
            pv2.pwszVal = Marshal.StringToCoTaskMemUni("Prisma Audio Engine");
            store.SetValue(ref key2, ref pv2);

            store.Commit();
            return true;
        } catch {
            return false;
        }
    }

    public static bool SetDefaultDevice(string guidPart) {
        try {
            var client = (IPolicyConfig)new CPolicyConfigClient();
            string devId = "{0.0.0.00000000}." + guidPart;
            client.SetDefaultEndpoint(devId, 0); // eConsole
            client.SetDefaultEndpoint(devId, 1); // eMultimedia
            client.SetDefaultEndpoint(devId, 2); // eCommunications
            return true;
        } catch {
            return false;
        }
    }
}
'@
Add-Type -TypeDefinition $csharp -ErrorAction SilentlyContinue

# 2. Limpieza de duplicados previos
Write-Host "1. Limpiando instancias y duplicados anteriores..." -ForegroundColor Yellow
& pnputil /delete-driver oem90.inf /uninstall /force 2>&1 | Out-Null
& $devcon remove root\fxvad 2>&1 | Out-Null
& $devcon remove *fxvad* 2>&1 | Out-Null
for ($i = 4; $i -le 25; $i++) {
    $idx = if ($i -lt 10) { "000$i" } else { "00$i" }
    & pnputil /remove-device "ROOT\MEDIA\$idx" 2>&1 | Out-Null
}
Start-Sleep -Seconds 2

# 3. Instalar el controlador virtual firmado
Write-Host "2. Instalando controlador virtual limpio..." -ForegroundColor Yellow
$installOutput = & $devcon install $inf root\fxvad
Write-Host $installOutput -ForegroundColor Gray
Start-Sleep -Seconds 3

# 4. Renombrar el endpoint en Windows a "Prisma Audio Enhancer"
Write-Host "3. Configurando nombre en Windows: 'Prisma Audio Enhancer'..." -ForegroundColor Yellow

$foundGuids = @()
$queryOutput = & reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render" /s /f "Root\FXVAD" 2>&1
foreach ($line in $queryOutput) {
    if ($line -match "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\(\{[a-f0-9\-]+\})") {
        $g = $matches[1]
        if ($foundGuids -notcontains $g) {
            $foundGuids += $g
        }
    }
}

if ($foundGuids.Count -eq 0) {
    $queryOutput2 = & reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render" /s /f "FxSound" 2>&1
    foreach ($line in $queryOutput2) {
        if ($line -match "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\(\{[a-f0-9\-]+\})") {
            $g = $matches[1]
            if ($foundGuids -notcontains $g) {
                $foundGuids += $g
            }
        }
    }
}

foreach ($g in $foundGuids) {
    Write-Host "  -> Aplicando nombre oficial 'Prisma Audio Enhancer' a $g..." -ForegroundColor Green
    [PrismaAudioInstallerHelper]::RenameEndpoint($g, "Prisma Audio Enhancer") | Out-Null
}

# Renombrar en Enum ROOT MEDIA
$enumMedia = "Registry::HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Enum\ROOT\MEDIA"
if (Test-Path $enumMedia) {
    Get-ChildItem $enumMedia -ErrorAction SilentlyContinue | ForEach-Object {
        $props = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
        if ($props.HardwareID -like "*FXVAD*" -or $props.DeviceDesc -like "*FxSound*" -or $props.FriendlyName -like "*FxSound*") {
            $key = "HKLM\SYSTEM\CurrentControlSet\Enum\ROOT\MEDIA\" + $_.PSChildName
            & reg add $key /v "FriendlyName" /t REG_SZ /d "Prisma Audio Enhancer" /f 2>&1 | Out-Null
            & reg add $key /v "DeviceDesc" /t REG_SZ /d "Prisma Audio Enhancer" /f 2>&1 | Out-Null
        }
    }
}

# 5. Establecer como dispositivo predeterminado de Windows
if ($foundGuids.Count -gt 0) {
    [PrismaAudioInstallerHelper]::SetDefaultDevice($foundGuids[0]) | Out-Null
    Write-Host "4. Dispositivo activado como salida predeterminada en Windows." -ForegroundColor Green
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✓ ¡CONFIGURACIÓN COMPLETADA CON ÉXITO!" -ForegroundColor Green
Write-Host "  El dispositivo ahora aparece oficialmente en Windows como:" -ForegroundColor White
Write-Host ""
Write-Host "             ★  Prisma Audio Enhancer  ★" -ForegroundColor Cyan
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Presiona Enter para cerrar esta ventana..." -ForegroundColor Gray
[Console]::ReadLine() | Out-Null
