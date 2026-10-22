import { expect, test } from "bun:test";
import { CapturePointer } from "../src/features/screen_capture/model/pointerCapture";

function surface() {
  const ids = new Set<number>();
  return {
    ids,
    setPointerCapture: (id: number) => { ids.add(id); },
    hasPointerCapture: (id: number) => ids.has(id),
    releasePointerCapture: (id: number) => { ids.delete(id); },
  };
}

test("el lápiz recupera el contacto aunque falte pointerup y cambie de identificador", () => {
  const pointer = new CapturePointer(), target = surface();
  for (let id = 1; id <= 20; id++) {
    expect(pointer.begin({ pointerId: id, button: 0, isPrimary: true, currentTarget: target })).toBe(true);
    expect(pointer.matches(id)).toBe(true);
    expect(pointer.matches(id - 1)).toBe(false);
    expect([...target.ids]).toEqual([id]);
  }
  pointer.release();
  expect(target.ids.size).toBe(0);
});

test("un dedo secundario y el botón lateral no desplazan el contacto principal", () => {
  const pointer = new CapturePointer(), target = surface();
  pointer.begin({ pointerId: 1, button: 0, isPrimary: true, currentTarget: target });
  expect(pointer.begin({ pointerId: 2, button: 0, isPrimary: false, currentTarget: target })).toBe(false);
  expect(pointer.begin({ pointerId: 3, button: 2, isPrimary: true, currentTarget: target })).toBe(false);
  expect(pointer.matches(1)).toBe(true);
  expect([...target.ids]).toEqual([1]);
});

test("un contacto nuevo con el mismo identificador también libera el gesto anterior", () => {
  const pointer = new CapturePointer(), first = surface(), second = surface();
  pointer.begin({ pointerId: 1, button: 0, isPrimary: true, currentTarget: first });
  pointer.begin({ pointerId: 1, button: 0, isPrimary: true, currentTarget: second });
  expect(first.ids.size).toBe(0);
  expect([...second.ids]).toEqual([1]);
});

test("el lápiz puede dibujar aunque el navegador ya no lo marque como principal", () => {
  const pointer = new CapturePointer(), target = surface();
  pointer.begin({ pointerId: 1, button: 0, isPrimary: true, pointerType: "pen", currentTarget: target });
  expect(pointer.begin({ pointerId: 20, button: 0, isPrimary: false, pointerType: "pen", currentTarget: target })).toBe(true);
  expect(pointer.matches(20)).toBe(true);
  expect([...target.ids]).toEqual([20]);
  expect(pointer.begin({ pointerId: 21, button: 0, isPrimary: false, pointerType: "touch", currentTarget: target })).toBe(false);
  expect(pointer.begin({ pointerId: 22, button: 2, isPrimary: false, pointerType: "pen", currentTarget: target })).toBe(false);
  expect(pointer.matches(20)).toBe(true);
});

test("perder foco libera el objetivo anterior antes de empezar otro gesto", () => {
  const pointer = new CapturePointer(), first = surface(), second = surface();
  pointer.begin({ pointerId: 1, button: 0, isPrimary: true, currentTarget: first });
  pointer.release();
  pointer.release();
  pointer.begin({ pointerId: 1, button: 0, isPrimary: true, currentTarget: second });
  expect(first.ids.size).toBe(0);
  expect([...second.ids]).toEqual([1]);
});

test("el controlador puede rechazar captura explícita o eliminar la superficie sin bloquear gestos futuros", () => {
  const pointer = new CapturePointer();
  const gone = {
    setPointerCapture() { throw new Error("pointer no disponible"); },
    hasPointerCapture() { throw new Error("ventana oculta"); },
    releasePointerCapture() {},
  };
  expect(pointer.begin({ pointerId: 1, button: 0, isPrimary: true, currentTarget: gone })).toBe(true);
  expect(() => pointer.release()).not.toThrow();
  expect(pointer.matches(1)).toBe(false);
  const target = surface();
  expect(pointer.begin({ pointerId: 2, button: 0, isPrimary: true, currentTarget: target })).toBe(true);
  expect(pointer.matches(2)).toBe(true);
});
