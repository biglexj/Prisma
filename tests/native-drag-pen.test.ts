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
  expect(f.send("pointermove", { clientX: 20 }).defaultPrevented).toBe(false);
  f.send("pointermove", { clientX: 40 });
  expect(calls).toBe(1);
  await Promise.resolve();
});

test("el contacto del lápiz continúa aunque pointermove no incluya el bit de mouse", async () => {
  const f = fixture();
  let calls = 0;
  armNativeDragGesture({ ...f.origin, isPrimary: false }, f.element, async () => { calls++; });
  f.send("pointermove", { clientX: 25, buttons: 0, pressure: 0.5 });
  expect(calls).toBe(1);
  expect(f.captured.size).toBe(0);
  await Promise.resolve();
});

test("un contacto nuevo recupera un pointerup perdido sin aceptar el identificador anterior", async () => {
  const first = fixture(), second = fixture();
  let calls = 0;
  armNativeDragGesture(first.origin, first.element, async () => { calls++; });
  armNativeDragGesture({ ...second.origin, pointerId: 12, isPrimary: false }, second.element, async () => { calls++; });
  expect(first.captured.size).toBe(0);
  expect(second.captured.has(12)).toBe(true);
  second.send("pointerup", { pointerId: 7 });
  first.send("pointermove", { clientX: 30 });
  expect(calls).toBe(0);
  second.send("pointermove", { pointerId: 12, clientX: 30, buttons: 0 });
  expect(calls).toBe(1);
  await Promise.resolve();
});

test("perder la captura libera el gesto y permite empezar otro", () => {
  const f = fixture();
  let calls = 0;
  armNativeDragGesture(f.origin, f.element, async () => { calls++; });
  f.captured.clear();
  f.send("lostpointercapture");
  f.send("pointermove", { clientX: 30 });
  expect(calls).toBe(0);
  expect(armNativeDragGesture({ ...f.origin, pointerId: 9 }, f.element, async () => {})).toBe(true);
  f.send("pointerup", { pointerId: 9 });
  expect(f.captured.size).toBe(0);
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
