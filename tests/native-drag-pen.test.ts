import { expect, test } from "bun:test";
import { armNativeDragGesture } from "../src/shared/nativeDragGesture";

function fixture() {
  const view = new EventTarget();
  Object.assign(view, { setTimeout });
  const captured = new Set<number>();
  const element = {
    ownerDocument: { defaultView: view }, isConnected: true,
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id),
  } as unknown as Element;
  const origin = { button: 0, pointerType: "pen", pointerId: 7, clientX: 10, clientY: 10 };
  const send = (type: string, properties: object = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 7, buttons: 1, clientX: 10, clientY: 10 }, properties);
    view.dispatchEvent(event);
    return event;
  };
  return { element, origin, captured, send };
}

test("el lápiz conserva el puntero y lo libera antes de iniciar un único arrastre OLE", async () => {
  const f = fixture();
  let calls = 0;
  armNativeDragGesture(f.origin, f.element, async () => {
    expect(f.captured.size).toBe(0);
    calls++;
  });
  expect(f.captured.has(7)).toBe(true);
  f.send("pointermove", { pointerId: 8, clientX: 30 });
  f.send("pointermove", { clientX: 12 });
  expect(calls).toBe(0);
  expect(f.send("pointermove", { clientX: 20 }).defaultPrevented).toBe(true);
  f.send("pointermove", { clientX: 40 });
  expect(calls).toBe(1);
  await Promise.resolve();
});

test("cancelar o levantar el lápiz libera la captura sin arrastrar", () => {
  for (const type of ["pointercancel", "pointerup", "blur"]) {
    const f = fixture();
    let calls = 0;
    armNativeDragGesture(f.origin, f.element, async () => { calls++; });
    f.send(type, { buttons: 0 });
    expect(f.captured.size).toBe(0);
    f.send("pointermove", { clientX: 40 });
    expect(calls).toBe(0);
  }
});
