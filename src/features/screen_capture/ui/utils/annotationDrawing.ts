import type { AnnotationItem } from "../../model/types";

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromx: number,
  fromy: number,
  tox: number,
  toy: number,
  headlen: number
) {
  const dx = tox - fromx;
  const dy = toy - fromy;
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(fromx, fromy);
  ctx.lineTo(tox, toy);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tox, toy);
  ctx.lineTo(
    tox - headlen * Math.cos(angle - Math.PI / 6),
    toy - headlen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    tox - headlen * Math.cos(angle + Math.PI / 6),
    toy - headlen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

export function drawAnnotation(ctx: CanvasRenderingContext2D, item: AnnotationItem) {
  ctx.save();
  ctx.strokeStyle = item.color;
  ctx.fillStyle = item.color;
  ctx.lineWidth = item.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (item.tool === "highlighter") {
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = item.strokeWidth * 3.5;
  }

  if (item.tool === "pen" || item.tool === "highlighter") {
    if (item.points && item.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(item.points[0].x, item.points[0].y);
      for (let i = 1; i < item.points.length; i++) {
        ctx.lineTo(item.points[i].x, item.points[i].y);
      }
      ctx.stroke();
    }
  } else if (item.tool === "rect" && item.rect) {
    ctx.beginPath();
    ctx.strokeRect(item.rect.x, item.rect.y, item.rect.width, item.rect.height);
  } else if (item.tool === "arrow" && item.startPoint && item.endPoint) {
    drawArrow(
      ctx,
      item.startPoint.x,
      item.startPoint.y,
      item.endPoint.x,
      item.endPoint.y,
      item.strokeWidth * 3.5
    );
  } else if (item.tool === "text" && item.startPoint && item.text) {
    ctx.font = `bold ${item.fontSize || 20}px Inter, sans-serif`;
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 4;
    ctx.fillText(item.text, item.startPoint.x, item.startPoint.y);
  }

  ctx.restore();
}
