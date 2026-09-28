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
  normX: number; // 0.05 a 0.95
  normY: number; // 0.05 a 0.95
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
  normX: 0.85,
  normY: 0.90,
  scale: 1.0,
  opacity: 0.85,
  color: "#ffffff",
  withShadow: true,
};

/**
 * Calcula las coordenadas normalizadas relativas (0..1) para cada anclaje canónico.
 */
export function getAnchorCoordinates(
  position: WatermarkPosition,
  customNormX: number,
  customNormY: number
): { normX: number; normY: number } {
  switch (position) {
    case "top-left":
      return { normX: 0.12, normY: 0.10 };
    case "top-right":
      return { normX: 0.88, normY: 0.10 };
    case "bottom-left":
      return { normX: 0.12, normY: 0.90 };
    case "bottom-right":
      return { normX: 0.88, normY: 0.90 };
    case "center":
      return { normX: 0.50, normY: 0.50 };
    case "custom":
    default:
      return {
        normX: Math.max(0.04, Math.min(0.96, customNormX)),
        normY: Math.max(0.04, Math.min(0.96, customNormY)),
      };
  }
}

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
  if (!config.enabled) return;

  const textToDraw = resolveWatermarkText(config);
  const hasLogo = Boolean(logoImg && logoImg.naturalWidth && logoImg.naturalHeight);

  if (!textToDraw && !hasLogo) return;

  const { normX, normY } = getAnchorCoordinates(
    config.position,
    config.normX,
    config.normY
  );

  const targetX = Math.round(normX * width);
  const targetY = Math.round(normY * height);
  const scaleFactor = Math.max(0.3, Math.min(3.0, config.scale));

  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1.0, config.opacity));

  let currentY = targetY;

  // 1. Dibujar logotipo PNG si está presente
  if (hasLogo && logoImg) {
    const maxLogoW = width * 0.22 * scaleFactor;
    const maxLogoH = height * 0.14 * scaleFactor;
    const logoScale = Math.min(
      maxLogoW / logoImg.naturalWidth,
      maxLogoH / logoImg.naturalHeight,
      scaleFactor
    );
    const drawW = Math.round(logoImg.naturalWidth * logoScale);
    const drawH = Math.round(logoImg.naturalHeight * logoScale);

    if (config.withShadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
      ctx.shadowBlur = Math.round(6 * scaleFactor);
      ctx.shadowOffsetX = Math.round(2 * scaleFactor);
      ctx.shadowOffsetY = Math.round(2 * scaleFactor);
    }

    ctx.drawImage(
      logoImg,
      Math.round(targetX - drawW / 2),
      Math.round(currentY - drawH / 2),
      drawW,
      drawH
    );

    // Separación para el texto que va debajo
    currentY += Math.round(drawH / 2 + 12 * scaleFactor);
  }

  // 2. Dibujar texto con tipografía escalada y contraste reforzado
  if (textToDraw) {
    const fontSize = Math.max(
      14,
      Math.min(160, Math.round(width * 0.032 * scaleFactor))
    );
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

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
    ctx.fillText(textToDraw, targetX, currentY);
  }

  ctx.restore();
}
