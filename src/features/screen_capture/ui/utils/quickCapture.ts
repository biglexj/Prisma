import type {
  AnnotationPoint,
  CaptureMode,
  DetectedTarget,
  EditorPayload,
  MonitorTarget,
  RectSelection,
} from "../../model/types";

/**
 * Contexto de la fase de selección: qué hay resaltado ahora mismo en pantalla.
 * Se lee de referencias para no depender del ciclo de render de React.
 */
export interface SelectionContext {
  mode: CaptureMode;
  /** Rectángulo arrastrado en el modo Rectángulo. */
  selectionRect: RectSelection | null;
  /** Ventana bajo el cursor en el modo Ventana. */
  activeTarget: DetectedTarget | null;
  /** Control interno detectado dentro de la ventana activa. */
  subregionTarget: DetectedTarget | null;
  /** `true` cuando el usuario alternó a la subregión con Tab o la rueda. */
  useSubregion: boolean;
  /** Monitor resaltado en el modo Pantalla completa. */
  activeMonitor: MonitorTarget | null;
  /** Monitores de la sesión, usados como respaldo. */
  monitors: MonitorTarget[];
  /** Trazo del lazo libre en el modo Forma libre. */
  lassoPoints: AnnotationPoint[];
}

/** Selección lista para capturar. */
export interface QuickSelection {
  rect: RectSelection;
  /** Polígono del lazo en coordenadas relativas al rectángulo capturado. */
  clipPolygon?: AnnotationPoint[];
}

/** Un lazo necesita vértices suficientes y un tamaño con sentido. */
export const LASSO_MIN_POINTS = 6;
export const LASSO_MIN_SIZE = 16;
/** Un rectángulo arrastrado más pequeño que esto se considera un clic accidental. */
export const RECT_MIN_SIZE = 10;

/**
 * Traduce el lazo libre a su rectángulo y su polígono de recorte.
 * Devuelve `null` si el trazo no es una forma utilizable.
 */
export function lassoSelection(points: AnnotationPoint[]): QuickSelection | null {
  if (points.length < LASSO_MIN_POINTS) return null;
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const width = maxX - minX;
  const height = maxY - minY;
  if (width < LASSO_MIN_SIZE || height < LASSO_MIN_SIZE) return null;
  return {
    rect: { x: minX, y: minY, width, height },
    clipPolygon: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
  };
}

/**
 * Resuelve la selección activa de la fase de selección.
 *
 * Es la fuente única de verdad: tanto Enter (abrir la edición) como Ctrl+C
 * (copiar al instante) parten del mismo rectángulo, de modo que nunca capturan
 * zonas distintas.
 */
export function resolveSelection(context: SelectionContext): QuickSelection | null {
  switch (context.mode) {
    case "window": {
      const target = context.useSubregion && context.subregionTarget
        ? context.subregionTarget
        : context.activeTarget;
      if (!target || target.width <= 0 || target.height <= 0) return null;
      return {
        rect: { x: target.x, y: target.y, width: target.width, height: target.height },
      };
    }
    case "rect": {
      const rect = context.selectionRect;
      if (!rect || rect.width < RECT_MIN_SIZE || rect.height < RECT_MIN_SIZE) return null;
      return { rect: { ...rect } };
    }
    case "fullscreen": {
      const monitor = context.activeMonitor ?? context.monitors[0];
      if (!monitor) return null;
      return {
        rect: { x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height },
      };
    }
    case "freeform":
      return lassoSelection(context.lassoPoints);
    default:
      // El selector de color no produce una imagen: no hay nada que capturar.
      return null;
  }
}

/** Convierte un data URL PNG en un blob binario, sin pasar por el lienzo. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const separator = dataUrl.indexOf(",");
  const header = separator >= 0 ? dataUrl.slice(0, separator) : "";
  const base64 = separator >= 0 ? dataUrl.slice(separator + 1) : dataUrl;
  const mime = /data:([^;,]+)/.exec(header)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo cargar la captura"));
    image.src = source;
  });
}

/** Recorta la captura al polígono del lazo y devuelve el resultado como PNG. */
async function clipPayloadToBlob(
  payload: EditorPayload,
  polygon: AnnotationPoint[]
): Promise<Blob> {
  const image = await loadImage(payload.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = payload.width;
  canvas.height = payload.height;
  const context = canvas.getContext("2d");
  if (!context) return dataUrlToBlob(payload.dataUrl);

  context.save();
  context.beginPath();
  context.moveTo(polygon[0].x, polygon[0].y);
  for (let index = 1; index < polygon.length; index += 1) {
    context.lineTo(polygon[index].x, polygon[index].y);
  }
  context.closePath();
  context.clip();
  context.drawImage(image, 0, 0, payload.width, payload.height);
  context.restore();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo exportar la captura"));
    }, "image/png");
  });
}

/**
 * Prepara el blob que se copiará al portapapeles.
 * Sin polígono la captura travels tal cual; con polígono se recorta al lazo.
 */
export async function payloadToBlob(
  payload: EditorPayload,
  clipPolygon?: AnnotationPoint[]
): Promise<Blob> {
  if (!clipPolygon || clipPolygon.length <= 2) return dataUrlToBlob(payload.dataUrl);
  return await clipPayloadToBlob(payload, clipPolygon);
}
