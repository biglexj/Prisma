export interface SurfaceRect { x: number; y: number; width: number; height: number }

export function intersectSurface(a: SurfaceRect, b: SurfaceRect): SurfaceRect | null {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? {x, y, width: right - x, height: bottom - y} : null;
}

/** Huecos físicos: los botones conservan su receptor web original. */
export function surfaceHoles(surface: SurfaceRect, controls: SurfaceRect[]): SurfaceRect[] {
  return controls.flatMap(control => {
    const clipped = intersectSurface(surface, control);
    return clipped ? [{...clipped, x: clipped.x - surface.x, y: clipped.y - surface.y}] : [];
  });
}
