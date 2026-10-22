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
  const length = Math.hypot(dx, dy);
  if (length < 1) return;
  headlen = Math.min(Math.max(headlen, 12), length * 0.65);
  const angle = Math.atan2(dy, dx);
  const baseX = tox - headlen * Math.cos(angle);
  const baseY = toy - headlen * Math.sin(angle);
  const halfWidth = headlen * 0.48;
  ctx.beginPath();
  ctx.moveTo(fromx, fromy);
  ctx.lineTo(baseX, baseY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tox, toy);
  ctx.lineTo(
    baseX - halfWidth * Math.sin(angle),
    baseY + halfWidth * Math.cos(angle)
  );
  ctx.lineTo(
    baseX + halfWidth * Math.sin(angle),
    baseY - halfWidth * Math.cos(angle)
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
  } else if (item.tool === "ellipse" && item.rect) {
    const { x, y, width, height } = item.rect;
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
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
    const fontSize = item.fontSize || 20;
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 4;
    const lines = item.text.split("\n");
    const lineHeight = fontSize * 1.25;
    lines.forEach((line, idx) => {
      ctx.fillText(line, item.startPoint!.x, item.startPoint!.y + idx * lineHeight);
    });
  }

  ctx.restore();
}
