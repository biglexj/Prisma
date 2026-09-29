/**
 * Modelo y utilidades para estampado de marcas de agua visuales paramétricas.
 * Inspirado en el estándar de Super Galería (Lienzo Gallery).
 */

export type WatermarkPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "center"
  | "custom";

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  includeDate: boolean;
  logoPath?: string | null;
  logoDataUrl?: string | null;
  position: WatermarkPosition;
  normX: number; // Centro horizontal normalizado para la ubicación libre
  normY: number; // Centro vertical normalizado para la ubicación libre
  scale: number; // 0.4 a 2.5
  opacity: number; // 0.1 a 1.0
  color: string; // e.g. '#ffffff' o '#000000'
  withShadow: boolean;
}

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  enabled: false,
  text: "",
  includeDate: false,
  logoPath: null,
  logoDataUrl: null,
  position: "bottom-right",
  normX: 0.5,
  normY: 0.5,
  scale: 1.0,
  opacity: 0.85,
  color: "#ffffff",
  withShadow: true,
};

/**
 * Genera el texto final de la marca combinando autor y fecha ISO si corresponde.
 */
export function resolveWatermarkText(config: WatermarkConfig): string {
  const parts: string[] = [];
  const clean = config.text.trim();
  if (clean) parts.push(clean);
  if (config.includeDate) {
    const now = new Date();
    const isoDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
    parts.push(isoDate);
  }
  return parts.join(" · ");
}

/**
 * Carga de forma asíncrona un elemento Image a partir de una URL o Data URI de logo.
 */
export function loadWatermarkImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export interface WatermarkBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WatermarkLayout extends WatermarkBounds {
  logoWidth: number;
  logoHeight: number;
  fontSize: number;
  text: string;
  gap: number;
}

function getWatermarkLayout(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: WatermarkConfig,
  logoImg?: HTMLImageElement | null,
): WatermarkLayout | null {
  if (!config.enabled || width <= 0 || height <= 0) return null;
  const text = resolveWatermarkText(config);
  const hasLogo = Boolean(logoImg?.naturalWidth && logoImg?.naturalHeight);
  if (!text && !hasLogo) return null;

  const scale = Math.max(0.3, Math.min(3, config.scale));
  const fontSize = Math.max(12, Math.min(160, Math.round(width * 0.032 * scale)));
  ctx.save();
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  const textWidth = text ? Math.min(width * 0.9, ctx.measureText(text).width) : 0;
  ctx.restore();

  let logoWidth = 0;
  let logoHeight = 0;
  if (hasLogo && logoImg) {
    const logoScale = Math.min(
      width * 0.22 * scale / logoImg.naturalWidth,
      height * 0.14 * scale / logoImg.naturalHeight,
      scale,
    );
    logoWidth = Math.max(1, logoImg.naturalWidth * logoScale);
    logoHeight = Math.max(1, logoImg.naturalHeight * logoScale);
  }

  const gap = hasLogo && text ? Math.max(4, Math.min(width, height) * 0.015 * scale) : 0;
  const markWidth = Math.max(textWidth, logoWidth);
  const markHeight = logoHeight + gap + (text ? fontSize * 1.2 : 0);
  const marginX = width * 0.05;
  const marginY = height * 0.05;
  const left = marginX;
  const right = width - marginX - markWidth;
  const top = marginY;
  const bottom = height - marginY - markHeight;

  let x = (width - markWidth) / 2;
  let y = (height - markHeight) / 2;
  switch (config.position) {
    case "top-left": x = left; y = top; break;
    case "top-right": x = right; y = top; break;
    case "bottom-left": x = left; y = bottom; break;
    case "bottom-right": x = right; y = bottom; break;
    case "custom":
      x = config.normX * width - markWidth / 2;
      y = config.normY * height - markHeight / 2;
      break;
    case "center": break;
  }

  return {
    x: Math.max(left, Math.min(right, x)),
    y: Math.max(top, Math.min(bottom, y)),
    width: markWidth,
    height: markHeight,
    logoWidth,
    logoHeight,
    fontSize,
    text,
    gap,
  };
}

export function getWatermarkBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: WatermarkConfig,
  logoImg?: HTMLImageElement | null,
): WatermarkBounds | null {
  const layout = getWatermarkLayout(ctx, width, height, config, logoImg);
  if (!layout) return null;
  const { x, y, width: markWidth, height: markHeight } = layout;
  return { x, y, width: markWidth, height: markHeight };
}

/**
 * Estampa de manera precisa y proporcional la marca de agua (logo y/o texto) sobre un Canvas 2D.
 */
export function applyWatermarkToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: WatermarkConfig,
  logoImg?: HTMLImageElement | null
): void {
  const layout = getWatermarkLayout(ctx, width, height, config, logoImg);
  if (!layout) return;
  const scaleFactor = Math.max(0.3, Math.min(3.0, config.scale));

  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1.0, config.opacity));

  if (layout.logoWidth > 0 && logoImg) {
    if (config.withShadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
      ctx.shadowBlur = Math.round(6 * scaleFactor);
      ctx.shadowOffsetX = Math.round(2 * scaleFactor);
      ctx.shadowOffsetY = Math.round(2 * scaleFactor);
    }

    ctx.drawImage(
      logoImg,
      layout.x + (layout.width - layout.logoWidth) / 2,
      layout.y,
      layout.logoWidth,
      layout.logoHeight,
    );
  }

  if (layout.text) {
    ctx.font = `600 ${layout.fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    if (config.withShadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      ctx.shadowBlur = Math.round(5 * scaleFactor);
      ctx.shadowOffsetX = Math.round(2 * scaleFactor);
      ctx.shadowOffsetY = Math.round(2 * scaleFactor);
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = config.color || "#ffffff";
    ctx.fillText(
      layout.text,
      layout.x + layout.width / 2,
      layout.y + layout.logoHeight + layout.gap,
      layout.width,
    );
  }

  ctx.restore();
}
