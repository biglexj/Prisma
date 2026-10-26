#ifndef MyAppSubtitle
  #define MyAppSubtitle "Instala tu aplicación y comienza a disfrutarla."
#endif
; Biglex Modern UI 2.0. Copiar junto al setup.iss; sin dependencias externas.
; Requiere MyAppName y MyAppIcon definidos por el instalador.
; Coordenadas lógicas a 96 DPI. ScaleX/ScaleY se aplican UNA vez a todo.
;
; ---------------------------------------------------------------------------
; AJUSTES DE TECLADO VERIFICADOS FISICAMENTE (21-10-2026, LyraFlow)
; ---------------------------------------------------------------------------
; 1) WinSetFocus: WizardForm.ActiveControl no mueve el foco a controles que
;    viven dentro de un panel, asi que se usa la API de Windows.
; 2) ModernPathKeyDown: el motor de Inno no enruta al formulario las teclas
;    que consume el control de edicion, de modo que el campo de ruta gestiona
;    su propio Tab y su propia Enter.
; 3) ModernKeyUp atiende Enter y Espacio sobre los botones: el motor de Inno
;    tampoco enruta al formulario esas teclas sobre los botones de la plantilla.
; 4) Los botones nativos Siguiente y Cancelar salen del recorrido del tab
;    (quedan tapados por el panel opaco) y Siguiente deja de ser el boton por
;    defecto, para que Enter no avance el asistente por su cuenta. Siguen
;    visibles: el motor los necesita en modo silencioso.
; ---------------------------------------------------------------------------
[Code]
const
  ModernWidth = 560;
  ModernHeight = 444;
  ModernMargin = 20;
  ModernControlRadius = 10;
  ModernLogoRadius = 10;
  ModernAccent = $B9C900;  // #00C9B9 (BGR: B=B9, G=C9, R=00)
var
  ModernPage: TWizardPage;
  ModernHost: TPanel;
  ModernPath: TEdit;
  ModernInstall, ModernFolder: TBitmapButton;
  ModernInstallFocus, ModernFolderFocus: TBitmapImage;
  ModernBackground, ModernSurface, ModernText, ModernMuted, ModernLine,
    ModernLogoSurface: TColor;
  ModernFocusSet: Boolean;
  ModernExitForm: TSetupForm;
  ModernExitYes, ModernExitNo: TBitmapButton;
  ModernExitAccepted: Boolean;
  ModernNextBtn, ModernCancelBtn: TBitmapButton;
  ModernYesRadioImg, ModernNoRadioImg: TBitmapImage;

{ Foco real de un control. WizardForm.ActiveControl solo admite controles
  directos del formulario y los de esta plantilla viven en un panel, asi que
  se usa la API de Windows. }
function WinSetFocus(hWnd: Longint): Longint;
  external 'SetFocus@user32.dll stdcall';

procedure ModernLabel(const Text: String; X, Y, W, H, Size: Integer;
  Color: TColor; Bold, Centered: Boolean);
var L: TNewStaticText;
begin
  L := TNewStaticText.Create(WizardForm);
  L.Parent := ModernHost;
  L.AutoSize := False;
  L.SetBounds(ScaleX(X), ScaleY(Y), ScaleX(W), ScaleY(H));
  L.Caption := Text;
  L.Font.Name := 'Segoe UI';
  L.Font.Size := Size;
  L.Font.Color := Color;
  L.Color := ModernBackground;
  L.StyleElements := [];
  L.ShowAccelChar := False;
  L.WordWrap := False;
  if Bold then L.Font.Style := [fsBold];
  if Centered then L.Alignment := taCenter;
end;

{ Etiqueta de la cabecera de la app con ajuste automatico: si el nombre no cabe
  en el ancho disponible se reduce el cuerpo de la fuente, en lugar de dejar el
  texto recortado a media palabra.

  IMPORTANTE: la medicion se hace sobre un TCanvas auxiliar. Ese canvas NO
  conserva la fuente que se le asigna, asi que TextWidth devuelve el ancho con
  la fuente del sistema y el ajuste automatico nunca se activa (sintoma: el
  ultimo caracter del nombre quedaba cortado). Por eso el nombre va con
  WordWrap activado y una banda de dos lineas: aunque la medicion falle, el
  texto se reparte en dos lineas y NO se recorta. }
procedure ModernAppName(const Text: String; X, Y, W, H, Size: Integer; Color: TColor);
var
  L: TNewStaticText;
  M: TBitmapImage;
  S: Integer;
begin
  { Se mide con el canvas de un bitmap auxiliar para decidir el cuerpo de la
    fuente: si el nombre no cabe, se reduce en lugar de recortarse. }
  M := TBitmapImage.Create(WizardForm);
  M.SetBounds(0, 0, 8, 8);
  M.Visible := False;
  M.Bitmap.Canvas.Font.Name := 'Segoe UI';
  M.Bitmap.Canvas.Font.Style := [fsBold];
  S := Size;
  M.Bitmap.Canvas.Font.Height := -((S * 4) div 3);
  while (M.Bitmap.Canvas.TextWidth(Text) > ScaleX(W) - ScaleX(14)) and (S > 7) do
  begin
    Dec(S);
    M.Bitmap.Canvas.Font.Height := -((S * 4) div 3);
  end;
  L := TNewStaticText.Create(WizardForm);
  L.Parent := ModernHost;
  L.AutoSize := False;
  { WordWrap con banda de dos lineas: garantiza que un nombre largo se
    reparta en lugar de recortarse, aunque la medicion no sea fiable. }
  L.WordWrap := True;
  L.SetBounds(ScaleX(X), ScaleY(Y), ScaleX(W), ScaleY(H));
  L.Caption := Text;
  L.Font.Name := 'Segoe UI';
  L.Font.Size := S;
  L.Font.Color := Color;
  L.Color := ModernBackground;
  L.StyleElements := [];
  L.ShowAccelChar := False;
  L.WordWrap := False;
  L.Font.Style := [fsBold];
end;

procedure ModernRound(Bitmap: TBitmap; W, H, Radius: Integer;
  Outside, Inside: TColor);
var Bounds: TRect;
begin
  Bitmap.Width := ScaleX(W);
  Bitmap.Height := ScaleY(H);
  Bitmap.Canvas.Brush.Color := Outside;
  Bounds.Left := 0;
  Bounds.Top := 0;
  Bounds.Right := Bitmap.Width;
  Bounds.Bottom := Bitmap.Height;
  Bitmap.Canvas.FillRect(Bounds);
  Bitmap.Canvas.Brush.Color := Inside;
  Bitmap.Canvas.Pen.Color := Inside;
  Bitmap.Canvas.RoundRect(0, 0, Bitmap.Width, Bitmap.Height,
    ScaleX(Radius * 2), ScaleY(Radius * 2));
end;

procedure ModernTile(X, Y, W, H, Radius: Integer; Color: TColor);
var Image: TBitmapImage;
begin
  Image := TBitmapImage.Create(WizardForm);
  Image.Parent := ModernHost;
  Image.SetBounds(ScaleX(X), ScaleY(Y), ScaleX(W), ScaleY(H));
  ModernRound(Image.Bitmap, W, H, Radius, ModernBackground, Color);
end;

procedure ModernLogo(X, Y, Size: Integer; Background: TColor);
var Image: TBitmapImage;
begin
  Image := TBitmapImage.Create(WizardForm);
  Image.Parent := ModernHost;
  Image.SetBounds(ScaleX(X), ScaleY(Y), ScaleX(Size), ScaleY(Size));
  InitializeBitmapImageFromIcon(Image, ExpandConstant('{tmp}\{#MyAppIcon}'),
    Background, [16, 24, 32, 48, 64, 128, 256]);
  Image.Stretch := True;
  { InitializeBitmapImageFromIcon REDIMENSIONA el control al tamano del icono
    cargado (por ejemplo 32 en una caja de 40), de modo que el grafico se
    quedaba pegado a la esquina superior izquierda del recuadro. Se restauran
    los limites para que el icono quede centrado en su caja. }
  Image.SetBounds(ScaleX(X), ScaleY(Y), ScaleX(Size), ScaleY(Size));
end;

procedure ModernBrowse(Sender: TObject);
var Chosen: String;
begin
  Chosen := ModernPath.Text;
  if BrowseForFolder('Selecciona la ubicación de instalación', Chosen, True) then
    ModernPath.Text := Chosen;
end;

procedure ModernStartInstall(Sender: TObject);
begin
  // Mantener la navegación, validaciones y motor originales de Inno.
  WizardForm.NextButton.OnClick(WizardForm.NextButton);
end;

procedure ModernKeyUp(Sender: TObject; var Key: Word; Shift: TShiftState);
begin
  if WizardForm.CurPageID <> ModernPage.ID then Exit;
  ModernInstallFocus.Visible := ModernInstall.Focused;
  ModernFolderFocus.Visible := ModernFolder.Focused;
  { El motor de Inno no enruta al formulario la pulsacion de Enter y Espacio
    sobre los botones de la plantilla, asi que se atienden aqui. El boton
    Siguiente nativo no es el boton por defecto, de modo que Enter no avanza
    el asistente por su cuenta. }
  if (Key = 13) or (Key = 32) then
  begin
    if ModernFolder.Focused then
    begin
      Key := 0;
      ModernBrowse(Sender);
    end
    else if ModernInstall.Focused then
    begin
      Key := 0;
      ModernStartInstall(Sender);
    end;
  end;
end;

{ El campo de ruta tiene su propio manejador de teclado: el motor de Inno no
  enruta al formulario las teclas que consume el control de edicion. }
procedure ModernPathKeyDown(Sender: TObject; var Key: Word; Shift: TShiftState);
begin
  if not ModernPath.Focused then Exit;
  if Key = 9 then
  begin
    Key := 0;
    if ssShift in Shift then
      WinSetFocus(ModernInstall.Handle)
    else
      WinSetFocus(ModernFolder.Handle);
  end
  else if Key = 13 then
  begin
    Key := 0;
    ModernStartInstall(Sender);
  end;
end;

procedure ModernKeyDown(Sender: TObject; var Key: Word; Shift: TShiftState);
begin
  if WizardForm.CurPageID <> ModernPage.ID then Exit;
  { El campo de ruta gestiona su propio teclado (ModernPathKeyDown). }
  if ModernPath.Focused then Exit;
  if Key = 9 then
  begin
    // Mantener Tab dentro de los dos controles interactivos del panel inicial:
    // el boton de carpeta y el boton de instalar. El campo de ruta ya no es
    // editable y queda fuera del recorrido.
    Key := 0;
    if ssShift in Shift then
    begin
      if ModernFolder.Focused then WinSetFocus(ModernInstall.Handle)
      else WinSetFocus(ModernFolder.Handle);
    end
    else
    begin
      if ModernFolder.Focused then WinSetFocus(ModernInstall.Handle)
      else WinSetFocus(ModernFolder.Handle);
    end;
  end
  else if ((Key = 13) or (Key = 32)) and ModernFolder.Focused then
  begin
    Key := 0;
    ModernBrowse(Sender);
  end
  else if (Key = 13) or ((Key = 32) and ModernInstall.Focused) then
  begin
    Key := 0;
    ModernStartInstall(Sender);
  end;
end;

procedure ModernPaintRadioBullet(Img: TBitmapImage; Checked: Boolean);
var
  Sz, Center, R, InnerR: Integer;
  Rc: TRect;
begin
  Sz := Img.Width;
  Center := Sz div 2;
  R := Sz div 2 - 1;
  InnerR := Sz div 4;

  Img.Bitmap.Width := Sz;
  Img.Bitmap.Height := Sz;
  Img.Bitmap.Canvas.Brush.Color := WizardForm.Color;
  Rc.Left := 0;
  Rc.Top := 0;
  Rc.Right := Sz;
  Rc.Bottom := Sz;
  Img.Bitmap.Canvas.FillRect(Rc);

  if Checked then
  begin
    Img.Bitmap.Canvas.Pen.Color := ModernAccent;
    Img.Bitmap.Canvas.Pen.Width := ScaleX(2);
    Img.Bitmap.Canvas.Brush.Color := WizardForm.Color;
    Img.Bitmap.Canvas.Ellipse(Center - R, Center - R, Center + R, Center + R);

    Img.Bitmap.Canvas.Pen.Color := ModernAccent;
    Img.Bitmap.Canvas.Brush.Color := ModernAccent;
    Img.Bitmap.Canvas.Ellipse(Center - InnerR, Center - InnerR, Center + InnerR, Center + InnerR);
  end
  else
  begin
    Img.Bitmap.Canvas.Pen.Color := ModernLine;
    Img.Bitmap.Canvas.Pen.Width := ScaleX(1);
    Img.Bitmap.Canvas.Brush.Color := WizardForm.Color;
    Img.Bitmap.Canvas.Ellipse(Center - R, Center - R, Center + R, Center + R);
  end;
end;

procedure ModernRadioBulletClick(Sender: TObject);
begin
  if Sender = ModernYesRadioImg then
    WizardForm.PreparingYesRadio.Checked := True
  else
    WizardForm.PreparingNoRadio.Checked := True;
    
  ModernPaintRadioBullet(ModernYesRadioImg, WizardForm.PreparingYesRadio.Checked);
  ModernPaintRadioBullet(ModernNoRadioImg, WizardForm.PreparingNoRadio.Checked);
end;

procedure ModernRadioClick(Sender: TObject);
begin
  ModernPaintRadioBullet(ModernYesRadioImg, WizardForm.PreparingYesRadio.Checked);
  ModernPaintRadioBullet(ModernNoRadioImg, WizardForm.PreparingNoRadio.Checked);
end;

procedure ModernPaintNextButton();
var
  C: TCanvas;
  Cap: String;
begin
  ModernRound(ModernNextBtn.Bitmap, 92, 26, 4, WizardForm.Color, ModernAccent);
  C := ModernNextBtn.Bitmap.Canvas;
  C.Brush.Style := bsClear;
  C.Font.Name := 'Segoe UI';
  C.Font.Height := -ScaleY(12);
  C.Font.Color := $211C18;
  C.Font.Style := [fsBold];
  Cap := WizardForm.NextButton.Caption;
  StringChangeEx(Cap, '&', '', True);
  C.TextOut((ModernNextBtn.Width - C.TextWidth(Cap)) div 2,
            (ModernNextBtn.Height - C.TextHeight(Cap)) div 2, Cap);
end;

procedure ModernPaintCancelButton();
var
  C: TCanvas;
  Cap: String;
begin
  ModernRound(ModernCancelBtn.Bitmap, 92, 26, 4, WizardForm.Color, ModernSurface);
  C := ModernCancelBtn.Bitmap.Canvas;
  C.Brush.Style := bsClear;
  C.Pen.Color := ModernLine;
  C.Pen.Width := ScaleX(1);
  C.RoundRect(ScaleX(1), ScaleY(1), ModernCancelBtn.Width - ScaleX(1),
    ModernCancelBtn.Height - ScaleY(1), ScaleX(8), ScaleY(8));
  C.Font.Name := 'Segoe UI';
  C.Font.Height := -ScaleY(12);
  C.Font.Color := ModernText;
  Cap := WizardForm.CancelButton.Caption;
  StringChangeEx(Cap, '&', '', True);
  C.TextOut((ModernCancelBtn.Width - C.TextWidth(Cap)) div 2,
            (ModernCancelBtn.Height - C.TextHeight(Cap)) div 2, Cap);
end;

procedure ModernNextBtnClick(Sender: TObject);
begin
  WizardForm.NextButton.OnClick(WizardForm.NextButton);
end;

procedure ModernCancelBtnClick(Sender: TObject);
begin
  WizardForm.CancelButton.OnClick(WizardForm.CancelButton);
end;

procedure ModernInitialize();
var Caption: String; C: TCanvas;
begin
  if IsDarkInstallMode then
  begin
    ModernBackground := $1C1915; // #15191C
    ModernSurface := $302B22;    // #222B30
    ModernText := $F1F0EE;
    ModernMuted := $BDB7AF;
    ModernLine := $37312B;
    ModernLogoSurface := $32361E;
  end
  else
  begin
    ModernBackground := $FAF9F7;
    ModernSurface := $F0EBE5;
    ModernText := $211C18;
    ModernMuted := $6F6358;
    ModernLine := $DED6CE;
    ModernLogoSurface := $E9EFE0;
  end;
  WizardForm.ClientWidth := ScaleX(ModernWidth);
  WizardForm.ClientHeight := ScaleY(ModernHeight);
  WizardForm.Caption := 'Instalar {#MyAppName}';
  ModernPage := CreateCustomPage(wpWelcome, '', '');
  ModernHost := TPanel.Create(WizardForm);
  ModernHost.Parent := WizardForm;
  ModernHost.SetBounds(0, 0, WizardForm.ClientWidth, WizardForm.ClientHeight);
  ModernHost.BevelOuter := bvNone;
  ModernHost.StyleElements := [];
  ModernHost.Color := ModernBackground;
  ModernHost.Visible := False;
  ExtractTemporaryFile('{#MyAppIcon}');
  ModernLogo(ModernMargin, 19, 20, ModernBackground);
  ModernAppName('{#MyAppName}', 48, 21, 366, 26, 10, ModernText);
  ModernLabel('INSTALADOR', 422, 22, 118, 20, 9, ModernMuted, False, True);
  ModernTile(ModernMargin, 60, 520, 1, 0, ModernLine);
  ModernTile(248, 96, 64, 64, ModernLogoRadius, ModernLogoSurface);
  ModernLogo(254, 102, 52, ModernLogoSurface);
  ModernLabel('Todo listo para comenzar', ModernMargin, 174, 520, 38,
    20, ModernText, True, True);
  ModernLabel('{#MyAppSubtitle}',
    ModernMargin, 218, 520, 40, 10, ModernMuted, False, True);
  ModernTile(ModernMargin, 262, 520, 70, ModernControlRadius, ModernSurface);
  ModernLabel('Ubicación de instalación', 32, 274, 464, 20,
    9, ModernMuted, False, False);
  // La etiqueta tiene el mismo fondo que la tarjeta.
  TNewStaticText(ModernHost.Controls[ModernHost.ControlCount - 1]).Color := ModernSurface;
  ModernPath := TEdit.Create(WizardForm);
  ModernPath.Parent := ModernHost;
  ModernPath.StyleElements := [];
  ModernPath.BorderStyle := bsNone;
  ModernPath.Color := ModernSurface;
  ModernPath.Font.Name := 'Segoe UI';
  ModernPath.Font.Size := 9;
  ModernPath.Font.Color := ModernText;
  ModernPath.SetBounds(ScaleX(32), ScaleY(302), ScaleX(376), ScaleY(22));
  ModernPath.Text := WizardForm.DirEdit.Text;
  { La ruta se informa, no se escribe: la ubicacion se elige con el boton de
    carpeta. En solo lectura el texto se puede seleccionar y copiar, pero no
    editar a mano, que es lo que nadie hace. }
  ModernPath.ReadOnly := True;
  { Fuera del recorrido del tab: al recibir el foco un campo de texto selecciona
    todo su contenido, y la ruta aparecia resaltada al abrir el instalador. }
  ModernPath.TabStop := False;
  ModernPath.TabOrder := 0;
  ModernPath.OnKeyDown := @ModernPathKeyDown;
  ModernFolderFocus := TBitmapImage.Create(WizardForm);
  ModernFolderFocus.Parent := ModernHost;
  ModernFolderFocus.SetBounds(ScaleX(414), ScaleY(292), ScaleX(100), ScaleY(32));
  ModernRound(ModernFolderFocus.Bitmap, 100, 32, 6, ModernSurface, ModernText);
  ModernFolderFocus.Visible := False;
  ModernFolder := TBitmapButton.Create(WizardForm);
  ModernFolder.Parent := ModernHost;
  ModernFolder.SetBounds(ScaleX(416), ScaleY(294), ScaleX(96), ScaleY(28));
  ModernFolder.Caption := 'Examinar...';
  ModernFolder.Hint := 'Elegir carpeta de instalacion';
  ModernFolder.ShowHint := True;
  ModernFolder.TabStop := True;
  ModernFolder.TabOrder := 1;
  ModernFolder.Cursor := crHand;
  ModernFolder.BackColor := ModernSurface;
  ModernRound(ModernFolder.Bitmap, 96, 28, 4, ModernSurface, ModernSurface);
  C := ModernFolder.Bitmap.Canvas;
  C.Pen.Color := ModernAccent;
  C.Pen.Width := ScaleX(1);
  C.MoveTo(ScaleX(9), ScaleY(10));
  C.LineTo(ScaleX(9), ScaleY(8));
  C.LineTo(ScaleX(15), ScaleY(8));
  C.LineTo(ScaleX(18), ScaleY(10));
  C.LineTo(ScaleX(23), ScaleY(10));
  C.LineTo(ScaleX(23), ScaleY(19));
  C.LineTo(ScaleX(9), ScaleY(19));
  C.LineTo(ScaleX(9), ScaleY(10));
  C.LineTo(ScaleX(23), ScaleY(10));
  { Etiqueta del boton: deja claro que la ubicacion se busca, no se escribe. }
  C.Font.Name := 'Segoe UI';
  C.Font.Height := -ScaleY(10);
  C.Font.Color := ModernText;
  C.TextOut(ScaleX(30), ScaleY(7), 'Examinar...');
  ModernFolder.OnClick := @ModernBrowse;
  ModernLabel('✓', 20, 350, 20, 24, 12, ModernAccent, True, False);
  ModernLabel('Instalación para el usuario actual', 44, 352, 496, 24,
    9, ModernMuted, False, False);
  ModernInstallFocus := TBitmapImage.Create(WizardForm);
  ModernInstallFocus.Parent := ModernHost;
  ModernInstallFocus.SetBounds(ScaleX(18), ScaleY(386), ScaleX(524), ScaleY(50));
  { Indicador de foco del boton principal: en el color de la superficie, para
    que se vea sin parecer un contorno negro sobre el boton de acento. }
  ModernRound(ModernInstallFocus.Bitmap, 524, 50, 12, ModernBackground, ModernSurface);
  ModernInstallFocus.Visible := False;
  ModernInstall := TBitmapButton.Create(WizardForm);
  ModernInstall.Parent := ModernHost;
  ModernInstall.SetBounds(ScaleX(ModernMargin), ScaleY(388), ScaleX(520), ScaleY(46));
  ModernInstall.Caption := 'Instalar {#MyAppName}';
  ModernInstall.TabStop := True;
  ModernInstall.TabOrder := 2;
  ModernInstall.Cursor := crHand;
  ModernInstall.BackColor := ModernBackground;
  ModernRound(ModernInstall.Bitmap, 520, 46, ModernControlRadius,
    ModernBackground, ModernAccent);
  C := ModernInstall.Bitmap.Canvas;
  C.Font.Name := 'Segoe UI';
  C.Font.Height := -ScaleY(14);
  C.Font.Color := $211C18;
  C.Font.Style := [fsBold];
  Caption := ModernInstall.Caption;
  { Con nombres largos el texto puede no caber en el boton: se reduce el cuerpo
    de la fuente hasta que quepa, con un minimo legible. }
  while (C.TextWidth(Caption) > ModernInstall.Width - ScaleX(28)) and
        (C.Font.Height < -ScaleY(9)) do
    C.Font.Height := C.Font.Height + 1;
  C.TextOut((ModernInstall.Width - C.TextWidth(Caption)) div 2,
    (ModernInstall.Height - C.TextHeight(Caption)) div 2, Caption);
  ModernInstall.OnClick := @ModernStartInstall;
  WizardForm.KeyPreview := True;
  WizardForm.OnKeyDown := @ModernKeyDown;
  WizardForm.OnKeyUp := @ModernKeyUp;
  WizardForm.WizardSmallBitmapImage.Visible := False;
  // Ajuste verificado en LyraFlow: los botones nativos Siguiente y Cancelar
  // quedan tapados por el panel opaco, asi que el foco no debe quedarse en
  // ellos. Se retiran del recorrido del tab SOLO en la pantalla de entrada;
  // el motor los sigue usando (modo silencioso y navegacion interna). Con esto
  // el recorrido queda exactamente carpeta -> instalar.
  WizardForm.NextButton.TabStop := False;
  WizardForm.CancelButton.TabStop := False;
  // Siguiente deja de ser el boton por defecto en la entrada: Enter y Espacio
  // se atienden desde el panel y no deben avanzar el asistente por su cuenta.
  // ModernPageChanged lo restaura en progreso y exito, donde Enter debe poder
  // cerrar el instalador con "Finalizar".
  WizardForm.NextButton.Default := False;

  ModernNextBtn := TBitmapButton.Create(WizardForm);
  ModernNextBtn.Parent := WizardForm;
  ModernNextBtn.SetBounds(WizardForm.NextButton.Left, WizardForm.NextButton.Top,
                          WizardForm.NextButton.Width, WizardForm.NextButton.Height);
  ModernNextBtn.Cursor := crHand;
  ModernNextBtn.OnClick := @ModernNextBtnClick;
  ModernNextBtn.Visible := False;

  ModernCancelBtn := TBitmapButton.Create(WizardForm);
  ModernCancelBtn.Parent := WizardForm;
  ModernCancelBtn.SetBounds(WizardForm.CancelButton.Left, WizardForm.CancelButton.Top,
                            WizardForm.CancelButton.Width, WizardForm.CancelButton.Height);
  ModernCancelBtn.Cursor := crHand;
  ModernCancelBtn.OnClick := @ModernCancelBtnClick;
  ModernCancelBtn.Visible := False;

  ModernYesRadioImg := TBitmapImage.Create(WizardForm);
  ModernYesRadioImg.Parent := WizardForm.PreparingYesRadio.Parent;
  ModernYesRadioImg.SetBounds(WizardForm.PreparingYesRadio.Left,
                              WizardForm.PreparingYesRadio.Top + (WizardForm.PreparingYesRadio.Height - ScaleX(16)) div 2,
                              ScaleX(16), ScaleX(16));
  ModernYesRadioImg.Cursor := crHand;
  ModernYesRadioImg.OnClick := @ModernRadioBulletClick;
  ModernYesRadioImg.Visible := False;

  ModernNoRadioImg := TBitmapImage.Create(WizardForm);
  ModernNoRadioImg.Parent := WizardForm.PreparingNoRadio.Parent;
  ModernNoRadioImg.SetBounds(WizardForm.PreparingNoRadio.Left,
                             WizardForm.PreparingNoRadio.Top + (WizardForm.PreparingNoRadio.Height - ScaleX(16)) div 2,
                             ScaleX(16), ScaleX(16));
  ModernNoRadioImg.Cursor := crHand;
  ModernNoRadioImg.OnClick := @ModernRadioBulletClick;
  ModernNoRadioImg.Visible := False;

  WizardForm.PreparingYesRadio.OnClick := @ModernRadioClick;
  WizardForm.PreparingNoRadio.OnClick := @ModernRadioClick;
end;

function ModernSetWindowTheme(Window: HWND; SubApp, SubId: String): Integer;
  external 'SetWindowTheme@uxtheme.dll stdcall';

procedure ModernPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpInstalling then
  begin
    WizardForm.ProgressGauge.StyleElements := [];
    ModernSetWindowTheme(WizardForm.ProgressGauge.Handle, ' ', ' ');
    SendMessage(WizardForm.ProgressGauge.Handle, $2001, 0, ModernSurface);
    SendMessage(WizardForm.ProgressGauge.Handle, $0409, 0, ModernAccent);
  end;

  ModernHost.Visible := CurPageID = ModernPage.ID;
  if ModernHost.Visible then
  begin
    ModernHost.BringToFront;
    { El foco inicial caia en el boton nativo "Siguiente", que esta tapado por
      el panel: no se veia indicador de foco hasta pulsar Tab. El campo de ruta
      ya no es editable, asi que el foco va al boton principal: la accion por
      defecto es instalar y la ubicacion se cambia con el boton de carpeta. }
    if not ModernFocusSet then
    begin
      ModernFocusSet := True;
      WinSetFocus(ModernInstall.Handle);
    end;
  end;
  WizardForm.BackButton.Visible := False;

  // Botón Siguiente: oculto en la instalación (no tiene sentido mientras se extraen archivos),
  // visible en el resto de páginas (es el botón "Finalizar" en la pantalla de éxito).
  WizardForm.NextButton.Visible := CurPageID <> wpInstalling;

  // Botón Cancelar: visible durante la instalación por si se aborta, pero OCULTO
  // en la pantalla de éxito (wpFinished) porque la instalación ya concluyó.
  WizardForm.CancelButton.Visible := (CurPageID <> wpFinished) and (CurPageID <> ModernPage.ID);

  WizardForm.NextButton.TabStop := CurPageID <> ModernPage.ID;
  WizardForm.CancelButton.TabStop := (CurPageID <> ModernPage.ID) and (CurPageID <> wpFinished);
  WizardForm.NextButton.Default := CurPageID <> ModernPage.ID;

  { En la pantalla de exito el foco caia en la casilla "Ejecutar <App>", que se
    traga el Enter y deja al usuario sin poder cerrar el instalador con el
    teclado. Se lleva a "Finalizar". }
  if CurPageID = wpFinished then
    WinSetFocus(WizardForm.NextButton.Handle);

  // Botones modernos con identidad Biglex #00C9B9
  ModernNextBtn.Visible := WizardForm.NextButton.Visible and (CurPageID <> ModernPage.ID);
  ModernCancelBtn.Visible := WizardForm.CancelButton.Visible and (CurPageID <> ModernPage.ID);
  if ModernNextBtn.Visible then
  begin
    ModernPaintNextButton;
    ModernNextBtn.BringToFront;
  end;
  if ModernCancelBtn.Visible then
  begin
    ModernPaintCancelButton;
    ModernCancelBtn.BringToFront;
  end;

  ModernYesRadioImg.Visible := CurPageID = wpPreparing;
  ModernNoRadioImg.Visible := CurPageID = wpPreparing;
  if CurPageID = wpPreparing then
  begin
    WizardForm.PreparingMemo.StyleElements := [];
    WizardForm.PreparingMemo.Font.Name := 'Segoe UI';
    WizardForm.PreparingMemo.Font.Size := 9;
    WizardForm.PreparingMemo.Color := ModernSurface;
    WizardForm.PreparingMemo.Font.Color := ModernText;
    WizardForm.PreparingYesRadio.Font.Name := 'Segoe UI';
    WizardForm.PreparingYesRadio.Font.Size := 9;
    WizardForm.PreparingYesRadio.Font.Color := ModernText;
    WizardForm.PreparingNoRadio.Font.Name := 'Segoe UI';
    WizardForm.PreparingNoRadio.Font.Size := 9;
    WizardForm.PreparingNoRadio.Font.Color := ModernText;
    ModernPaintRadioBullet(ModernYesRadioImg, WizardForm.PreparingYesRadio.Checked);
    ModernPaintRadioBullet(ModernNoRadioImg, WizardForm.PreparingNoRadio.Checked);
    ModernYesRadioImg.BringToFront;
    ModernNoRadioImg.BringToFront;
  end;
end;

function ModernNextButtonClick(CurPageID: Integer): Boolean;
var Path: String;
begin
  Result := True;
  if CurPageID <> ModernPage.ID then Exit;
  Path := Trim(ModernPath.Text);
  if (Path = '') or (Pos(':\', Path) <> 2) or (Length(Path) <= 3) then
  begin
    MsgBox('Indica una carpeta de instalación con ruta absoluta, por ejemplo C:\Apps\{#MyAppName}.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  WizardForm.DirEdit.Text := Path;
end;

// Confirmación de salida con el mismo acento que Instalar. Solo sustituye la
// presentación del aviso; CancelButtonClick mantiene la cancelación de Inno.
procedure ModernExitPaintButton(Button: TBitmapButton; Emphasized: Boolean);
var C: TCanvas;
begin
  ModernRound(Button.Bitmap, 80, 28, 5, ModernBackground, ModernSurface);
  C := Button.Bitmap.Canvas;
  C.Brush.Style := bsClear;
  C.Pen.Color := ModernLine;
  if Emphasized or Button.Focused then C.Pen.Color := ModernAccent;
  C.Pen.Width := ScaleX(1);
  // Mantener un borde fino también al recibir foco.
  C.RoundRect(ScaleX(1), ScaleY(1), Button.Width - ScaleX(1),
    Button.Height - ScaleY(1), ScaleX(10), ScaleY(10));
  C.Brush.Style := bsSolid;
  C.Brush.Color := ModernSurface;
  C.Font.Name := 'Segoe UI';
  C.Font.Height := -ScaleY(12);
  C.Font.Color := ModernText;
  C.TextOut((Button.Width - C.TextWidth(Button.Caption)) div 2,
    (Button.Height - C.TextHeight(Button.Caption)) div 2, Button.Caption);
end;

procedure ModernExitClick(Sender: TObject);
begin
  ModernExitAccepted := Sender = ModernExitYes;
  ModernExitForm.Close;
end;

procedure ModernExitActivate(Sender: TObject);
begin
  WinSetFocus(ModernExitNo.Handle);
  ModernExitPaintButton(ModernExitYes, False);
  ModernExitPaintButton(ModernExitNo, True);
end;

procedure ModernExitKeyDown(Sender: TObject; var Key: Word; Shift: TShiftState);
begin
  if Key = 27 then
  begin
    Key := 0;
    ModernExitAccepted := False;
    ModernExitForm.Close;
  end
  else if Key = 9 then
  begin
    Key := 0;
    if ModernExitNo.Focused then WinSetFocus(ModernExitYes.Handle)
    else WinSetFocus(ModernExitNo.Handle);
  end;
end;

procedure ModernExitKeyUp(Sender: TObject; var Key: Word; Shift: TShiftState);
begin
  if (Key = 13) or (Key = 32) then
  begin
    Key := 0;
    ModernExitAccepted := ModernExitYes.Focused;
    ModernExitForm.Close;
    Exit;
  end;
  ModernExitPaintButton(ModernExitYes, False);
  ModernExitPaintButton(ModernExitNo, True);
end;

function ModernConfirmExit: Boolean;
var MessageLabel: TNewStaticText; Mark: TBitmapImage; C: TCanvas;
begin
  ModernExitAccepted := False;
  ModernExitForm := CreateCustomForm(ScaleX(400), ScaleY(196), False, True);
  try
    ModernExitForm.Caption := 'Salir de la instalación';
    ModernExitForm.StyleElements := [];
    ModernExitForm.Color := ModernBackground;
    ModernExitForm.KeyPreview := True;
    Mark := TBitmapImage.Create(ModernExitForm);
    Mark.Parent := ModernExitForm;
    Mark.SetBounds(ScaleX(16), ScaleY(20), ScaleX(30), ScaleY(30));
    ModernRound(Mark.Bitmap, 30, 30, 15, ModernBackground, ModernAccent);
    C := Mark.Bitmap.Canvas;
    C.Font.Name := 'Segoe UI';
    C.Font.Height := -ScaleY(22);
    C.Font.Color := $211C18;
    C.TextOut((Mark.Width - C.TextWidth('?')) div 2,
      (Mark.Height - C.TextHeight('?')) div 2, '?');
    MessageLabel := TNewStaticText.Create(ModernExitForm);
    MessageLabel.Parent := ModernExitForm;
    MessageLabel.StyleElements := [];
    MessageLabel.AutoSize := False;
    MessageLabel.WordWrap := True;
    MessageLabel.Color := ModernBackground;
    MessageLabel.Font.Name := 'Segoe UI';
    MessageLabel.Font.Size := 9;
    MessageLabel.Font.Color := ModernText;
    MessageLabel.SetBounds(ScaleX(58), ScaleY(18), ScaleX(324), ScaleY(126));
    MessageLabel.Caption := 'La instalación no se ha completado aún. Si cancelas ahora, el programa no se instalará.' + #13#10 + #13#10 +
      'Puedes ejecutar nuevamente el instalador en otra ocasión para completarla.' + #13#10 + #13#10 + '¿Salir de la instalación?';
    ModernExitYes := TBitmapButton.Create(ModernExitForm);
    ModernExitYes.Parent := ModernExitForm;
    ModernExitYes.SetBounds(ScaleX(214), ScaleY(152), ScaleX(80), ScaleY(28));
    ModernExitYes.Caption := 'Sí';
    ModernExitYes.BackColor := ModernBackground;
    ModernExitYes.TabStop := True;
    ModernExitYes.Cursor := crHand;
    ModernExitYes.OnClick := @ModernExitClick;
    ModernExitNo := TBitmapButton.Create(ModernExitForm);
    ModernExitNo.Parent := ModernExitForm;
    ModernExitNo.SetBounds(ScaleX(302), ScaleY(152), ScaleX(80), ScaleY(28));
    ModernExitNo.Caption := 'No';
    ModernExitNo.BackColor := ModernBackground;
    ModernExitNo.TabStop := True;
    ModernExitNo.Cursor := crHand;
    ModernExitNo.OnClick := @ModernExitClick;
    ModernExitPaintButton(ModernExitYes, False);
    ModernExitPaintButton(ModernExitNo, True);
    ModernExitForm.OnActivate := @ModernExitActivate;
    ModernExitForm.OnKeyDown := @ModernExitKeyDown;
    ModernExitForm.OnKeyUp := @ModernExitKeyUp;
    ModernExitForm.PopupParent := WizardForm;
    ModernExitForm.PopupMode := pmExplicit;
    ModernExitForm.Position := poDesigned;
    ModernExitForm.Left := WizardForm.Left + (WizardForm.Width - ModernExitForm.Width) div 2;
    ModernExitForm.Top := WizardForm.Top + (WizardForm.Height - ModernExitForm.Height) div 2;
    ModernExitForm.ShowModal;
    Result := ModernExitAccepted;
  finally
    ModernExitForm.Free;
  end;
end;

procedure ModernCancelButtonClick(CurPageID: Integer; var Cancel, Confirm: Boolean);
begin
  // Conservar los casos en que el motor no pide confirmación y el modo silent.
  if WizardSilent or (not Confirm) then Exit;
  Cancel := ModernConfirmExit;
  Confirm := False;
end;

