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
  /** HWND nativo de la ventana, usado para detectar controles internos. */
  hwnd?: number;
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
  /** Identificador monótono: permite descartar sesiones obsoletas. */
  sessionId: number;
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
  /** Atajo realmente registrado en el sistema operativo. */
  shortcut: string;
  /** Atajo solicitado por el usuario. */
  requestedShortcut: string;
  /** El atajo global está habilitado. */
  enabled: boolean;
  /** El sistema aceptó un atajo y está activo. */
  isRegistered: boolean;
  /** Motivo por el que el atajo solicitado no pudo activarse. */
  error?: string | null;
  /** Ya existe una preferencia guardada. */
  hasStoredPreference?: boolean;
}

export type AnnotationTool = "select" | "pen" | "highlighter" | "rect" | "ellipse" | "arrow" | "text" | "eyedropper";

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
