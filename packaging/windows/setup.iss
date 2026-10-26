; ============================================================================
; Prisma - Instalador de Windows (Inno Setup 6.7+)
; ----------------------------------------------------------------------------
; Basado en la plantilla compartida "Biglex Modern 2.0" (copia autocontenida en
; packaging/windows). Esta copia conserva el trabajo funcional de Prisma:
; asociaciones de archivo, recursos embebidos, WebView2, accesos directos y
; ejecución al terminar.
;
; version.iss, associations.iss y associations.pas los genera
; scripts/packaging/Build-Installer.ps1 en cada build.
;
; Compilar:
;   & "D:\Proyectos\biglexj\Scripts\tools\InnoSetup\ISCC.exe" setup.iss
; ============================================================================

#include "version.iss"
#include "identity.iss"

; Carpeta de staging con el ejecutable y los recursos (la define el build).
#ifndef MyAppStagingDir
  #define MyAppStagingDir "..\..\src-tauri\target\inno\staging"
#endif

; Carpeta de salida del instalador compilado.
#ifndef MyAppOutputDir
  #define MyAppOutputDir "..\..\src-tauri\target\inno\output"
#endif

[Setup]
; --- IDENTIDAD DE ACTUALIZACION: unica y estable por app -------------------
; Mantenerla para que una version nueva actualice la anterior y no cree una
; instalacion paralela. (Migracion desde NSIS: ver MIGRATION.md)
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher=Biglex
AppPublisherURL=https://www.biglexj.com
AppSupportURL=https://www.biglexj.com
DefaultDirName={localappdata}\Programs\{#MyAppDirectory}
DefaultGroupName={#MyAppName}
; --- Pantallas: solo la nuestra + progreso + exito --------------------------
DisableWelcomePage=yes
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
OutputDir={#MyAppOutputDir}
; Nombre de release que espera scripts/release/build-release.ps1.
OutputBaseFilename=Prisma_{#MyAppVersion}-setup
SetupIconFile={#MyAppIcon}
UninstallDisplayIcon={app}\{#MyAppExe}
UninstallDisplayName={#MyAppName}
Compression=lzma2/max
SolidCompression=yes
ShowLanguageDialog=no
; --- Identidad visual moderna + tema claro/oscuro automatico (IS 6.6+) ---
WizardStyle=modern {#MyAppTheme}
#if MyAppTheme == "dark"
WizardBackColor=#15191C
WizardImageBackColor=#15191C
#else
WizardBackColor=#F7F9FA
WizardImageBackColor=clWhite
#endif
WizardBackColorDynamicDark=#15191C
WizardImageBackColorDynamicDark=#15191C
; --- Instalacion por usuario (sin privilegios de administrador) -------------
; PrivilegesRequiredOverridesAllowed se deja vacio a proposito: abrir el
; dialogo "Seleccion del Modo de Instalacion" anade una pantalla extra.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; --- Comportamiento --------------------------------------------------------
CloseApplications=yes
RestartApplications=no
SetupLogging=yes
VersionInfoDescription={#MyAppName} instalador
VersionInfoProductName={#MyAppName}
VersionInfoCompany=Biglex

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Messages]
spanish.FinishedHeadingLabel=Instalación completada
spanish.FinishedLabel={#MyAppName} se instaló correctamente.
spanish.FinishedLabelNoIcons={#MyAppName} se instaló correctamente.
spanish.ClickFinish=Pulsa Finalizar para cerrar el instalador.

[CustomMessages]
spanish.RunApp=Ejecutar {#MyAppName}

[Tasks]
; Acceso directo de escritorio opcional: se activa con /TASKS=desktopicon.
; No se anade ninguna pagina al asistente.
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Primero el icono: extraerlo no debe descomprimir antes todo el payload solid.
Source: "{#MyAppIcon}"; Flags: dontcopy
; Ejecutable y recursos embebidos (libmpv, libunwind, ffmpeg) preparados por el build.
Source: "{#MyAppStagingDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs solidbreak

[Registry]
; --- Asociaciones de archivo (generado desde tauri.conf.json) --------------
; El valor por defecto de cada extension apunta al ProgID; el desinstalador
; lo limpia y restaura el valor previo (ver associations.pas).
#include "associations.iss"

#ifndef MyTemplatePreview
[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Lanza la app a traves del shell del escritorio: heredar el contexto del
; instalador hace que el proceso falle con 0xc00004bc (STATUS_REDIRECTION_TRUST_FAILURE).
; Nota: explorer.exe vive en {win}, no en {sys}.
Filename: "{win}\explorer.exe"; Parameters: """{app}\{#MyAppExe}"""; Description: "{cm:RunApp}"; Flags: nowait postinstall skipifsilent
#endif

; UI compartida "Biglex Modern 2.0": presentacion y validacion de la entrada.
#include "BiglexModernUI.iss"
#include "PrismaInstallerUI.iss"

[Code]
var
  AssocData: array[0..255] of string;
  AssocCount: Integer;

const
  AssocBackupKey = 'Software\Biglex\Prisma\FileAssocBackup';
  AssocClassesKey = 'Software\Classes';
  WebView2Guid = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WebView2BootstrapperUrl = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703';

#include "associations.pas"

// --- Asociaciones de archivo ------------------------------------------------
// El instalador deja el valor por defecto de cada extension apuntando al
// ProgID de Prisma (igual que hacia NSIS). Antes de sobrescribirlo se guarda
// el valor previo y al desinstalar se restaura.
function AssocExtOf(const Pair: String): String;
var
  Separator: Integer;
begin
  Separator := Pos('=', Pair);
  if Separator = 0 then
    Result := ''
  else
    Result := Copy(Pair, 1, Separator - 1);
end;

function AssocProgOf(const Pair: String): String;
var
  Separator: Integer;
begin
  Separator := Pos('=', Pair);
  if Separator = 0 then
    Result := ''
  else
    Result := Copy(Pair, Separator + 1, 255);
end;

procedure BackupAssociations();
var
  I: Integer;
  Ext, ProgId, Current: String;
begin
  Log('Prisma: respaldando asociaciones de archivo');
  for I := 0 to AssocCount - 1 do
  begin
    Ext := AssocExtOf(AssocData[I]);
    ProgId := AssocProgOf(AssocData[I]);
    Current := '';
    if RegQueryStringValue(HKCU, AssocClassesKey + '\.' + Ext, '', Current) then
      // Solo se respalda si la extension estaba asociada a otra aplicacion.
      if (Current <> '') and (CompareText(Current, ProgId) <> 0) then
        RegWriteStringValue(HKCU, AssocBackupKey, Ext, Current);
  end;
end;

procedure RestoreAssociations();
var
  I: Integer;
  Ext, ProgId, Current, Backup: String;
begin
  Log('Prisma: restaurando asociaciones de archivo');
  for I := 0 to AssocCount - 1 do
  begin
    Ext := AssocExtOf(AssocData[I]);
    ProgId := AssocProgOf(AssocData[I]);
    Current := '';
    if RegQueryStringValue(HKCU, AssocClassesKey + '\.' + Ext, '', Current) then
      // Si el valor sigue apuntando a Prisma, se retira la asociacion.
      if CompareText(Current, ProgId) = 0 then
        RegDeleteValue(HKCU, AssocClassesKey + '\.' + Ext, '');
    Backup := '';
    if RegQueryStringValue(HKCU, AssocBackupKey, Ext, Backup) then
      // Y se restaura la asociacion que hubiera antes de instalar Prisma.
      if Backup <> '' then
      begin
        RegWriteStringValue(HKCU, AssocClassesKey + '\.' + Ext, '', Backup);
        RegDeleteValue(HKCU, AssocBackupKey, Ext);
      end;
  end;
  RegDeleteKeyIfEmpty(HKCU, AssocBackupKey);
  RegDeleteKeyIfEmpty(HKCU, 'Software\Biglex\Prisma');
end;

// --- WebView2: mismo comportamiento que el instalador NSIS de Tauri ---------
// El runtime de WebView2 es requisito de la app (wry). Si no esta instalado,
// se descarga el bootstrapper oficial y se ejecuta en silencio, igual que
// hacia NSIS con webviewInstallMode=downloadBootstrapper.
function WebView2RuntimePresent: Boolean;
var
  Version: String;
  ClientKey: String;
begin
  ClientKey := 'SOFTWARE\Microsoft\EdgeUpdate\Clients\' + WebView2Guid;
  Version := '';
  Result := False;
  if RegQueryStringValue(HKLM64, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\' + WebView2Guid, 'pv', Version) and (Version <> '') then
    Result := True;
  if not Result then
  begin
    Version := '';
    if RegQueryStringValue(HKLM32, ClientKey, 'pv', Version) and (Version <> '') then
      Result := True;
  end;
  if not Result then
  begin
    Version := '';
    if RegQueryStringValue(HKLM, ClientKey, 'pv', Version) and (Version <> '') then
      Result := True;
  end;
  if not Result then
  begin
    Version := '';
    if RegQueryStringValue(HKCU, ClientKey, 'pv', Version) and (Version <> '') then
      Result := True;
  end;
end;

procedure InstallWebView2Runtime();
var
  Curl: String;
  Bootstrapper: String;
  ResultCode: Integer;
  Ok: Boolean;
begin
  if WebView2RuntimePresent then
    Exit;

  Curl := ExpandConstant('{sys}\curl.exe');
  if not FileExists(Curl) then
  begin
    MsgBox('No se pudo instalar WebView2 Runtime porque falta curl.exe en el sistema.' + #13#10 +
           'Descargalo desde https://developer.microsoft.com/microsoft-edge/webview2/ y vuelve a ejecutar el instalador.',
           mbError, MB_OK);
    Exit;
  end;

  Bootstrapper := ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe');
  ResultCode := 0;
  Ok := Exec(Curl, '-fsSL -o "' + Bootstrapper + '" "' + WebView2BootstrapperUrl + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if (not Ok) or (ResultCode <> 0) or (not FileExists(Bootstrapper)) then
  begin
    MsgBox('No se pudo descargar WebView2 Runtime.' + #13#10 +
           'Descargalo desde https://developer.microsoft.com/microsoft-edge/webview2/ y vuelve a ejecutar el instalador.',
           mbError, MB_OK);
    Exit;
  end;

  ResultCode := 0;
  Exec(Bootstrapper, '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure InitializeWizard();
begin
  ModernInitialize;
  PrismaInitialize;
  // La entrada tiene su propio logo. Las páginas nativas de progreso también
  // deben mostrar la identidad de Prisma en lugar de dejar la cabecera vacía.
  if not InitializeBitmapImageFromIcon(WizardForm.WizardSmallBitmapImage,
    ExpandConstant('{tmp}\{#MyAppIcon}'), ModernBackground, [16, 24, 32, 48, 64]) then
    Log('No se pudo cargar el icono de Prisma en la cabecera de progreso.');
  InitAssocData;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  ModernPageChanged(CurPageID);
  PrismaPageChanged(CurPageID);
  WizardForm.WizardSmallBitmapImage.Visible := CurPageID <> ModernPage.ID;
end;

function NextButtonClick(WizardPageID: Integer): Boolean;
begin
  Result := ModernNextButtonClick(WizardPageID);
  if not Result then
    Exit;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  { La tarea "acceso directo en el escritorio" se puede activar por linea de
    comandos (/TASKS=desktopicon), pero no se anade ninguna pagina al
    asistente: el flujo sigue siendo entrada -> progreso -> exito. }
  Result := PageID = wpSelectTasks;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    // Guardar la asociacion previa de cada extension antes de sobrescribirla.
    BackupAssociations;
    // El runtime de WebView2 se instala antes de copiar los archivos.
    InstallWebView2Runtime;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    RestoreAssociations;
end;

[Code]
procedure CancelButtonClick(CurPageID: Integer; var Cancel, Confirm: Boolean);
begin
  PrismaCancelButtonClick(CurPageID, Cancel, Confirm);
end;
