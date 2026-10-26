export type CaptureMode = "window" | "rect" | "fullscreen" | "freeform" | "eyedropper";

/** Intención de la sesión de captura: imagen puntual o grabación de vídeo. */
export type CaptureIntent = "image" | "video";

/** Región de pantalla a grabar, en coordenadas físicas del escritorio virtual. */
export interface RecordingRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Parámetros de una grabación. */
export interface RecordingOptions {
  region: RecordingRegion;
  fps?: number;
  audioDevice?: string | null;
  outputFolder?: string | null;
  encoder?: "auto" | "cpu" | "nvenc" | "qsv" | "amf";
  quality?: "high" | "medium" | "low";
  maxHeight?: number | null;
  systemAudio?: boolean;
  /** Contenedor del vídeo grabado: `mp4`, `mkv` o `mov`. */
  container?: "mp4" | "mkv" | "mov";
  /** Nombre de la ventana seleccionada; se graba su región visible. */
  windowTitle?: string | null;
}

/** Estado de la grabadora difundo por el backend. */
export interface RecordingInfo {
  status: "recording" | "finished" | "idle" | "error";
  outputPath: string;
  startedAtMs: number;
  elapsedMs: number;
  region: RecordingRegion;
  fps: number;
  width: number;
  height: number;
  /** `true` cuando la grabación está en pausa. */
  paused?: boolean;
  error?: string | null;
}

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
  /** `image` para captura puntual, `video` para preparar una grabación. */
  intent: CaptureIntent;
  /** Fotograma inicial; null durante la preparación de vídeo. */
  snapshotDataUrl: string | null;
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
