import type { AnnotationTool, CaptureMode } from "./types";

export const ANNOTATION_KEYS: Partial<Record<AnnotationTool, string>> = {
  pen: "B", highlighter: "R", text: "T", rect: "S", ellipse: "C", arrow: "F",
};

export const CAPTURE_PALETTE = [
  { color: "#00C9B9", name: "Turquesa Prisma" },
  { color: "#FF5252", name: "Rojo" },
  { color: "#FFD600", name: "Amarillo" },
  { color: "#4CAF50", name: "Verde" },
  { color: "#2196F3", name: "Azul" },
  { color: "#FFFFFF", name: "Blanco" },
  { color: "#212121", name: "Negro" },
];
export const CAPTURE_STROKE_WIDTHS = [2, 4, 8];

type AnnotationShortcut = { tool: AnnotationTool } | { color: string } | { strokeWidth: number } | { action: "retry" | "clear" };

export function annotationShortcut(event: Pick<KeyboardEvent, "key" | "code" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey">): AnnotationShortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(event.code)?.[1] ?? (/^\d$/.test(event.key) ? event.key : null);
  if (digit) {
    const index = Number(digit) - 1;
    if (event.shiftKey) {
      const strokeWidth = CAPTURE_STROKE_WIDTHS[index];
      return strokeWidth === undefined ? null : { strokeWidth };
    }
    const swatch = CAPTURE_PALETTE[index];
    return swatch ? { color: swatch.color } : null;
  }
  if (event.shiftKey) return null;
  const key = event.key.toUpperCase();
  const tool = (Object.entries(ANNOTATION_KEYS) as Array<[AnnotationTool, string]>).find(([, shortcut]) => shortcut === key)?.[0];
  if (tool) return { tool };
  if (key === "N") return { action: "retry" };
  if (event.key === "Delete") return { action: "clear" };
  return null;
}

const LAST_MODE_KEY = "prisma.screen-capture.last-mode";
const IMAGE_MODES: CaptureMode[] = ["window", "rect", "fullscreen", "freeform"];

export function lastCaptureMode(fallback: CaptureMode = "window"): CaptureMode {
  try {
    const saved = localStorage.getItem(LAST_MODE_KEY) as CaptureMode | null;
    if (saved && IMAGE_MODES.includes(saved)) return saved;
  } catch { /* La captura también funciona sin almacenamiento disponible. */ }
  return fallback;
}

export function rememberCaptureMode(mode: CaptureMode): void {
  if (!IMAGE_MODES.includes(mode)) return;
  try { localStorage.setItem(LAST_MODE_KEY, mode); } catch { /* Preferencia opcional. */ }
}
