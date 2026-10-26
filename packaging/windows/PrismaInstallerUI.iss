[Code]
{ Ajustes propios de Prisma; la plantilla compartida permanece intacta. }
var
  PrismaOriginalClose: TCloseEvent;

function PrismaGetSystemMenu(Window: HWND; Revert: Boolean): THandle;
  external 'GetSystemMenu@user32.dll stdcall';
function PrismaEnableMenuItem(Menu: THandle; Item, Flags: Longword): Longword;
  external 'EnableMenuItem@user32.dll stdcall';
function PrismaDrawMenuBar(Window: HWND): Boolean;
  external 'DrawMenuBar@user32.dll stdcall';

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
  Radius := ScaleX(12);
  if Button = ModernInstall then
  begin
    C.Brush.Color := ModernAccent;
    C.Pen.Color := ModernAccent;
    Radius := ScaleX(ModernControlRadius * 2);
  end;
  C.RoundRect(1, 1, W - 1, H - 1, Radius, Radius);
  C.Brush.Style := bsClear;
  C.Font.Name := 'Segoe UI';
  C.Font.Height := -ScaleY(13);
  C.Font.Color := ModernText;
  if Emphasized then C.Font.Style := [fsBold] else C.Font.Style := [];
  if Button = ModernInstall then
  begin
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
    if MsgBox('¿Quieres cerrar el instalador de Prisma?', mbConfirmation,
      MB_YESNO or MB_DEFBUTTON2) = IDYES then PrismaNextClick(Sender);
  end
  else
    PrismaOriginalClose(Sender, Action);
end;

procedure PrismaInitialize;
begin
  PrismaOriginalClose := WizardForm.OnClose;
  WizardForm.OnClose := @PrismaClose;
  ModernNextBtn.OnClick := @PrismaNextClick;
  PrismaPaintButton(ModernInstall, ModernInstall.Caption, ModernBackground, True);
  PrismaPaintButton(ModernFolder, 'Examinar...', ModernSurface, True);
  { Sustituir el paquete generico de Inno por la identidad de Prisma. }
  InitializeBitmapImageFromIcon(WizardForm.WizardBitmapImage2,
    ExpandConstant('{tmp}\{#MyAppIcon}'), ModernBackground, [96, 128, 256]);
  WizardForm.WizardBitmapImage2.Stretch := True;
  WizardForm.WizardBitmapImage2.SetBounds(ScaleX(48), ScaleY(136), ScaleX(96), ScaleY(96));
end;

procedure PrismaPageChanged(CurPageID: Integer);
var Caption: String; FooterTop, RightEdge, ButtonWidth, ButtonHeight: Integer;
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
    ButtonWidth := ScaleX(108);
    ButtonHeight := ScaleY(34);
    RightEdge := WizardForm.ClientWidth - ScaleX(16);
    FooterTop := WizardForm.ClientHeight - ScaleY(42);
    ModernNextBtn.SetBounds(RightEdge - ButtonWidth, FooterTop, ButtonWidth, ButtonHeight);
    if ModernCancelBtn.Visible then
    begin
      ModernCancelBtn.SetBounds(RightEdge - ButtonWidth, FooterTop, ButtonWidth, ButtonHeight);
      ModernNextBtn.Left := ModernCancelBtn.Left - ButtonWidth - ScaleX(8);
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
  { Siguen disponibles para el motor y los atajos; no quedan rectangulos
    nativos asomando por debajo de los controles mas amplios. }
  WizardForm.NextButton.Left := -ScaleX(1000);
  WizardForm.CancelButton.Left := -ScaleX(1000);
  if CurPageID <> wpInstalling then
  begin
    PrismaEnableMenuItem(PrismaGetSystemMenu(WizardForm.Handle, False), $F060, 0);
    PrismaDrawMenuBar(WizardForm.Handle);
  end;
end;
