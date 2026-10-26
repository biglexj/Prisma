#ifndef MyAppSubtitle
  #define MyAppSubtitle "Instala tu aplicación y comienza a disfrutarla."
#endif
; Biglex Modern UI 2.0. Copiar junto al setup.iss; sin dependencias externas.
; Requiere MyAppName y MyAppIcon definidos por el instalador.
; Coordenadas lógicas a 96 DPI. ScaleX/ScaleY se aplican UNA vez a todo.
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
  ModernBackground, ModernSurface, ModernText, ModernMuted, ModernLine,
    ModernLogoSurface: TColor;
  ModernFocusSet: Boolean;
  ModernExitForm: TSetupForm;
  ModernExitYes, ModernExitNo: TBitmapButton;
  ModernExitAccepted: Boolean;
  ModernNextBtn, ModernCancelBtn: TBitmapButton;
  ModernOriginalClose: TCloseEvent;
  ModernFooterRight, ModernFooterTop, ModernFooterWidth, ModernFooterHeight,
    ModernFooterGap: Integer;
  ModernYesGlyph, ModernNoGlyph, ModernRunGlyph: TBitmapButton;

{ Funciones de la API de Windows }
procedure ModernExitProcess(ExitCode: Integer);
  external 'ExitProcess@kernel32.dll stdcall';
function WinSetFocus(hWnd: Longint): Longint;
  external 'SetFocus@user32.dll stdcall';
function ModernGetSystemMenu(Window: HWND; Revert: Boolean): THandle;
  external 'GetSystemMenu@user32.dll stdcall';
function ModernEnableMenuItem(Menu: THandle; Item, Flags: Longword): Longword;
  external 'EnableMenuItem@user32.dll stdcall';
function ModernDrawMenuBar(Window: HWND): Boolean;
  external 'DrawMenuBar@user32.dll stdcall';
function ModernGetWindowLong(Window: HWND; Index: Integer): Longint;
  external 'GetWindowLongW@user32.dll stdcall';
function ModernSetWindowLong(Window: HWND; Index: Integer; Value: Longint): Longint;
  external 'SetWindowLongW@user32.dll stdcall';
function ModernAlphaBlend(DestDC: Longint; X, Y, W, H: Integer;
  SourceDC: Longint; SourceX, SourceY, SourceW, SourceH: Integer; Blend: Longword): Boolean;
  external 'AlphaBlend@msimg32.dll stdcall';
function ModernBitBlt(DestDC: Longint; X, Y, W, H: Integer;
  SourceDC: Longint; SourceX, SourceY: Integer; Raster: Longword): Boolean;
  external 'BitBlt@gdi32.dll stdcall';
function ModernItemRect(Window: HWND; Msg: Longword; Index: Longword;
  var Bounds: TRect): Longint;
  external 'SendMessageW@user32.dll stdcall';
function ModernSetWindowTheme(Window: HWND; SubApp, SubId: String): Integer;
  external 'SetWindowTheme@uxtheme.dll stdcall';

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

procedure ModernAppName(const Text: String; X, Y, W, H, Size: Integer; Color: TColor);
var
  L: TNewStaticText;
  M: TBitmapImage;
  S: Integer;
begin
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
  L.WordWrap := True;
  L.SetBounds(ScaleX(X), ScaleY(Y), ScaleX(W), ScaleY(H));
  L.Caption := Text;
  L.Font.Name := 'Segoe UI';
  L.Font.Size := S;
  L.Font.Color := Color;
  L.Color := ModernBackground;
  L.StyleElements := [];
  L.ShowAccelChar := False;
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
  Image.SetBounds(ScaleX(X), ScaleY(Y), ScaleX(Size), ScaleY(Size));
end;

procedure ModernPaintButton(Button: TBitmapButton; const Caption: String;
  Background: TColor; Emphasized: Boolean);
var C: TCanvas; Bounds: TRect; W, H, Radius: Integer;
begin
  if Button = nil then Exit;
  W := Button.Width - 4;
  H := Button.Height - 4;
  Button.BackColor := Background;
  Button.Caption := Caption;
  Button.Bitmap.Width := W;
  Button.Bitmap.Height := H;
  C := Button.Bitmap.Canvas;
  Bounds.Left := 0; Bounds.Top := 0; Bounds.Right := W; Bounds.Bottom := H;
  C.Brush.Color := Background;
  C.FillRect(Bounds);
  C.Pen.Width := ScaleX(1);
  C.Pen.Color := ModernLine;
  if Emphasized then C.Pen.Color := ModernAccent;
  C.Brush.Color := Background;
  Radius := ScaleX(8);
  if Button = ModernInstall then
  begin
    C.Brush.Color := ModernAccent;
    C.Pen.Color := ModernAccent;
    Radius := ScaleX(ModernControlRadius * 2);
  end;
  C.RoundRect(1, 1, W - 1, H - 1, Radius, Radius);
  C.Brush.Style := bsClear;
  C.Font.Name := 'Segoe UI';
  C.Font.Height := -ScaleY(12);
  C.Font.Color := ModernText;
  C.Font.Style := [];
  if Button = ModernInstall then
  begin
    C.Font.Style := [fsBold];
    C.Font.Color := $211C18;
    C.Font.Height := -ScaleY(14);
    while (C.TextWidth(Caption) > W - ScaleX(24)) and (C.Font.Height < -ScaleY(9)) do
      C.Font.Height := C.Font.Height + 1;
  end;
  if Button = ModernFolder then
  begin
    C.Font.Style := [];
    C.Font.Height := -ScaleY(10);
    C.Pen.Color := ModernAccent;
    C.MoveTo(ScaleX(7), ScaleY(9));
    C.LineTo(ScaleX(7), ScaleY(6));
    C.LineTo(ScaleX(13), ScaleY(6));
    C.LineTo(ScaleX(16), ScaleY(9));
    C.LineTo(ScaleX(21), ScaleY(9));
    C.LineTo(ScaleX(21), ScaleY(18));
    C.LineTo(ScaleX(7), ScaleY(18));
    C.LineTo(ScaleX(7), ScaleY(9));
    C.LineTo(ScaleX(21), ScaleY(9));
    C.TextOut(ScaleX(28), (H - C.TextHeight(Caption)) div 2, Caption);
    Exit;
  end;
  C.TextOut((W - C.TextWidth(Caption)) div 2,
    (H - C.TextHeight(Caption)) div 2, Caption);
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
  WizardForm.NextButton.OnClick(WizardForm.NextButton);
end;

procedure ModernKeyUp(Sender: TObject; var Key: Word; Shift: TShiftState);
begin
  if WizardForm.CurPageID <> ModernPage.ID then Exit;
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
  if ModernPath.Focused then Exit;
  if Key = 9 then
  begin
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

{ Glifos personalizados para radios y casillas (sin indicadores azules ni saltos) }
procedure ModernPaintSelector(Button: TBitmapButton);
var Canvas: TCanvas; Bounds: TRect; Checked: Boolean; W, H, Inset: Integer;
begin
  if Button = nil then Exit;
  W := Button.Bitmap.Width; H := Button.Bitmap.Height;
  Canvas := Button.Bitmap.Canvas;
  Button.BackColor := ModernBackground;
  Checked := False;
  if Button = ModernYesGlyph then Checked := WizardForm.PreparingYesRadio.Checked;
  if Button = ModernNoGlyph then Checked := WizardForm.PreparingNoRadio.Checked;
  if (Button = ModernRunGlyph) and (WizardForm.RunList <> nil) and (WizardForm.RunList.Items.Count > 0) then
    Checked := WizardForm.RunList.Checked[0];
  Bounds.Left := 0; Bounds.Top := 0; Bounds.Right := W; Bounds.Bottom := H;
  Canvas.Brush.Color := ModernBackground;
  Canvas.FillRect(Bounds);
  Canvas.Pen.Width := ScaleX(1);
  Canvas.Pen.Color := ModernMuted;
  if Checked then Canvas.Pen.Color := ModernAccent;
  Inset := ScaleX(1);
  if Button = ModernRunGlyph then
  begin
    if Checked then Canvas.Brush.Color := ModernAccent;
    Canvas.RoundRect(Inset, Inset, W - Inset, H - Inset, ScaleX(4), ScaleY(4));
    if Checked then
    begin
      Canvas.Pen.Color := $211C18;
      Canvas.Pen.Width := ScaleX(2);
      Canvas.MoveTo(ScaleX(4), H div 2);
      Canvas.LineTo(ScaleX(7), H - ScaleY(5));
      Canvas.LineTo(W - ScaleX(4), ScaleY(5));
    end;
  end
  else
  begin
    Canvas.Ellipse(Inset, Inset, W - Inset, H - Inset);
    if Checked then
    begin
      Canvas.Brush.Color := ModernAccent;
      Canvas.Ellipse(ScaleX(5), ScaleY(5), W - ScaleX(5), H - ScaleY(5));
    end;
  end;
end;

procedure ModernRadioChanged(Sender: TObject);
begin
  ModernPaintSelector(ModernYesGlyph);
  ModernPaintSelector(ModernNoGlyph);
end;

procedure ModernRunChanged(Sender: TObject);
begin
  ModernPaintSelector(ModernRunGlyph);
end;

procedure ModernSelectorClick(Sender: TObject);
begin
  if Sender = ModernYesGlyph then
  begin
    WizardForm.PreparingYesRadio.Checked := True;
    WinSetFocus(WizardForm.PreparingYesRadio.Handle);
  end
  else if Sender = ModernNoGlyph then
  begin
    WizardForm.PreparingNoRadio.Checked := True;
    WinSetFocus(WizardForm.PreparingNoRadio.Handle);
  end
  else if (WizardForm.RunList <> nil) and (WizardForm.RunList.Items.Count > 0) then
  begin
    WizardForm.RunList.Checked[0] := not WizardForm.RunList.Checked[0];
    WinSetFocus(WizardForm.RunList.Handle);
    ModernRunChanged(WizardForm.RunList);
  end;
  ModernRadioChanged(Sender);
end;

function ModernCreateGlyph(Parent: TWinControl; const Caption: String): TBitmapButton;
begin
  Result := TBitmapButton.Create(WizardForm);
  Result.Parent := Parent;
  { Evitar que el dibujo nativo del padre vuelva a pintar azul sobre el glifo. }
  ModernSetWindowLong(Parent.Handle, -16,
    ModernGetWindowLong(Parent.Handle, -16) or $02000000);
  Result.Caption := Caption;
  Result.TabStop := False;
  Result.Cursor := crHand;
  Result.SetBounds(0, (Parent.Height - ScaleY(18)) div 2, ScaleX(18), ScaleY(18));
  Result.Bitmap.Width := Result.Width - 4;
  Result.Bitmap.Height := Result.Height - 4;
  Result.OnClick := @ModernSelectorClick;
end;

{ Confirmación de salida: botones 78 x 26, mensajes adecuados a entrada vs éxito }
procedure ModernPaintExitButtons;
begin
  ModernPaintButton(ModernExitYes, ModernExitYes.Caption, ModernBackground, ModernExitYes.Focused);
  ModernPaintButton(ModernExitNo, ModernExitNo.Caption, ModernBackground, True);
end;

procedure ModernExitActivate(Sender: TObject);
begin
  WinSetFocus(ModernExitNo.Handle);
  ModernPaintExitButtons;
  SendMessage(ModernExitForm.Handle, $0127, $00010001, 0);
end;

procedure ModernExitClick(Sender: TObject);
begin
  ModernExitAccepted := Sender = ModernExitYes;
  ModernExitForm.Close;
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
    ModernPaintExitButtons;
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
  ModernPaintExitButtons;
end;

function ModernConfirmExit(Finished: Boolean): Boolean;
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
    if Finished then
    begin
      ModernExitForm.Caption := 'Cerrar instalador';
      MessageLabel.Caption := 'La instalación de ' + ExpandConstant('{#MyAppName}') + ' ha terminado.' + #13#10 + #13#10 + '¿Quieres cerrar el instalador?';
    end;
    ModernExitYes := TBitmapButton.Create(ModernExitForm);
    ModernExitYes.Parent := ModernExitForm;
    ModernExitYes.SetBounds(ScaleX(215), ScaleY(153), ScaleX(78), ScaleY(26));
    ModernExitYes.Caption := 'Sí';
    ModernExitYes.BackColor := ModernBackground;
    ModernExitYes.TabStop := True;
    ModernExitYes.Cursor := crHand;
    ModernExitYes.OnClick := @ModernExitClick;
    ModernExitNo := TBitmapButton.Create(ModernExitForm);
    ModernExitNo.Parent := ModernExitForm;
    ModernExitNo.SetBounds(ScaleX(303), ScaleY(153), ScaleX(78), ScaleY(26));
    ModernExitNo.Caption := 'No';
    ModernExitNo.BackColor := ModernBackground;
    ModernExitNo.TabStop := True;
    ModernExitNo.Cursor := crHand;
    ModernExitNo.OnClick := @ModernExitClick;
    ModernPaintExitButtons;

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

procedure ModernNextClick(Sender: TObject);
begin
  if WizardForm.NextButton.Enabled then
    WizardForm.NextButton.OnClick(WizardForm.NextButton);
end;

procedure ModernCancelClick(Sender: TObject);
begin
  WizardForm.CancelButton.OnClick(WizardForm.CancelButton);
end;

procedure ModernClose(Sender: TObject; var Action: TCloseAction);
var I: Integer;
begin
  if WizardForm.CurPageID = wpFinished then
  begin
    { La X finaliza limpiamente, pero no ejecuta las acciones postinstalación. }
    Action := caNone;
    if WizardForm.RunList <> nil then
      for I := 0 to WizardForm.RunList.Items.Count - 1 do
        WizardForm.RunList.Checked[I] := False;
    if WizardForm.NoRadio.Visible then WizardForm.NoRadio.Checked := True;
    WizardForm.NextButton.OnClick(WizardForm.NextButton);
  end
  else
    { El motor nativo pide confirmación y conserva su cancelación segura. }
    ModernOriginalClose(Sender, Action);
end;

procedure ModernCancelButtonClick(CurPageID: Integer; var Cancel, Confirm: Boolean);
begin
  if WizardSilent then Exit;
  Cancel := ModernConfirmExit(False);
  Confirm := False;
end;

{ Transforma trazos azules del paquete genérico a turquesa conservando disco gris }
procedure ModernTintGenericPackage;
var Image: TBitmapImage; CopyBitmap: TBitmap; X, Y, Pixel, R, G, B, MinRed, Mix: Integer;
  Bounds: TRect;
begin
  Image := WizardForm.WizardBitmapImage2;
  if Image = nil then Exit;
  CopyBitmap := TBitmap.Create;
  try
    CopyBitmap.Width := Image.Bitmap.Width;
    CopyBitmap.Height := Image.Bitmap.Height;
    Bounds.Left := 0; Bounds.Top := 0;
    Bounds.Right := CopyBitmap.Width; Bounds.Bottom := CopyBitmap.Height;
    CopyBitmap.Canvas.Brush.Color := ModernBackground;
    CopyBitmap.Canvas.FillRect(Bounds);
    if not ModernAlphaBlend(CopyBitmap.Canvas.Handle, 0, 0, CopyBitmap.Width, CopyBitmap.Height,
      Image.Bitmap.Canvas.Handle, 0, 0, Image.Bitmap.Width, Image.Bitmap.Height, $01FF0000) then
      ModernBitBlt(CopyBitmap.Canvas.Handle, 0, 0, CopyBitmap.Width, CopyBitmap.Height,
        Image.Bitmap.Canvas.Handle, 0, 0, $00CC0020);
    MinRed := 255;
    for Y := 0 to CopyBitmap.Height - 1 do
      for X := 0 to CopyBitmap.Width - 1 do
      begin
        Pixel := CopyBitmap.Canvas.Pixels[X, Y];
        R := Pixel and $FF; G := (Pixel shr 8) and $FF; B := (Pixel shr 16) and $FF;
        if (B > R + 15) and (B > G + 8) and (R < MinRed) then MinRed := R;
      end;
    if MinRed < 255 then
      for Y := 0 to CopyBitmap.Height - 1 do
        for X := 0 to CopyBitmap.Width - 1 do
        begin
          Pixel := CopyBitmap.Canvas.Pixels[X, Y];
          R := Pixel and $FF; G := (Pixel shr 8) and $FF; B := (Pixel shr 16) and $FF;
          if (B > R + 15) and (B > G + 8) then
          begin
            Mix := ((R - MinRed) * 255) div (255 - MinRed);
            G := 201 + (54 * Mix) div 255;
            B := 185 + (70 * Mix) div 255;
            CopyBitmap.Canvas.Pixels[X, Y] := Mix or (G shl 8) or (B shl 16);
          end;
        end;
    Image.Bitmap.Assign(CopyBitmap);
  finally
    CopyBitmap.Free;
  end;
end;

procedure ModernInitialize();
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
  ModernPath.ReadOnly := True;
  ModernPath.TabStop := False;
  ModernPath.TabOrder := 0;
  ModernPath.OnKeyDown := @ModernPathKeyDown;

  ModernFolder := TBitmapButton.Create(WizardForm);
  ModernFolder.Parent := ModernHost;
  ModernFolder.SetBounds(ScaleX(416), ScaleY(294), ScaleX(96), ScaleY(28));
  ModernFolder.Caption := 'Examinar...';
  ModernFolder.Hint := 'Elegir carpeta de instalacion';
  ModernFolder.ShowHint := True;
  ModernFolder.TabStop := True;
  ModernFolder.TabOrder := 1;
  ModernFolder.Cursor := crHand;
  ModernFolder.OnClick := @ModernBrowse;
  ModernPaintButton(ModernFolder, 'Examinar...', ModernSurface, True);

  ModernLabel('✓', 20, 350, 20, 24, 12, ModernAccent, True, False);
  ModernLabel('Instalación para el usuario actual', 44, 352, 496, 24,
    9, ModernMuted, False, False);

  ModernInstall := TBitmapButton.Create(WizardForm);
  ModernInstall.Parent := ModernHost;
  ModernInstall.SetBounds(ScaleX(ModernMargin), ScaleY(388), ScaleX(520), ScaleY(46));
  ModernInstall.Caption := 'Instalar {#MyAppName}';
  ModernInstall.TabStop := True;
  ModernInstall.TabOrder := 2;
  ModernInstall.Cursor := crHand;
  ModernInstall.OnClick := @ModernStartInstall;
  ModernPaintButton(ModernInstall, ModernInstall.Caption, ModernBackground, True);

  WizardForm.KeyPreview := True;
  WizardForm.OnKeyDown := @ModernKeyDown;
  WizardForm.OnKeyUp := @ModernKeyUp;

  { Conservar las medidas y separacion originales de los botones de Inno }
  ModernFooterRight := WizardForm.CancelButton.Left + WizardForm.CancelButton.Width;
  ModernFooterTop := WizardForm.NextButton.Top - ((ScaleY(26) - WizardForm.NextButton.Height) div 2);
  ModernFooterWidth := WizardForm.NextButton.Width;
  ModernFooterHeight := ScaleY(26);
  ModernFooterGap := WizardForm.CancelButton.Left -
    (WizardForm.NextButton.Left + WizardForm.NextButton.Width);

  ModernOriginalClose := WizardForm.OnClose;
  WizardForm.OnClose := @ModernClose;

  ModernNextBtn := TBitmapButton.Create(WizardForm);
  ModernNextBtn.Parent := WizardForm;
  ModernNextBtn.SetBounds(WizardForm.NextButton.Left, WizardForm.NextButton.Top,
                          ModernFooterWidth, ModernFooterHeight);
  ModernNextBtn.Cursor := crHand;
  ModernNextBtn.OnClick := @ModernNextClick;
  ModernNextBtn.Visible := False;

  ModernCancelBtn := TBitmapButton.Create(WizardForm);
  ModernCancelBtn.Parent := WizardForm;
  ModernCancelBtn.SetBounds(WizardForm.CancelButton.Left, WizardForm.CancelButton.Top,
                            ModernFooterWidth, ModernFooterHeight);
  ModernCancelBtn.Cursor := crHand;
  ModernCancelBtn.OnClick := @ModernCancelClick;
  ModernCancelBtn.Visible := False;

  { Glifos personalizados para opciones de preparacion y ejecucion }
  ModernYesGlyph := ModernCreateGlyph(WizardForm.PreparingYesRadio, 'Cerrar automaticamente las aplicaciones');
  ModernNoGlyph := ModernCreateGlyph(WizardForm.PreparingNoRadio, 'No cerrar las aplicaciones');
  WizardForm.PreparingYesRadio.OnClick := @ModernRadioChanged;
  WizardForm.PreparingNoRadio.OnClick := @ModernRadioChanged;

  if WizardForm.RunList <> nil then
  begin
    ModernRunGlyph := ModernCreateGlyph(WizardForm.RunList, 'Ejecutar ' + ExpandConstant('{#MyAppName}'));
    ModernRunGlyph.Visible := False;
    WizardForm.RunList.OnClickCheck := @ModernRunChanged;
  end;

  ModernRadioChanged(WizardForm);
  ModernPaintSelector(ModernRunGlyph);

  { Cargar icono en la cabecera de las paginas posteriores }
  InitializeBitmapImageFromIcon(WizardForm.WizardSmallBitmapImage,
    ExpandConstant('{tmp}\{#MyAppIcon}'), ModernBackground, [16, 24, 32, 48, 64]);
  WizardForm.WizardSmallBitmapImage.Visible := False;

  { Retocar paquete generico de la pantalla final }
  ModernTintGenericPackage;

  WizardForm.NextButton.TabStop := False;
  WizardForm.CancelButton.TabStop := False;
  WizardForm.NextButton.Default := False;

  { Mantener la X de la barra de título disponible }
  ModernEnableMenuItem(ModernGetSystemMenu(WizardForm.Handle, False), $F060, 0);
  ModernDrawMenuBar(WizardForm.Handle);
end;

procedure ModernPageChanged(CurPageID: Integer);
var Caption: String; FooterTop, RightEdge, ButtonWidth, ButtonHeight: Integer;
  ItemBounds: TRect;
begin
  if CurPageID = wpInstalling then
  begin
    WizardForm.ProgressGauge.StyleElements := [];
    ModernSetWindowTheme(WizardForm.ProgressGauge.Handle, ' ', ' ');
    SendMessage(WizardForm.ProgressGauge.Handle, $2001, 0, ModernSurface);
    SendMessage(WizardForm.ProgressGauge.Handle, $0409, 0, ModernAccent);
  end;

  ModernHost.Visible := CurPageID = ModernPage.ID;
  WizardForm.WizardSmallBitmapImage.Visible := CurPageID <> ModernPage.ID;

  if CurPageID = ModernPage.ID then
  begin
    ModernHost.BringToFront;
    WizardForm.CancelButton.Visible := True;
    WizardForm.CancelButton.TabStop := False;
    ModernCancelBtn.Visible := False;
    ModernNextBtn.Visible := False;
    ModernPaintButton(ModernInstall, ModernInstall.Caption, ModernBackground, True);
    ModernPaintButton(ModernFolder, 'Examinar...', ModernSurface, True);
    if not ModernFocusSet then
    begin
      ModernFocusSet := True;
      WinSetFocus(ModernInstall.Handle);
    end;
  end
  else
  begin
    ButtonWidth := ModernFooterWidth;
    ButtonHeight := ModernFooterHeight;
    RightEdge := ModernFooterRight;
    FooterTop := ModernFooterTop;

    ModernNextBtn.SetBounds(RightEdge - ButtonWidth, FooterTop, ButtonWidth, ButtonHeight);
    if (CurPageID <> wpFinished) and (CurPageID <> wpInstalling) then
    begin
      ModernCancelBtn.SetBounds(RightEdge - ButtonWidth, FooterTop, ButtonWidth, ButtonHeight);
      ModernNextBtn.Left := ModernCancelBtn.Left - ButtonWidth - ModernFooterGap;
      ModernCancelBtn.Visible := True;
    end
    else
      ModernCancelBtn.Visible := False;

    ModernNextBtn.Visible := CurPageID <> wpInstalling;

    Caption := WizardForm.NextButton.Caption;
    StringChangeEx(Caption, '&', '', True);
    { El estilo oscuro de Inno no cambia necesariamente la propiedad Color }
    ModernPaintButton(ModernNextBtn, Caption, ModernBackground, True);

    Caption := WizardForm.CancelButton.Caption;
    StringChangeEx(Caption, '&', '', True);
    ModernPaintButton(ModernCancelBtn, Caption, ModernBackground, False);

    ModernNextBtn.TabStop := ModernNextBtn.Visible;
    ModernCancelBtn.TabStop := ModernCancelBtn.Visible;
    WizardForm.NextButton.TabStop := False;
    WizardForm.CancelButton.TabStop := False;

    if ModernNextBtn.Visible then ModernNextBtn.BringToFront;
    if ModernCancelBtn.Visible then ModernCancelBtn.BringToFront;
    if CurPageID = wpFinished then WinSetFocus(ModernNextBtn.Handle);
  end;

  WizardForm.BackButton.Visible := False;
  WizardForm.NextButton.Visible := CurPageID <> wpInstalling;
  WizardForm.CancelButton.Visible := CurPageID <> wpFinished;

  { Ocultar glifos antiguos fuera de contexto }
  ModernRunGlyph.Visible := (CurPageID = wpFinished) and (WizardForm.RunList <> nil) and (WizardForm.RunList.Items.Count > 0);
  if ModernRunGlyph.Visible then
  begin
    if ModernItemRect(WizardForm.RunList.Handle, $0198, 0, ItemBounds) <> -1 then
      ModernRunGlyph.SetBounds(WizardForm.RunList.Offset,
        ItemBounds.Top + (ItemBounds.Bottom - ItemBounds.Top - ScaleY(18)) div 2,
        ScaleX(18), ScaleY(18));
    ModernRunGlyph.BringToFront;
    ModernPaintSelector(ModernRunGlyph);
  end;

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
    ModernRadioChanged(WizardForm);
  end;

  WizardForm.NextButton.Left := -ScaleX(1000);
  WizardForm.CancelButton.Left := -ScaleX(1000);

  { Ocultar rectangulo inicial de foco para evitar doble contorno }
  SendMessage(WizardForm.Handle, $0127, $00010001, 0);

  { Mantener la X de la barra de titulo disponible }
  if CurPageID <> wpInstalling then
  begin
    ModernEnableMenuItem(ModernGetSystemMenu(WizardForm.Handle, False), $F060, 0);
    ModernDrawMenuBar(WizardForm.Handle);
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
