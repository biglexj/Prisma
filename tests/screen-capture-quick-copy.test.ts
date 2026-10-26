import { expect, test } from "bun:test";
import {
  dataUrlToBlob,
  lassoSelection,
  resolveSelection,
  type SelectionContext,
} from "../src/features/screen_capture/ui/utils/quickCapture";
import type { AnnotationPoint } from "../src/features/screen_capture/model/types";

function context(overrides: Partial<SelectionContext> = {}): SelectionContext {
  return {
    mode: "window",
    selectionRect: null,
    activeTarget: null,
    subregionTarget: null,
    useSubregion: false,
    activeMonitor: null,
    monitors: [],
    lassoPoints: [],
    ...overrides,
  };
}

const windowTarget = { id: "w1", title: "Explorador", className: "x", x: 10, y: 20, width: 800, height: 600 };
const subregion = { id: "w2", title: "Panel", className: "x", x: 40, y: 60, width: 200, height: 100 };
const monitor = { id: 1, name: "Principal", x: 0, y: 0, width: 1920, height: 1080, isPrimary: true };

test("modo Ventana: la selección es la ventana bajo el cursor", () => {
  const selection = resolveSelection(context({ mode: "window", activeTarget: windowTarget }));
  expect(selection?.rect).toEqual({ x: 10, y: 20, width: 800, height: 600 });
});

test("modo Ventana: con subregión activada se captura el control interno", () => {
  const selection = resolveSelection(context({
    mode: "window",
    activeTarget: windowTarget,
    subregionTarget: subregion,
    useSubregion: true,
  }));
  expect(selection?.rect).toEqual({ x: 40, y: 60, width: 200, height: 100 });
});

test("modo Ventana: sin ventana bajo el cursor no hay nada que copiar", () => {
  expect(resolveSelection(context({ mode: "window" }))).toBeNull();
});

test("modo Rectángulo: el rectángulo arrastrado es la selección", () => {
  const selection = resolveSelection(context({
    mode: "rect",
    selectionRect: { x: 5, y: 6, width: 120, height: 90 },
  }));
  expect(selection?.rect).toEqual({ x: 5, y: 6, width: 120, height: 90 });
});

test("modo Rectángulo: un arrastre accidental no produce captura", () => {
  expect(resolveSelection(context({
    mode: "rect",
    selectionRect: { x: 5, y: 6, width: 4, height: 90 },
  }))).toBeNull();
});

test("modo Pantalla completa: el monitor resaltado manda y la sesión respalda", () => {
  const highlighted = resolveSelection(context({
    mode: "fullscreen",
    activeMonitor: { ...monitor, id: 2, x: 1920, y: 0, width: 1280, height: 720 },
    monitors: [monitor],
  }));
  expect(highlighted?.rect).toEqual({ x: 1920, y: 0, width: 1280, height: 720 });

  const fallback = resolveSelection(context({ mode: "fullscreen", monitors: [monitor] }));
  expect(fallback?.rect).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
});

test("modo Forma libre: el lazo produce rectángulo y polígono relativo", () => {
  const points: AnnotationPoint[] = [
    { x: 100, y: 100 }, { x: 300, y: 110 }, { x: 320, y: 260 },
    { x: 90, y: 240 }, { x: 110, y: 180 }, { x: 200, y: 150 },
  ];
  const selection = resolveSelection(context({ mode: "freeform", lassoPoints: points }));
  expect(selection?.rect).toEqual({ x: 90, y: 100, width: 230, height: 160 });
  expect(selection?.clipPolygon?.[0]).toEqual({ x: 10, y: 0 });
  expect(selection?.clipPolygon).toHaveLength(points.length);
});

test("modo Forma libre: un trazo demasiado corto se descarta", () => {
  expect(resolveSelection(context({
    mode: "freeform",
    lassoPoints: [{ x: 0, y: 0 }, { x: 4, y: 4 }],
  }))).toBeNull();
  expect(lassoSelection([{ x: 0, y: 0 }, { x: 20, y: 20 }])).toBeNull();
});

test("el selector de color no genera captura de imagen", () => {
  expect(resolveSelection(context({ mode: "eyedropper", activeTarget: windowTarget }))).toBeNull();
});

test("el data URL de la captura se convierte en un blob PNG intacto", async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const dataUrl = `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  const blob = dataUrlToBlob(dataUrl);
  expect(blob.type).toBe("image/png");
  expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
});
