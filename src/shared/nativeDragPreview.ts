const PREVIEW_SIZE = 176;
const INSET = 8;
const CONTENT_SIZE = PREVIEW_SIZE - INSET * 2;

type PreviewKind = "image" | "video" | "music" | "file";

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
) {
  const scale = Math.max(CONTENT_SIZE / width, CONTENT_SIZE / height);
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  context.drawImage(media, INSET + (CONTENT_SIZE - drawnWidth) / 2, INSET + (CONTENT_SIZE - drawnHeight) / 2, drawnWidth, drawnHeight);
}

function drawFallback(context: CanvasRenderingContext2D, kind: PreviewKind) {
  const colors: Record<PreviewKind, string> = {
    image: "#50d7b1",
    video: "#79b9ff",
    music: "#ec9ccf",
    file: "#b4a7ee",
  };
  context.fillStyle = "#20233a";
  context.fillRect(INSET, INSET, CONTENT_SIZE, CONTENT_SIZE);
  context.fillStyle = colors[kind];
  if (kind === "video") {
    context.beginPath();
    context.moveTo(PREVIEW_SIZE * 0.42, PREVIEW_SIZE * 0.31);
    context.lineTo(PREVIEW_SIZE * 0.73, PREVIEW_SIZE * 0.5);
    context.lineTo(PREVIEW_SIZE * 0.42, PREVIEW_SIZE * 0.69);
    context.closePath();
    context.fill();
  } else {
    context.font = `bold ${Math.round(PREVIEW_SIZE * 0.48)}px Segoe UI Symbol, Segoe UI, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(kind === "music" ? "♫" : kind === "image" ? "▧" : "▤", PREVIEW_SIZE / 2, PREVIEW_SIZE / 2);
  }
}

/** PNG compacto para el icono OLE. Reutiliza la miniatura ya visible sin cargar el archivo otra vez. */
export function createNativeDragPreview(path: string, element?: Element | null, count = 1): string | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.shadowColor = "rgba(0, 0, 0, 0.42)";
    context.shadowBlur = 9;
    context.shadowOffsetY = 3;
    context.fillStyle = "#111321";
    context.fillRect(INSET - 2, INSET - 2, CONTENT_SIZE + 4, CONTENT_SIZE + 4);
    context.shadowColor = "transparent";
    const media = readyMedia(element ?? null);
    if (media) {
      const width = media instanceof HTMLImageElement ? media.naturalWidth : media.videoWidth;
      const height = media instanceof HTMLImageElement ? media.naturalHeight : media.videoHeight;
      try {
        context.save();
        context.beginPath();
        context.rect(INSET, INSET, CONTENT_SIZE, CONTENT_SIZE);
        context.clip();
        fillImage(context, media, width, height);
        context.restore();
      } catch {
        context.restore();
        drawFallback(context, nativeDragPreviewKind(path));
      }
    } else {
      drawFallback(context, nativeDragPreviewKind(path));
    }
    if (count > 1) {
      context.fillStyle = "#ed0056";
      context.beginPath();
      context.arc(PREVIEW_SIZE - 22, 25, 18, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#fff";
      context.font = "bold 15px Segoe UI, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(count > 99 ? "99+" : String(count), PREVIEW_SIZE - 22, 25);
    }
    try {
      return canvas.toDataURL("image/png");
    } catch {
      // Un recurso local servido por WebView puede bloquear la lectura del lienzo.
      // En ese caso crear otro lienzo limpio con el icono de la categoría.
      const safeCanvas = document.createElement("canvas");
      safeCanvas.width = PREVIEW_SIZE;
      safeCanvas.height = PREVIEW_SIZE;
      const safeContext = safeCanvas.getContext("2d");
      if (!safeContext) return null;
      drawFallback(safeContext, nativeDragPreviewKind(path));
      return safeCanvas.toDataURL("image/png");
    }
  } catch {
    return null;
  }
}
