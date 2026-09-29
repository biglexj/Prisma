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

export type WatermarkLogoPlacement = "above" | "below" | "left" | "right" | "overlay";

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  includeDate: boolean;
  logoPath?: string | null;
  logoDataUrl?: string | null;
  logoScale: number; // Tamaño relativo del logotipo, independiente del texto
  logoPlacement: WatermarkLogoPlacement;
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
  logoScale: 0.45,
  logoPlacement: "above",
  position: "bottom-right",
  normX: 0.5,
  normY: 0.5,
  scale: 1.0,
  opacity: 0.85,
  color: "#ffffff",
  withShadow: true,
};

const EDGE_MARGIN_RATIO = 0.01;

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
  logoX: number;
  logoY: number;
  fontSize: number;
  text: string;
  textWidth: number;
  textX: number;
  textY: number;
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
  const logoScale = Math.max(0.1, Math.min(2, config.logoScale ?? 0.45));
  let fontSize = Math.max(12, Math.min(160, Math.round(width * 0.032 * scale)));
  ctx.save();
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  let textWidth = text ? Math.min(width * 0.9, ctx.measureText(text).width) : 0;
  ctx.restore();

  let logoWidth = 0;
  let logoHeight = 0;
  if (hasLogo && logoImg) {
    const imageScale = Math.min(
      width * 0.22 * logoScale / logoImg.naturalWidth,
      height * 0.14 * logoScale / logoImg.naturalHeight,
    );
    logoWidth = Math.max(1, logoImg.naturalWidth * imageScale);
    logoHeight = Math.max(1, logoImg.naturalHeight * imageScale);
  }

  const textHeight = text ? fontSize * 1.2 : 0;
  const gap = hasLogo && text ? Math.max(4, Math.min(width, height) * 0.012) : 0;
  let markWidth = Math.max(textWidth, logoWidth);
  let markHeight = logoHeight + (text ? textHeight + gap : 0);
  let logoX = (markWidth - logoWidth) / 2;
  let logoY = 0;
  let textX = markWidth / 2;
  let textY = logoHeight + gap;

  if (hasLogo && text) {
    switch (config.logoPlacement ?? "above") {
      case "below":
        markHeight = textHeight + gap + logoHeight;
        logoY = textHeight + gap;
        textY = 0;
        break;
      case "left":
        markWidth = logoWidth + gap + textWidth;
        markHeight = Math.max(logoHeight, textHeight);
        logoX = 0;
        logoY = (markHeight - logoHeight) / 2;
        textX = logoWidth + gap + textWidth / 2;
        textY = (markHeight - textHeight) / 2;
        break;
      case "right":
        markWidth = textWidth + gap + logoWidth;
        markHeight = Math.max(logoHeight, textHeight);
        logoX = textWidth + gap;
        logoY = (markHeight - logoHeight) / 2;
        textX = textWidth / 2;
        textY = (markHeight - textHeight) / 2;
        break;
      case "overlay":
        markHeight = Math.max(logoHeight, textHeight);
        logoY = (markHeight - logoHeight) / 2;
        textY = (markHeight - textHeight) / 2;
        break;
      case "above":
        break;
    }
  } else if (!hasLogo) {
    markHeight = textHeight;
    textY = 0;
  }

  const fit = Math.min(1, width * (1 - 2 * EDGE_MARGIN_RATIO) / markWidth, height * (1 - 2 * EDGE_MARGIN_RATIO) / markHeight);
  markWidth *= fit;
  markHeight *= fit;
  logoWidth *= fit;
  logoHeight *= fit;
  logoX *= fit;
  logoY *= fit;
  textWidth *= fit;
  textX *= fit;
  textY *= fit;
  fontSize *= fit;
  const marginX = width * EDGE_MARGIN_RATIO;
  const marginY = height * EDGE_MARGIN_RATIO;
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
    logoX,
    logoY,
    fontSize,
    text,
    textWidth,
    textX,
    textY,
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
  const logoShadowScale = Math.max(0.2, Math.min(2, config.logoScale ?? 0.45));

  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1.0, config.opacity));

  if (layout.logoWidth > 0 && logoImg) {
    if (config.withShadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
      ctx.shadowBlur = Math.round(6 * logoShadowScale);
      ctx.shadowOffsetX = Math.round(2 * logoShadowScale);
      ctx.shadowOffsetY = Math.round(2 * logoShadowScale);
    }

    ctx.drawImage(
      logoImg,
      layout.x + layout.logoX,
      layout.y + layout.logoY,
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
      layout.x + layout.textX,
      layout.y + layout.textY,
      layout.textWidth,
    );
  }

  ctx.restore();
}
