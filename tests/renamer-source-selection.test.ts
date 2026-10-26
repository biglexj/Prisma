import { expect, test } from "bun:test";
import { computeRenamingPreview } from "../src/features/renamer/model/renamerEngine";
import { createSourceDropQueue, mergeSourceSelection, orderSourceSelection } from "../src/features/renamer/model/sourceSelection";
import type { RenamerFileItem, RuleStep } from "../src/features/renamer/model/types";

const file = (name: string, folder = "C:\\images"): RenamerFileItem => ({
  path: `${folder}\\${name}.png`, name: `${name}.png`, extension: "png", isDir: false,
  sizeBytes: 1, modifiedAtMillis: 0,
});
const template: RuleStep = { id: "template", type: "template", title: "Numerar", enabled: true,
  config: { pattern: "imagen [Counter]", counterStart: 1, counterStep: 1, counterPadding: 1 } };

test("Shift acumula tres tandas conservando orden, exclusiones y numeración continua", () => {
  const a = file("z"); const b = file("m"); const c = file("a");
  let state = mergeSourceSelection([], [a], new Set(), false);
  state = mergeSourceSelection(state.items, [b], state.selected, true);
  state = mergeSourceSelection(state.items, [c], state.selected, true);
  expect(state.items.map((item) => item.name)).toEqual(["z.png", "m.png", "a.png"]);
  expect(computeRenamingPreview(state.items, [template], state.selected).map((p) => p.newName))
    .toEqual(["imagen 1.png", "imagen 2.png", "imagen 3.png"]);
});

test("sin Shift se sustituye la lista cargada", () => {
  const old = file("old"); const next = file("new");
  const merged = mergeSourceSelection([old], [next], new Set([old.path]), false);
  expect(merged.items).toEqual([next]); expect([...merged.selected]).toEqual([next.path]);
});

test("las rutas duplicadas con distintas barras o mayúsculas no se añaden ni se reseleccionan", () => {
  const old = file("old"); const alias = { ...old, path: old.path.toUpperCase().replace(/\\/g, "/") };
  const next = file("new", "D:\\otra carpeta");
  const merged = mergeSourceSelection([old], [alias, next, next], new Set(), true);
  expect(merged.items).toEqual([old, next]); expect([...merged.selected]).toEqual([next.path]);
});

test("recargar las rutas tras renombrar conserva el orden de las tandas", () => {
  const a = file("z"); const b = file("a");
  expect(orderSourceSelection([b, a], [a.path, b.path])).toEqual([a, b]);
});

test("una tanda separada puede empezar en 11 después de las diez anteriores", () => {
  const next = file("next");
  const rules: RuleStep[] = [{ ...template, config: { ...template.config, counterStart: 11 } } as RuleStep];
  expect(computeRenamingPreview([next], rules, new Set([next.path]))[0].newName).toBe("imagen 11.png");
});

test("las cargas lentas se procesan en orden y un doble evento nativo/webview no sustituye la selección", async () => {
  const queue = createSourceDropQueue();
  let finish!: () => void;
  const wait = new Promise<void>((resolve) => { finish = resolve; });
  const loaded: string[] = [];
  const first = queue(["C:\\first"], "native", async () => { await wait; loaded.push("first"); }, 1000);
  const duplicate = queue(["c:/FIRST"], "webview", async () => { loaded.push("duplicate"); }, 1001);
  const second = queue(["C:\\second"], "native", async () => { loaded.push("second"); }, 1100);
  await Promise.resolve(); expect(loaded).toEqual([]);
  finish(); await Promise.all([first, duplicate, second]);
  expect(loaded).toEqual(["first", "second"]);
});

test("un fallo de carga no bloquea las siguientes tandas y repetir un gesto nativo se permite", async () => {
  const queue = createSourceDropQueue(); const loaded: string[] = [];
  const failed = queue(["C:\\a"], "native", async () => { throw new Error("load failed"); }, 1000);
  const next = queue(["C:\\a"], "native", async () => { loaded.push("retry"); }, 1001);
  await expect(failed).rejects.toThrow("load failed"); await next;
  expect(loaded).toEqual(["retry"]);
});
