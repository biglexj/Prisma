import type { AnnotationPoint, RectSelection } from "../../model/types";

export function annotationShapeRect(
  start: AnnotationPoint,
  end: AnnotationPoint,
  constrain: boolean,
): RectSelection {
  let dx = end.x - start.x;
  let dy = end.y - start.y;
  if (constrain) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = (dx < 0 ? -1 : 1) * side;
    dy = (dy < 0 ? -1 : 1) * side;
  }
  return {
    x: start.x + Math.min(0, dx),
    y: start.y + Math.min(0, dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}
