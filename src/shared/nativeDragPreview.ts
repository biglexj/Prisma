const SQUARE_SIZE = 184;
const WIDE_SIZE = { width: 224, height: 126 };
const TALL_SIZE = { width: 126, height: 224 };
const CARD_RADIUS = 10;
const BORDER_WIDTH = 2;

export type PreviewKind = "image" | "video" | "music" | "file";
export type PreviewLayout = { width: number; height: number };

/**
 * Calcula la silueta de arrastre óptima según la proporción y tipo del medio.
 * - Música: Siempre rigurosamente cuadrada (1:1 / 184x184).
 * - Vídeos e Imágenes: Se adaptan a su proporción real:
 *   - Horizontal / Panorámica (16:9 / 224x126)
 *   - Vertical / Retrato (9:16 / 126x224)
 *   - Cuadrada (1:1 / 184x184)
 */
export function nativeDragPreviewLayout(
  width: number,
  height: number,
  kind?: PreviewKind
): PreviewLayout {
  // 1. Música es siempre cuadrada en Prisma
  if (kind === "music") {
    return { width: SQUARE_SIZE, height: SQUARE_SIZE };
  }

  // 2. Si no hay dimensiones finitas o válidas:
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    if (kind === "video") {
      return WIDE_SIZE; // Los vídeos por omisión son panorámicos (16:9)
    }
    return { width: SQUARE_SIZE, height: SQUARE_SIZE };
  }

  // 3. Proporción del medio
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

/** Dibuja un rectángulo con esquinas redondeadas compatible con todos los navegadores y WebView2. */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function readyMedia(element: Element | null, path?: string): HTMLImageElement | HTMLVideoElement | null {
  if (element) {
    const candidates = [element, ...element.querySelectorAll("img, video")];
    for (const candidate of candidates) {
      if (candidate instanceof HTMLImageElement && candidate.complete && candidate.naturalWidth > 0) return candidate;
      if (candidate instanceof HTMLVideoElement && candidate.readyState >= 2 && candidate.videoWidth > 0) return candidate;
    }
  }

  // Si no se encontró en el elemento directo, intentar ubicar una miniatura cargada en el DOM por nombre de archivo
  if (typeof document !== "undefined" && path) {
    const normalized = path.replace(/\\/g, "/");
    const fileName = normalized.split("/").pop();
    if (fileName && fileName.length > 2) {
      const allImgs = document.querySelectorAll("img");
      for (const img of allImgs) {
        if (img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0) {
          if (img.src.includes(encodeURIComponent(fileName)) || img.alt === fileName) {
            return img;
          }
        }
      }
    }
  }

  return null;
}

/** Escala la miniatura en modo cover centrado dentro del marco redondeado para máxima visibilidad. */
function fillImageCover(
  context: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  mediaWidth: number,
  mediaHeight: number,
  layout: PreviewLayout
) {
  const innerW = layout.width - BORDER_WIDTH * 2;
  const innerH = layout.height - BORDER_WIDTH * 2;
  const scale = Math.max(innerW / mediaWidth, innerH / mediaHeight);
  const drawnW = mediaWidth * scale;
  const drawnH = mediaHeight * scale;
  const drawX = BORDER_WIDTH + (innerW - drawnW) / 2;
  const drawY = BORDER_WIDTH + (innerH - drawnH) / 2;
  context.drawImage(media, drawX, drawY, drawnW, drawnH);
}

/** Dibuja un distintivo elegante superpuesto sobre la miniatura real para identificar el tipo de medio. */
function drawMediaBadge(context: CanvasRenderingContext2D, kind: PreviewKind, layout: PreviewLayout) {
  if (kind === "video") {
    // Pastilla circular de Play en la esquina inferior izquierda
    const badgeX = 20;
    const badgeY = layout.height - 20;
    const radius = 13;

    context.save();
    context.fillStyle = "rgba(10, 12, 20, 0.72)";
    context.beginPath();
    context.arc(badgeX, badgeY, radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(255, 255, 255, 0.35)";
    context.lineWidth = 1;
    context.stroke();

    // Triángulo Play blanco centrado
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.moveTo(badgeX - 3.5, badgeY - 5.5);
    context.lineTo(badgeX + 6, badgeY);
    context.lineTo(badgeX - 3.5, badgeY + 5.5);
    context.closePath();
    context.fill();
    context.restore();
  } else if (kind === "music") {
    // Pastilla circular de Nota Musical en la esquina inferior izquierda
    const badgeX = 20;
    const badgeY = layout.height - 20;
    const radius = 13;

    context.save();
    context.fillStyle = "rgba(10, 12, 20, 0.72)";
    context.beginPath();
    context.arc(badgeX, badgeY, radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(255, 255, 255, 0.35)";
    context.lineWidth = 1;
    context.stroke();

    context.fillStyle = "#ffffff";
    context.font = "bold 13px Segoe UI Symbol, Segoe UI, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("♫", badgeX, badgeY + 0.5);
    context.restore();
  }
}

/** Fondo y distintivo estilizado cuando no hay miniatura visual disponible en el DOM. */
function drawFallback(context: CanvasRenderingContext2D, kind: PreviewKind, layout: PreviewLayout) {
  const { width, height } = layout;

  if (kind === "music") {
    // Disco de vinilo estilizado con gradiente y nota central
    context.fillStyle = "#1b182b";
    context.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const vinylRadius = Math.min(width, height) * 0.38;

    // Disco exterior
    context.fillStyle = "#0c0d16";
    context.beginPath();
    context.arc(centerX, centerY, vinylRadius, 0, Math.PI * 2);
    context.fill();

    // Surcos concéntricos finos
    context.strokeStyle = "rgba(255, 255, 255, 0.08)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(centerX, centerY, vinylRadius * 0.82, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(centerX, centerY, vinylRadius * 0.64, 0, Math.PI * 2);
    context.stroke();

    // Etiqueta central magenta Prisma
    context.fillStyle = "#d946ef";
    context.beginPath();
    context.arc(centerX, centerY, vinylRadius * 0.36, 0, Math.PI * 2);
    context.fill();

    // Nota musical central blanca
    context.fillStyle = "#ffffff";
    context.font = `bold ${Math.round(vinylRadius * 0.36)}px Segoe UI Symbol, Segoe UI, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("♫", centerX, centerY + 0.5);
    return;
  }

  if (kind === "video") {
    // Fondo cinematográfico oscuro con botón de reproducción cian
    context.fillStyle = "#101626";
    context.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const btnRadius = Math.min(width, height) * 0.22;

    context.fillStyle = "rgba(56, 189, 248, 0.16)";
    context.beginPath();
    context.arc(centerX, centerY, btnRadius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(56, 189, 248, 0.45)";
    context.lineWidth = 1.5;
    context.stroke();

    context.fillStyle = "#38bdf8";
    context.beginPath();
    const playH = btnRadius * 0.9;
    context.moveTo(centerX - playH * 0.35, centerY - playH * 0.55);
    context.lineTo(centerX + playH * 0.55, centerY);
    context.lineTo(centerX - playH * 0.35, centerY + playH * 0.55);
    context.closePath();
    context.fill();
    return;
  }

  // Imagen o archivo general
  const fallbackColors: Record<PreviewKind, { bg: string; icon: string; symbol: string }> = {
    image: { bg: "#0d1f1c", icon: "#34d399", symbol: "▧" },
    video: { bg: "#101626", icon: "#38bdf8", symbol: "▶" },
    music: { bg: "#1b182b", icon: "#e879f9", symbol: "♫" },
    file: { bg: "#1c182b", icon: "#a78bfa", symbol: "▤" },
  };
  const config = fallbackColors[kind];
  context.fillStyle = config.bg;
  context.fillRect(0, 0, width, height);

  context.fillStyle = config.icon;
  const iconSize = Math.min(width, height) * 0.42;
  context.font = `bold ${Math.round(iconSize)}px Segoe UI Symbol, Segoe UI, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(config.symbol, width / 2, height / 2);
}

/**
 * Genera una tarjeta de vista previa compacta y nítida en formato PNG para el arrastre OLE del SO.
 * Respeta rigurosamente las proporciones:
 * - Música: Siempre cuadrada (184x184).
 * - Vídeos/Imágenes: Cuadrada (184x184), Panorámica (224x126) o Vertical (126x224).
 * - Utiliza escalado cover sin bandas negras vacías y esquinas redondeadas Material 3 Expressive.
 */
export function createNativeDragPreview(
  path: string,
  element?: Element | null,
  count = 1
): string | null {
  if (typeof document === "undefined") return null;

  try {
    const kind = nativeDragPreviewKind(path);
    const media = readyMedia(element ?? null, path);
    const mediaWidth = media instanceof HTMLImageElement ? media.naturalWidth : media?.videoWidth ?? 0;
    const mediaHeight = media instanceof HTMLImageElement ? media.naturalHeight : media?.videoHeight ?? 0;

    const layout = nativeDragPreviewLayout(mediaWidth, mediaHeight, kind);

    const canvas = document.createElement("canvas");
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    // 1. Fondo base de la tarjeta redondeada
    context.fillStyle = "#12131e";
    drawRoundedRect(context, 0, 0, layout.width, layout.height, CARD_RADIUS);
    context.fill();

    // 2. Contenido de imagen o fallback
    if (media && mediaWidth > 0 && mediaHeight > 0) {
      try {
        context.save();
        drawRoundedRect(
          context,
          BORDER_WIDTH,
          BORDER_WIDTH,
          layout.width - BORDER_WIDTH * 2,
          layout.height - BORDER_WIDTH * 2,
          CARD_RADIUS - 1
        );
        context.clip();
        fillImageCover(context, media, mediaWidth, mediaHeight, layout);
        context.restore();

        // 3. Distintivo sutil sobre la imagen
        drawMediaBadge(context, kind, layout);
      } catch {
        context.restore();
        drawFallback(context, kind, layout);
      }
    } else {
      drawFallback(context, kind, layout);
    }

    // 4. Borde exterior elegante (Material 3 Expressive) que garantiza visibilidad sobre cualquier ventana
    context.strokeStyle = "rgba(255, 255, 255, 0.24)";
    context.lineWidth = BORDER_WIDTH;
    drawRoundedRect(
      context,
      BORDER_WIDTH / 2,
      BORDER_WIDTH / 2,
      layout.width - BORDER_WIDTH,
      layout.height - BORDER_WIDTH,
      CARD_RADIUS
    );
    context.stroke();

    // 5. Pastilla de selección múltiple (si se arrastra más de 1 archivo)
    if (count > 1) {
      const badgeX = layout.width - 20;
      const badgeY = 20;
      const badgeR = 15;

      context.save();
      context.fillStyle = "#f43f5e"; // Rose intenso
      context.beginPath();
      context.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = "#ffffff";
      context.lineWidth = 1.5;
      context.stroke();

      context.fillStyle = "#ffffff";
      context.font = "bold 13px Segoe UI, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(count > 99 ? "99+" : `+${count}`, badgeX, badgeY + 0.5);
      context.restore();
    }

    try {
      return canvas.toDataURL("image/png");
    } catch {
      // Si por alguna razón el canvas fue contaminado por un recurso remoto no marcado,
      // generar de inmediato un lienzo limpio con el fallback vectorial correspondiente.
      const safeCanvas = document.createElement("canvas");
      safeCanvas.width = layout.width;
      safeCanvas.height = layout.height;
      const safeContext = safeCanvas.getContext("2d");
      if (!safeContext) return null;

      safeContext.fillStyle = "#12131e";
      drawRoundedRect(safeContext, 0, 0, layout.width, layout.height, CARD_RADIUS);
      safeContext.fill();

      drawFallback(safeContext, kind, layout);

      safeContext.strokeStyle = "rgba(255, 255, 255, 0.24)";
      safeContext.lineWidth = BORDER_WIDTH;
      drawRoundedRect(
        safeContext,
        BORDER_WIDTH / 2,
        BORDER_WIDTH / 2,
        layout.width - BORDER_WIDTH,
        layout.height - BORDER_WIDTH,
        CARD_RADIUS
      );
      safeContext.stroke();

      return safeCanvas.toDataURL("image/png");
    }
  } catch {
    return null;
  }
}
