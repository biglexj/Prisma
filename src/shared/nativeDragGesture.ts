const DRAG_DISTANCE = 6;
let cancelPendingGesture: (() => void) | undefined;
let nativeDragActive = false;

type PointerOrigin = Pick<PointerEvent, "button" | "pointerType" | "pointerId" | "clientX" | "clientY">;

/** Starts OLE from mouse movement, without depending on WebView2's HTML dragstart. */
export function armNativeDragGesture(
  origin: PointerOrigin,
  element: Element,
  startDrag: () => Promise<void>,
): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view || origin.button !== 0 || origin.pointerType === "touch" || nativeDragActive) return false;
  cancelPendingGesture?.();
  const { pointerId, clientX, clientY } = origin;

  const cleanup = () => {
    view.removeEventListener("pointermove", move, true);
    view.removeEventListener("pointerup", end, true);
    view.removeEventListener("pointercancel", end, true);
    view.removeEventListener("blur", cleanup);
    view.removeEventListener("keydown", key, true);
    view.removeEventListener("dragstart", preventBrowserDrag, true);
    if (cancelPendingGesture === cleanup) cancelPendingGesture = undefined;
  };
  const end = (event: PointerEvent) => {
    if (event.pointerId === pointerId) cleanup();
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === "Escape") cleanup();
  };
  const preventBrowserDrag = (event: DragEvent) => event.preventDefault();
  const move = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    if (!(event.buttons & 1) || !element.isConnected) {
      cleanup();
      return;
    }
    if (Math.hypot(event.clientX - clientX, event.clientY - clientY) < DRAG_DISTANCE) return;
    event.preventDefault();
    cleanup();

    // A drag must not also open/play the card when the mouse is released.
    const suppressClick = (click: MouseEvent) => {
      click.preventDefault();
      click.stopImmediatePropagation();
    };
    view.addEventListener("click", suppressClick, true);
    nativeDragActive = true;
    // Invoke synchronously while the left button is still held.
    void (async () => {
      try {
        await startDrag();
      } catch (error) {
        console.warn("[NativeFileDrag] No se pudo iniciar el arrastre:", error);
      } finally {
        nativeDragActive = false;
        view.setTimeout(() => view.removeEventListener("click", suppressClick, true), 250);
      }
    })();
  };

  view.addEventListener("pointermove", move, { capture: true, passive: false });
  view.addEventListener("pointerup", end, true);
  view.addEventListener("pointercancel", end, true);
  view.addEventListener("blur", cleanup);
  view.addEventListener("keydown", key, true);
  view.addEventListener("dragstart", preventBrowserDrag, true);
  cancelPendingGesture = cleanup;
  return true;
}
