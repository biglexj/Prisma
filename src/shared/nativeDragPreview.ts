const SQUARE_SIZE = 176;
const WIDE_SIZE = { width: 208, height: 117 };
const TALL_SIZE = { width: 117, height: 208 };
const INSET = 8;

type PreviewKind = "image" | "video" | "music" | "file";
type PreviewLayout = { width: number; height: number };

/** Tres siluetas estables para el arrastre, según la proporción real del medio. */
export function nativeDragPreviewLayout(width: number, height: number): PreviewLayout {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: SQUARE_SIZE, height: SQUARE_SIZE };
  }
  const ratio = width / height;
  if (ratio >= 1.25) return WIDE_SIZE;
  if (ratio <= 0.8) return TALL_SIZE;
  return { width: SQUARE_SIZE, height: SQUARE_SIZE };
}

export function nativeDragPreviewKind(path: string): PreviewKind {
  const extension = path.split(/[?#]/, 1)[0].match(/\.([^.\\/]+)$/)?.[1]?.toLowerCase();
  if (extension && /^(png|jpe?g|webp|gif|bmp|svg|tiff?|avif|heic|heif)$/.test(extension)) return "image";
  if (extension && /^(mp4|mkv|mov|avi|webm|m4v|wmv|flv|mpg|mpeg|ts)$/.test(extension)) return "video";
  if (extension && /^(mp3|flac|wav|m4a|aac|ogg|opus|wma|aiff?|alac)$/.test(extension)) return "music";
  return "file";
}

function readyMedia(element: Element | null): HTMLImageElement | HTMLVideoElement | null {
  if (!element) return null;
  const candidates = [element, ...element.querySelectorAll("img, video")];
  for (const candidate of candidates) {
    if (candidate instanceof HTMLImageElement && candidate.complete && candidate.naturalWidth > 0) return candidate;
    if (candidate instanceof HTMLVideoElement && candidate.readyState >= 2 && candidate.videoWidth > 0) return candidate;
  }
  return null;
}

function fillImage(
  context: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  width: number,
  height: number,
  layout: PreviewLayout,
) {
  const contentWidth = layout.width - INSET * 2;
  const contentHeight = layout.height - INSET * 2;
  const scale = Math.min(contentWidth / width, contentHeight / height);
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  context.drawImage(media, INSET + (contentWidth - drawnWidth) / 2, INSET + (contentHeight - drawnHeight) / 2, drawnWidth, drawnHeight);
}

function drawFallback(context: CanvasRenderingContext2D, kind: PreviewKind, layout: PreviewLayout) {
  const colors: Record<PreviewKind, string> = {
    image: "#50d7b1",
    video: "#79b9ff",
    music: "#ec9ccf",
    file: "#b4a7ee",
  };
  context.fillStyle = "#20233a";
  context.fillRect(INSET, INSET, layout.width - INSET * 2, layout.height - INSET * 2);
  context.fillStyle = colors[kind];
  const centerX = layout.width / 2;
  const centerY = layout.height / 2;
  const iconSize = Math.min(layout.width, layout.height);
  if (kind === "video") {
    context.beginPath();
    context.moveTo(centerX - iconSize * 0.08, centerY - iconSize * 0.19);
    context.lineTo(centerX + iconSize * 0.23, centerY);
    context.lineTo(centerX - iconSize * 0.08, centerY + iconSize * 0.19);
    context.closePath();
    context.fill();
  } else {
    context.font = `bold ${Math.round(iconSize * 0.48)}px Segoe UI Symbol, Segoe UI, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(kind === "music" ? "♫" : kind === "image" ? "▧" : "▤", centerX, centerY);
  }
}

/** PNG compacto para el icono OLE. Reutiliza la miniatura ya visible sin cargar el archivo otra vez. */
export function createNativeDragPreview(path: string, element?: Element | null, count = 1): string | null {
  if (typeof document === "undefined") return null;
  try {
    const media = readyMedia(element ?? null);
    const mediaWidth = media instanceof HTMLImageElement ? media.naturalWidth : media?.videoWidth ?? 0;
    const mediaHeight = media instanceof HTMLImageElement ? media.naturalHeight : media?.videoHeight ?? 0;
    const layout = nativeDragPreviewLayout(mediaWidth, mediaHeight);
    const canvas = document.createElement("canvas");
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.shadowColor = "rgba(0, 0, 0, 0.42)";
    context.shadowBlur = 9;
    context.shadowOffsetY = 3;
    context.fillStyle = "#111321";
    context.fillRect(INSET - 2, INSET - 2, layout.width - (INSET - 2) * 2, layout.height - (INSET - 2) * 2);
    context.shadowColor = "transparent";
    if (media) {
      try {
        context.save();
        context.beginPath();
        context.rect(INSET, INSET, layout.width - INSET * 2, layout.height - INSET * 2);
        context.clip();
        fillImage(context, media, mediaWidth, mediaHeight, layout);
        context.restore();
      } catch {
        context.restore();
        drawFallback(context, nativeDragPreviewKind(path), layout);
      }
    } else {
      drawFallback(context, nativeDragPreviewKind(path), layout);
    }
    if (count > 1) {
      context.fillStyle = "#ed0056";
      context.beginPath();
      context.arc(layout.width - 22, 25, 18, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#fff";
      context.font = "bold 15px Segoe UI, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(count > 99 ? "99+" : String(count), layout.width - 22, 25);
    }
    try {
      return canvas.toDataURL("image/png");
    } catch {
      // Un recurso local servido por WebView puede bloquear la lectura del lienzo.
      // En ese caso crear otro lienzo limpio con el icono de la categoría.
      const safeCanvas = document.createElement("canvas");
      safeCanvas.width = layout.width;
      safeCanvas.height = layout.height;
      const safeContext = safeCanvas.getContext("2d");
      if (!safeContext) return null;
      drawFallback(safeContext, nativeDragPreviewKind(path), layout);
      return safeCanvas.toDataURL("image/png");
    }
  } catch {
    return null;
  }
}
