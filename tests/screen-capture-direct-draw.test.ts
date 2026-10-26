import { expect, test } from "bun:test";
import type { AnnotationItem, AnnotationPoint } from "../src/features/screen_capture/model/types";

/**
 * Lógica pura de decisión de garabato directo vs clic simple:
 * Un garabato requiere un desplazamiento real (>= 4px o más de 2 puntos).
 * Un clic simple abre la edición con las herramientas habilitadas sin dejar mancha accidental.
 */
function evaluateDirectScribble(
  pts: AnnotationPoint[],
  activeTool: "pen" | "highlighter",
  activeColor: string,
  strokeWidth: number
): AnnotationItem | undefined {
  const isScribble =
    pts.length > 2 ||
    (pts.length === 2 && Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) >= 4);

  if (!isScribble || pts.length === 0) return undefined;

  return {
    id: "test-stroke",
    tool: activeTool,
    color: activeColor,
    strokeWidth,
    points: pts,
    startPoint: pts[0],
    endPoint: pts[pts.length - 1],
    rect: { x: 0, y: 0, width: 0, height: 0 },
  };
}

test("un clic simple en el centro de la selección habilita herramientas sin dejar mancha accidental", () => {
  const clickPoints: AnnotationPoint[] = [{ x: 50, y: 50 }];
  const stroke = evaluateDirectScribble(clickPoints, "pen", "#00C9B9", 4);
  expect(stroke).toBeUndefined();
});

test("un micro-movimiento involuntario menor a 4px se trata como clic simple para no ensuciar la imagen", () => {
  const microMove: AnnotationPoint[] = [
    { x: 50, y: 50 },
    { x: 51, y: 51 },
  ];
  const stroke = evaluateDirectScribble(microMove, "pen", "#00C9B9", 4);
  expect(stroke).toBeUndefined();
});

test("un garabato intencional (>2 puntos o >=4px) genera el trazo con la herramienta y color activos", () => {
  const scribble: AnnotationPoint[] = [
    { x: 50, y: 50 },
    { x: 60, y: 65 },
    { x: 80, y: 90 },
  ];
  const stroke = evaluateDirectScribble(scribble, "pen", "#FF4444", 6);
  expect(stroke).toBeDefined();
  expect(stroke?.tool).toBe("pen");
  expect(stroke?.color).toBe("#FF4444");
  expect(stroke?.strokeWidth).toBe(6);
  expect(stroke?.points).toHaveLength(3);
  expect(stroke?.startPoint).toEqual({ x: 50, y: 50 });
  expect(stroke?.endPoint).toEqual({ x: 80, y: 90 });
});

test("el trazo directo conserva los extremos exactos para renderizado ininterrumpido", () => {
  const points: AnnotationPoint[] = [
    { x: 10, y: 20 },
    { x: 15, y: 30 },
  ];
  const stroke = evaluateDirectScribble(points, "pen", "#00C9B9", 4);
  expect(stroke).toBeDefined();
  expect(stroke?.startPoint).toEqual({ x: 10, y: 20 });
  expect(stroke?.endPoint).toEqual({ x: 15, y: 30 });
});
