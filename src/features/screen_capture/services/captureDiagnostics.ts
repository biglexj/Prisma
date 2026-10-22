import { invoke } from "@tauri-apps/api/core";

/** Registro local optativo: solo se activa con --capture-diagnostics. No guarda imágenes ni texto. */
export function captureDiagnostics(readState: (pointerId?: number) => Record<string, unknown>) {
  let disposed = false;
  let cleanup = () => {};
  void invoke<string | null>("screen_capture_trace", { events: [] }).then((path) => {
    if (disposed || !path) return;
    let pending: Record<string, unknown>[] = [];
    let lastMove = 0;
    const flush = () => {
      if (!pending.length) return;
      const events = pending.splice(0);
      void invoke("screen_capture_trace", { events }).catch(() => {});
    };
    const record = (event: Event) => {
      const pointer = event instanceof PointerEvent ? event : null;
      if (event.type === "pointermove") {
        if (performance.now() - lastMove < 200) return;
        lastMove = performance.now();
      }
      const target = event.target instanceof Element ? event.target : null;
      const canvas = document.querySelector<HTMLCanvasElement>(".capture-inplace-canvas");
      const rect = canvas?.getBoundingClientRect();
      const entry = {
        time: Date.now(), type: event.type, trusted: event.isTrusted,
        pointer: pointer ? { id: pointer.pointerId, kind: pointer.pointerType, primary: pointer.isPrimary,
          button: pointer.button, buttons: pointer.buttons, pressure: pointer.pressure,
          x: pointer.clientX, y: pointer.clientY } : null,
        target: target ? `${target.tagName}.${target.getAttribute("class") ?? ""}` : null,
        focused: document.hasFocus(),
        canvas: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, pixels: [canvas!.width, canvas!.height] } : null,
        before: readState(pointer?.pointerId),
        error: event instanceof ErrorEvent ? event.message : undefined,
      };
      // El listener de captura corre antes del manejador de React; comprobar también el resultado.
      queueMicrotask(() => {
        if (disposed) return;
        pending.push({ ...entry, after: readState(pointer?.pointerId) });
        if (pending.length >= 100 || event.type !== "pointermove") flush();
      });
    };
    const types = ["pointerdown", "pointerup", "pointercancel", "pointermove", "gotpointercapture", "lostpointercapture"];
    types.forEach((type) => document.addEventListener(type, record, true));
    ["blur", "focus", "error"].forEach((type) => window.addEventListener(type, record));
    const timer = window.setInterval(flush, 1000);
    pending.push({ time: Date.now(), type: "trace-start", state: readState() });
    flush();
    cleanup = () => {
      types.forEach((type) => document.removeEventListener(type, record, true));
      ["blur", "focus", "error"].forEach((type) => window.removeEventListener(type, record));
      window.clearInterval(timer);
      flush();
    };
  }).catch(() => {});
  return () => { disposed = true; cleanup(); };
}
