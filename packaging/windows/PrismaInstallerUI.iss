[Code]
{ Ajustes propios de Prisma; la plantilla compartida permanece intacta. }
var
  PrismaOriginalClose: TCloseEvent;
  PrismaFooterRight, PrismaFooterTop, PrismaFooterWidth, PrismaFooterHeight,
    PrismaFooterGap: Integer;
  PrismaYesGlyph, PrismaNoGlyph, PrismaRunGlyph: TBitmapButton;

function PrismaGetSystemMenu(Window: HWND; Revert: Boolean): THandle;
  external 'GetSystemMenu@user32.dll stdcall';
function PrismaEnableMenuItem(Menu: THandle; Item, Flags: Longword): Longword;
  external 'EnableMenuItem@user32.dll stdcall';
function PrismaDrawMenuBar(Window: HWND): Boolean;
  external 'DrawMenuBar@user32.dll stdcall';
function PrismaGetWindowLong(Window: HWND; Index: Integer): Longint;
  external 'GetWindowLongW@user32.dll stdcall';
function PrismaSetWindowLong(Window: HWND; Index: Integer; Value: Longint): Longint;
  external 'SetWindowLongW@user32.dll stdcall';
function PrismaAlphaBlend(DestDC: Longint; X, Y, W, H: Integer;
  SourceDC: Longint; SourceX, SourceY, SourceW, SourceH: Integer; Blend: Longword): Boolean;
  external 'AlphaBlend@msimg32.dll stdcall';
function PrismaBitBlt(DestDC: Longint; X, Y, W, H: Integer;
  SourceDC: Longint; SourceX, SourceY: Integer; Raster: Longword): Boolean;
  external 'BitBlt@gdi32.dll stdcall';
function PrismaItemRect(Window: HWND; Msg: Longword; Index: Longword;
  var Bounds: TRect): Longint;
  external 'SendMessageW@user32.dll stdcall';

procedure PrismaPaintSelector(Button: TBitmapButton);
var Canvas: TCanvas; Bounds: TRect; Checked: Boolean; W, H, Inset: Integer;
begin
  W := Button.Bitmap.Width; H := Button.Bitmap.Height;
  Canvas := Button.Bitmap.Canvas;
  Button.BackColor := ModernBackground;
  Checked := False;
  if Button = PrismaYesGlyph then Checked := WizardForm.PreparingYesRadio.Checked;
  if Button = PrismaNoGlyph then Checked := WizardForm.PreparingNoRadio.Checked;
  if (Button = PrismaRunGlyph) and (WizardForm.RunList.Items.Count > 0) then
    Checked := WizardForm.RunList.Checked[0];
  Bounds.Left := 0; Bounds.Top := 0; Bounds.Right := W; Bounds.Bottom := H;
  Canvas.Brush.Color := ModernBackground;
  Canvas.FillRect(Bounds);
  Canvas.Pen.Width := ScaleX(1);
  Canvas.Pen.Color := ModernMuted;
  if Checked then Canvas.Pen.Color := ModernAccent;
  Inset := ScaleX(1);
  if Button = PrismaRunGlyph then
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

procedure PrismaRadioChanged(Sender: TObject);
begin
  PrismaPaintSelector(PrismaYesGlyph);
  PrismaPaintSelector(PrismaNoGlyph);
end;

procedure PrismaRunChanged(Sender: TObject);
begin
  PrismaPaintSelector(PrismaRunGlyph);
end;

procedure PrismaSelectorClick(Sender: TObject);
begin
  if Sender = PrismaYesGlyph then
  begin
    WizardForm.PreparingYesRadio.Checked := True;
    WinSetFocus(WizardForm.PreparingYesRadio.Handle);
  end
  else if Sender = PrismaNoGlyph then
  begin
    WizardForm.PreparingNoRadio.Checked := True;
    WinSetFocus(WizardForm.PreparingNoRadio.Handle);
  end
  else if WizardForm.RunList.Items.Count > 0 then
  begin
    WizardForm.RunList.Checked[0] := not WizardForm.RunList.Checked[0];
    WinSetFocus(WizardForm.RunList.Handle);
    PrismaRunChanged(WizardForm.RunList);
  end;
  PrismaRadioChanged(Sender);
end;

function PrismaCreateGlyph(Parent: TWinControl; const Caption: String): TBitmapButton;
begin
  Result := TBitmapButton.Create(WizardForm);
  Result.Parent := Parent;
  { Evitar que el dibujo nativo del padre vuelva a pintar azul sobre el glifo. }
  PrismaSetWindowLong(Parent.Handle, -16,
    PrismaGetWindowLong(Parent.Handle, -16) or $02000000);
  Result.Caption := Caption;
  Result.TabStop := False;
  Result.Cursor := crHand;
  Result.SetBounds(0, (Parent.Height - ScaleY(18)) div 2, ScaleX(18), ScaleY(18));
  Result.Bitmap.Width := Result.Width - 4;
  Result.Bitmap.Height := Result.Height - 4;
  Result.OnClick := @PrismaSelectorClick;
end;

procedure PrismaPaintButton(Button: TBitmapButton; const Caption: String;
  Background: TColor; Emphasized: Boolean);
var C: TCanvas; Bounds: TRect; W, H, Radius: Integer;
begin
  { TBitmapButton reserva dos pixeles por lado para el foco. Una imagen
    mayor que el area interior recorta las esquinas, en lugar de redondearlas. }
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

procedure PrismaPaintExitButtons;
begin
  PrismaPaintButton(ModernExitYes, ModernExitYes.Caption, ModernBackground, ModernExitYes.Focused);
  PrismaPaintButton(ModernExitNo, ModernExitNo.Caption, ModernBackground, True);
end;

procedure PrismaExitActivate(Sender: TObject);
begin
  WinSetFocus(ModernExitNo.Handle);
  PrismaPaintExitButtons;
  SendMessage(ModernExitForm.Handle, $0127, $00010001, 0);
end;

procedure PrismaExitKeyUp(Sender: TObject; var Key: Word; Shift: TShiftState);
begin
  if (Key = 13) or (Key = 32) then
  begin
    Key := 0;
    ModernExitAccepted := ModernExitYes.Focused;
    ModernExitForm.Close;
    Exit;
  end;
  PrismaPaintExitButtons;
end;

function PrismaConfirmExit(Finished: Boolean): Boolean;
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
      MessageLabel.Caption := 'La instalación de Prisma ha terminado.' + #13#10 + #13#10 + '¿Quieres cerrar el instalador?';
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
    PrismaPaintExitButtons;

    ModernExitForm.OnActivate := @PrismaExitActivate;
    ModernExitForm.OnKeyDown := @ModernExitKeyDown;
    ModernExitForm.OnKeyUp := @PrismaExitKeyUp;
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

procedure PrismaNextClick(Sender: TObject);
begin
  if WizardForm.NextButton.Enabled then
    WizardForm.NextButton.OnClick(WizardForm.NextButton);
end;

procedure PrismaClose(Sender: TObject; var Action: TCloseAction);
begin
  if WizardForm.CurPageID = wpFinished then
  begin
    { Finalizar conserva el motor y la seleccion de Ejecutar Prisma. }
    Action := caNone;
    if PrismaConfirmExit(True) then PrismaNextClick(Sender);
  end
  else
    PrismaOriginalClose(Sender, Action);
end;

procedure PrismaTintGenericPackage;
var Image: TBitmapImage; CopyBitmap: TBitmap; X, Y, Pixel, R, G, B, MinRed, Mix: Integer;
  Bounds: TRect;
begin
  { Conservar el paquete original de Inno, su disco y sus proporciones.
    Solo sustituir sus trazos azules por el acento y conservar el suavizado. }
  Image := WizardForm.WizardBitmapImage2;
  CopyBitmap := TBitmap.Create;
  try
    { Aplanar sobre el fondo evita perder el alfa al modificar pixeles por GDI. }
    CopyBitmap.Width := Image.Bitmap.Width;
    CopyBitmap.Height := Image.Bitmap.Height;
    Bounds.Left := 0; Bounds.Top := 0;
    Bounds.Right := CopyBitmap.Width; Bounds.Bottom := CopyBitmap.Height;
    CopyBitmap.Canvas.Brush.Color := ModernBackground;
    CopyBitmap.Canvas.FillRect(Bounds);
    if not PrismaAlphaBlend(CopyBitmap.Canvas.Handle, 0, 0, CopyBitmap.Width, CopyBitmap.Height,
      Image.Bitmap.Canvas.Handle, 0, 0, Image.Bitmap.Width, Image.Bitmap.Height, $01FF0000) then
      PrismaBitBlt(CopyBitmap.Canvas.Handle, 0, 0, CopyBitmap.Width, CopyBitmap.Height,
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

procedure PrismaInitialize;
begin
  { Conservar las medidas y separacion originales de los botones de Inno. }
  PrismaFooterRight := WizardForm.CancelButton.Left + WizardForm.CancelButton.Width;
  PrismaFooterTop := WizardForm.NextButton.Top - ((ScaleY(26) - WizardForm.NextButton.Height) div 2);
  PrismaFooterWidth := WizardForm.NextButton.Width;
  PrismaFooterHeight := ScaleY(26);
  PrismaFooterGap := WizardForm.CancelButton.Left -
    (WizardForm.NextButton.Left + WizardForm.NextButton.Width);
  PrismaOriginalClose := WizardForm.OnClose;
  WizardForm.OnClose := @PrismaClose;
  ModernNextBtn.OnClick := @PrismaNextClick;
  PrismaYesGlyph := PrismaCreateGlyph(WizardForm.PreparingYesRadio, 'Cerrar automaticamente las aplicaciones');
  PrismaNoGlyph := PrismaCreateGlyph(WizardForm.PreparingNoRadio, 'No cerrar las aplicaciones');
  WizardForm.PreparingYesRadio.OnClick := @PrismaRadioChanged;
  WizardForm.PreparingNoRadio.OnClick := @PrismaRadioChanged;
  PrismaRunGlyph := PrismaCreateGlyph(WizardForm.RunList, 'Ejecutar Prisma');
  PrismaRunGlyph.Visible := False;
  WizardForm.RunList.OnClickCheck := @PrismaRunChanged;
  PrismaRadioChanged(WizardForm);
  PrismaPaintSelector(PrismaRunGlyph);
  PrismaPaintButton(ModernInstall, ModernInstall.Caption, ModernBackground, True);
  PrismaPaintButton(ModernFolder, 'Examinar...', ModernSurface, True);
  PrismaTintGenericPackage;
end;

procedure PrismaPageChanged(CurPageID: Integer);
var Caption: String; FooterTop, RightEdge, ButtonWidth, ButtonHeight: Integer;
  ItemBounds: TRect;
begin
  { Inno consulta CancelButton.CanFocus tambien al pulsar la X.
    Ocultarlo en la entrada anulaba el cierre. Se mantiene detras del panel. }
  if CurPageID = ModernPage.ID then
  begin
    WizardForm.CancelButton.Visible := True;
    WizardForm.CancelButton.TabStop := False;
    ModernCancelBtn.Visible := False;
    ModernHost.BringToFront;
    PrismaPaintButton(ModernInstall, ModernInstall.Caption, ModernBackground, True);
    PrismaPaintButton(ModernFolder, 'Examinar...', ModernSurface, True);
  end
  else
  begin
    ButtonWidth := PrismaFooterWidth;
    ButtonHeight := PrismaFooterHeight;
    RightEdge := PrismaFooterRight;
    FooterTop := PrismaFooterTop;
    ModernNextBtn.SetBounds(RightEdge - ButtonWidth, FooterTop, ButtonWidth, ButtonHeight);
    if ModernCancelBtn.Visible then
    begin
      ModernCancelBtn.SetBounds(RightEdge - ButtonWidth, FooterTop, ButtonWidth, ButtonHeight);
      ModernNextBtn.Left := ModernCancelBtn.Left - ButtonWidth - PrismaFooterGap;
    end;
    Caption := WizardForm.NextButton.Caption;
    StringChangeEx(Caption, '&', '', True);
    PrismaPaintButton(ModernNextBtn, Caption, WizardForm.Color, True);
    Caption := WizardForm.CancelButton.Caption;
    StringChangeEx(Caption, '&', '', True);
    PrismaPaintButton(ModernCancelBtn, Caption, WizardForm.Color, False);
    ModernNextBtn.TabStop := ModernNextBtn.Visible;
    ModernCancelBtn.TabStop := ModernCancelBtn.Visible;
    WizardForm.NextButton.TabStop := False;
    WizardForm.CancelButton.TabStop := False;
    if ModernNextBtn.Visible then ModernNextBtn.BringToFront;
    if ModernCancelBtn.Visible then ModernCancelBtn.BringToFront;
    if CurPageID = wpFinished then WinSetFocus(ModernNextBtn.Handle);
  end;
  { Las posiciones de los radios cambian cuando Inno compone el mensaje.
    Conservar los radios nativos evita indicadores duplicados sobre el texto. }
  ModernYesRadioImg.Visible := False;
  ModernNoRadioImg.Visible := False;
  PrismaRunGlyph.Visible := (CurPageID = wpFinished) and (WizardForm.RunList.Items.Count > 0);
  if PrismaRunGlyph.Visible then
  begin
    if PrismaItemRect(WizardForm.RunList.Handle, $0198, 0, ItemBounds) <> -1 then
      PrismaRunGlyph.SetBounds(WizardForm.RunList.Offset,
        ItemBounds.Top + (ItemBounds.Bottom - ItemBounds.Top - ScaleY(18)) div 2,
        ScaleX(18), ScaleY(18));
    PrismaRunGlyph.BringToFront;
    PrismaPaintSelector(PrismaRunGlyph);
  end;
  { Siguen disponibles para el motor y los atajos; no quedan rectangulos
    nativos asomando por debajo de los controles mas amplios. }
  WizardForm.NextButton.Left := -ScaleX(1000);
  WizardForm.CancelButton.Left := -ScaleX(1000);
  { Sin rectangulo de foco inicial encima del borde. Windows lo recupera
    cuando se navega con el teclado; Tab y los atajos siguen disponibles. }
  SendMessage(WizardForm.Handle, $0127, $00010001, 0);
  if CurPageID <> wpInstalling then
  begin
    PrismaEnableMenuItem(PrismaGetSystemMenu(WizardForm.Handle, False), $F060, 0);
    PrismaDrawMenuBar(WizardForm.Handle);
  end;
end;

procedure PrismaCancelButtonClick(CurPageID: Integer; var Cancel, Confirm: Boolean);
begin
  if WizardSilent then Exit;
  Cancel := PrismaConfirmExit(False);
  Confirm := False;
end;