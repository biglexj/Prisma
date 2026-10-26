import { expect, test } from "bun:test";
import { computeRenamingPreview } from "../src/features/renamer/model/renamerEngine";
import type { RenamerFileItem, RuleStep } from "../src/features/renamer/model/types";

const item = (name: string, folder = "C:\\images", extension = "png"): RenamerFileItem => ({
  name: `${name}.${extension}`, path: `${folder}\\${name}.${extension}`, extension,
  isDir: false, sizeBytes: 1, modifiedAtMillis: 0,
});
const rule = (pattern = "Summertime [Contador]", start = 1, step = 1): RuleStep => ({
  id: "number", title: "Numerar", type: "template", enabled: true,
  config: { pattern, counterStart: start, counterPadding: 2, counterStep: step },
});
function preview(items: RenamerFileItem[], rules: RuleStep[], occupied: string[], selected = new Set(items.map((i) => i.path))) {
  return computeRenamingPreview(items, rules, selected, new Set(occupied));
}

test("20 imágenes saltan los nombres ocupados del 07 al 14 y continúan desde el 15", () => {
  const files = Array.from({ length: 20 }, (_, i) => item(`picture${i}`));
  const occupied = Array.from({ length: 8 }, (_, i) => item(`Summertime ${String(i + 7).padStart(2, "0")}`).path);
  const result = preview(files, [rule()], [...occupied, ...files.map((f) => f.path)]);
  expect(result.map((p) => p.newName)).toEqual([
    ...Array.from({ length: 6 }, (_, i) => `Summertime ${String(i + 1).padStart(2, "0")}.png`),
    ...Array.from({ length: 14 }, (_, i) => `Summertime ${i + 15}.png`),
  ]);
  expect(result.every((p) => p.status === "ready")).toBe(true);
  expect(result.reduce((total, p) => total + (p.skippedNumbers ?? 0), 0)).toBe(8);
  expect(new Set(result.map((p) => p.newPath)).size).toBe(20);
  expect(result.some((p) => occupied.includes(p.newPath))).toBe(false);
});

test("el paso Contador también salta nombres ocupados tras aplicar las demás reglas", () => {
  const files = [item("same"), item("same", "C:\\images", "jpg")];
  const counter: RuleStep = { id: "counter", type: "counter", title: "Contador", enabled: true,
    config: { start: 1, step: 1, padding: 2, position: "end", prefix: " ", suffix: "" } };
  const extension: RuleStep = { id: "ext", type: "extension", title: "Extensión", enabled: true,
    config: { mode: "custom", customExt: "webp" } };
  const occupied = [item("same 01", "C:\\images", "webp").path];
  expect(preview(files, [counter, extension], occupied).map((p) => p.newName)).toEqual(["same 02.webp", "same 03.webp"]);
});

test("reserva destinos de la misma tanda aunque una regla posterior elimine la diferencia del nombre original", () => {
  const files = [item("a"), item("b")];
  const rules: RuleStep[] = [rule("[Nombre] [Contador]"), {
    id: "replace", type: "replace", title: "Normalizar", enabled: true,
    config: { find: "^[ab]", replace: "imagen", useRegex: true, matchCase: false, replaceAll: true },
  }];
  const occupied = [item("imagen 01").path];
  expect(preview(files, rules, occupied).map((p) => p.newName)).toEqual(["imagen 02.png", "imagen 03.png"]);
});

test("respeta inicio e incremento personalizados", () => {
  const files = [item("a"), item("b")];
  expect(preview(files, [rule("foto [Contador]", 10, 2)], [item("foto 10").path, item("foto 12").path])
    .map((p) => p.newName)).toEqual(["foto 14.png", "foto 16.png"]);
});

test("distingue carpetas y extensiones y compara las rutas sin distinguir mayúsculas", () => {
  const files = [item("a"), item("b", "D:\\otra")];
  const occupied = [item("Summertime 01").path.toUpperCase().replace(/\\/g, "/"), item("Summertime 02", "C:\\images", "jpg").path];
  expect(preview(files, [rule()], occupied).map((p) => p.newName)).toEqual(["Summertime 02.png", "Summertime 03.png"]);
});

test("los archivos excluidos no consumen números pero sus nombres ocupados se respetan", () => {
  const excluded = item("Summertime 01"); const next = item("new");
  const result = preview([excluded, next], [rule()], [excluded.path], new Set([next.path]));
  expect(result[0].status).toBe("excluded"); expect(result[1].newName).toBe("Summertime 02.png");
});

test("los nombres que ya corresponden al propio archivo se mantienen", () => {
  const files = [item("Summertime 01"), item("new")];
  const result = preview(files, [rule()], files.map((f) => f.path));
  expect(result[0].status).toBe("unchanged"); expect(result[1].newName).toBe("Summertime 02.png");
});

test("una plantilla sin contador conserva el conflicto en lugar de inventar sufijos", () => {
  const files = [item("a"), item("b")];
  expect(preview(files, [rule("fixed")], [item("fixed").path]).every((p) => p.status === "conflict")).toBe(true);
});

test("un contador eliminado por reglas posteriores termina sin entrar en un bucle", () => {
  const files = [item("a"), item("b")];
  const remove: RuleStep = { id: "remove", type: "remove", title: "Quitar números", enabled: true, config: { removeType: "numbers" } };
  const result = preview(files, [rule("foto[Contador]"), remove], [item("foto").path]);
  expect(result.every((p) => p.status === "conflict")).toBe(true);
});

test("los alias de contador de plantilla y el lazo de numeración descendente también funcionan", () => {
  for (const token of ["Counter", "Número", "Num", "01", "001", "0001"]) {
    const files = [item("a")];
    const first = computeRenamingPreview(files, [rule(`foto [${token}]`, 5, -1)], new Set([files[0].path]));
    const result = preview(files, [rule(`foto [${token}]`, 5, -1)], [first[0].newPath]);
    expect(result[0].newPath).not.toBe(first[0].newPath);
    expect(result[0].skippedNumbers).toBe(1);
  }
});
