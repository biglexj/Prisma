export type CaptureMode = "window" | "rect" | "fullscreen" | "freeform" | "eyedropper";

export interface DetectedTarget {
  id: string;
  title: string;
  className: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isChild?: boolean;
}

export interface MonitorTarget {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPrimary: boolean;
}

export interface CaptureSessionInit {
  virtualX: number;
  virtualY: number;
  virtualWidth: number;
  virtualHeight: number;
  targets: DetectedTarget[];
  monitors: MonitorTarget[];
  defaultMode: CaptureMode;
}

export interface EditorPayload {
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
  x: number;
  y: number;
}

export interface RectSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenCaptureShortcutStatus {
  shortcut: string;
  isRegistered: boolean;
  error?: string | null;
}

export type AnnotationTool = "select" | "pen" | "highlighter" | "rect" | "arrow" | "text" | "eyedropper";

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationItem {
  id: string;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  points?: AnnotationPoint[];
  rect?: { x: number; y: number; width: number; height: number };
  startPoint?: AnnotationPoint;
  endPoint?: AnnotationPoint;
  text?: string;
  fontSize?: number;
}

export interface ActiveTextBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  color: string;
}
