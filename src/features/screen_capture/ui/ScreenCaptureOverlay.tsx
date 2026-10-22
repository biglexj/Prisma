import { getCaptureFormat } from "../../../shared/captureFormat";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { latestTargetQuery } from "../model/latestTargetQuery";
import { CapturePointer } from "../model/pointerCapture";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { save } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../shared/ui/Icon";
import { CaptureAnnotationBar } from "./components/CaptureAnnotationBar";
import { drawAnnotation } from "./utils/annotationDrawing";
import { annotationShapeRect } from "./utils/annotationGeometry";
import { annotationShortcut, lastCaptureMode, rememberCaptureMode } from "../model/captureControls";
import { loadRecordingPreferences, resolveRecordingFolder } from "../model/recordingSettings";
import { getDefaultPicturesDir } from "../../../shared/mediaOperations";
import type {
  ActiveTextBox,
  AnnotationItem,
  AnnotationPoint,
  AnnotationTool,
  CaptureMode,
  CaptureSessionInit,
  DetectedTarget,
  EditorPayload,
  MonitorTarget,
  RectSelection,
} from "../model/types";
import { screenCaptureClient } from "../services/screenCaptureClient";
import { captureDiagnostics } from "../services/captureDiagnostics";
import "./screen-capture.css";

const MODE_LABELS: Record<CaptureMode, string> = {
  rect: "Rectángulo",
  window: "Ventana",
  fullscreen: "Pantalla completa",
  freeform: "Forma libre",
  eyedropper: "Selector de color",
};

const MODE_ICONS: Record<CaptureMode, any> = {
  rect: "crop",
  window: "columns",
  fullscreen: "fullscreen",
  freeform: "lasso",
  eyedropper: "pipette",
};

const MODE_OPTIONS: Array<{ id: CaptureMode; label: string; icon: any; shortcut: string }> = [
  { id: "rect", label: "Rectángulo", icon: "crop", shortcut: "R" },
  { id: "window", label: "Ventana", icon: "columns", shortcut: "V" },
  { id: "fullscreen", label: "Pantalla completa", icon: "fullscreen", shortcut: "F" },
  { id: "freeform", label: "Forma libre", icon: "lasso", shortcut: "Q" },
];

export function ScreenCaptureOverlay() {
  const [session, setSession] = useState<CaptureSessionInit | null>(null);
  const [phase, setPhase] = useState<"selecting" | "annotating">("selecting");
  const [mode, setMode] = useState<CaptureMode>(() => lastCaptureMode());
  const [activeTarget, setActiveTarget] = useState<DetectedTarget | null>(null);
  const [subregionTarget, setSubregionTarget] = useState<DetectedTarget | null>(null);
  const [useSubregion, setUseSubregion] = useState(false);
  const [activeMonitor, setActiveMonitor] = useState<MonitorTarget | null>(null);

  // Estados para modo Rectángulo en fase de selección
  const [isDragging, setIsDragging] = useState(false);
  const [selectionRect, setSelectionRect] = useState<RectSelection | null>(null);


  // Estados para modo Lazo Libre (mano alzada)
  const [lassoPoints, setLassoPoints] = useState<AnnotationPoint[]>([]);
  const [lassoClipPolygon, setLassoClipPolygon] = useState<AnnotationPoint[] | null>(null);

  // Selector de color / Cuentagotas y retroalimentación Toast
  const [hoveredColor, setHoveredColor] = useState<{ hex: string; rgb: string; x: number; y: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Cuenta atrás antes de empezar a grabar (3, 2, 1).
  const [countdown, setCountdown] = useState<number | null>(null);

  // Cuadro de texto interactivo in-situ (elegir marco de texto arrastrando o clic)
  const [activeTextBox, setActiveTextBox] = useState<ActiveTextBox | null>(null);
  const dragTextBoxRef = useRef<{ startX: number; startY: number } | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // Las anotaciones se reinician; el último modo confirmado se conserva.
  const handleSetMode = useCallback((newMode: CaptureMode) => {
    targetQuery.cancel();
    ++confirmRevisionRef.current;
    modeRef.current = newMode;
    resetPointerGestures();
    dragStateRef.current = { active: false, start: null };
    setIsDragging(false);
    lassoPointsRef.current = [];
    setMode(newMode);
    if (newMode !== "rect") {
      setSelectionRect(null);
    }
    if (newMode !== "freeform") {
      setLassoPoints([]);
    }
  }, []);

  // Referencias para redimensionamiento y desplazamiento sin pérdida de puntero
  const resizeRef = useRef<{
    handle: string;
    startScreenX: number;
    startScreenY: number;
    startRect: RectSelection;
  } | null>(null);
  const dragMoveRef = useRef<{
    startScreenX: number;
    startScreenY: number;
    startRect: RectSelection;
  } | null>(null);

  // ── Estados de Anotación In-Situ (en el lugar exacto de captura) ──
  const [annotatingPayload, setAnnotatingPayload] = useState<EditorPayload | null>(null);
  const [canvasRect, setCanvasRect] = useState<RectSelection | null>(null);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("pen");
  const [activeColor, setActiveColor] = useState<string>("#00C9B9");
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<AnnotationItem | null>(null);

  // Referencias para estabilidad de eventos y closures
  const sessionRef = useRef<CaptureSessionInit | null>(null);
  sessionRef.current = session;
  const modeRef = useRef<CaptureMode>(mode);
  modeRef.current = mode;
  const phaseRef = useRef<"selecting" | "annotating">(phase);
  phaseRef.current = phase;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const activeTargetRef = useRef(activeTarget);
  activeTargetRef.current = activeTarget;
  const subregionTargetRef = useRef(subregionTarget);
  subregionTargetRef.current = subregionTarget;
  const useSubregionRef = useRef(useSubregion);
  useSubregionRef.current = useSubregion;
  const activeMonitorRef = useRef(activeMonitor);
  activeMonitorRef.current = activeMonitor;
  const selectionRectRef = useRef(selectionRect);
  selectionRectRef.current = selectionRect;
  // Estado inmediato del arrastre. El lápiz de una tableta gráfica genera eventos a
  // mucha más frecuencia que un ratón: entre el último `pointermove` y el `pointerup`
  // React puede no haber re-renderizado todavía, de modo que leer el estado (closure)
  // devolvería valores obsoletos y el rectángulo nunca llegaría a confirmarse.
  const dragStateRef = useRef<{ active: boolean; start: { x: number; y: number } | null }>({
    active: false,
    start: null,
  });
  const lassoPointsRef = useRef<AnnotationPoint[]>([]);
  const selectionPointer = useRef(new CapturePointer()).current;
  const canvasPointer = useRef(new CapturePointer()).current;
  const currentAnnotationRef = useRef<AnnotationItem | null>(null);
  const confirmRevisionRef = useRef(0);
  const diagnosticState = useRef<(id?: number) => Record<string, unknown>>(() => ({}));
  diagnosticState.current = (id) => ({
    session: sessionRef.current?.sessionId, phase: phaseRef.current, mode: modeRef.current,
    tool: activeTool, color: activeColor, history: historyIndex, annotations: annotations.length,
    points: currentAnnotationRef.current?.points?.length ?? 0,
    selectionContact: id !== undefined && selectionPointer.matches(id),
    canvasContact: id !== undefined && canvasPointer.matches(id),
  });
  useEffect(() => captureDiagnostics((id) => diagnosticState.current(id)), []);
  const resetPointerGestures = useCallback(() => {
    selectionPointer.release();
    canvasPointer.release();
    currentAnnotationRef.current = null;
    dragStateRef.current = { active: false, start: null };
    lassoPointsRef.current = [];
    dragTextBoxRef.current = null;
    resizeRef.current = null;
    dragMoveRef.current = null;
    setIsDrawing(false);
    setIsDragging(false);
    setCurrentAnnotation(null);
    if (phaseRef.current === "selecting") {
      selectionRectRef.current = null;
      setSelectionRect(null);
      setLassoPoints([]);
    }
  }, [selectionPointer, canvasPointer]);

  useEffect(() => {
    window.addEventListener("blur", resetPointerGestures);
    return () => {
      window.removeEventListener("blur", resetPointerGestures);
      selectionPointer.release();
      canvasPointer.release();
    };
  }, [resetPointerGestures, selectionPointer, canvasPointer]);

  const targetQuery = useMemo(() => latestTargetQuery(
    async (x, y) => {
      const target = await screenCaptureClient.detectWindowAt(x, y);
      const sub = target?.hwnd
        ? await screenCaptureClient.detectSubregion(target.hwnd, x, y)
        : null;
      return { target, sub };
    },
    ({ target, sub }) => {
      if (phaseRef.current !== "selecting" || modeRef.current !== "window") return;
      activeTargetRef.current = target;
      setActiveTarget(target);
      const region = target && sub && sub.width < target.width && sub.height < target.height ? sub : null;
      subregionTargetRef.current = region;
      setSubregionTarget(region);
    },
  ), []);
  useEffect(() => () => targetQuery.cancel(), [targetQuery]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const clearAnnotationSurface = useCallback(() => {
    bgImageRef.current = null;
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setAnnotatingPayload(null);
    setCanvasRect(null);
    setAnnotations([]);
    setHistoryIndex(-1);
    setActiveTextBox(null);
    setCurrentAnnotation(null);
    currentAnnotationRef.current = null;
  }, []);

  const clearCaptureView = useCallback(() => {
    targetQuery.cancel();
    ++confirmRevisionRef.current;
    resetPointerGestures();
    clearAnnotationSurface();
    sessionRef.current = null;
    phaseRef.current = "selecting";
    setSession(null);
    setPhase("selecting");
    setSelectionRect(null);
    setLassoPoints([]);
    setLassoClipPolygon(null);
    setHoveredColor(null);
  }, [targetQuery, resetPointerGestures, clearAnnotationSurface]);

  // Aplicar una sesión de captura. Las sesiones obsoletas se descartan: el overlay
  // puede recibir varias señales (evento + resincronización) y solo la última manda.
  const appliedSessionIdRef = useRef(0);
  const applySession = useCallback((payload: CaptureSessionInit) => {
    const sessionId = payload.sessionId ?? 0;
    if (sessionId && sessionId <= appliedSessionIdRef.current) return;
    if (sessionId) appliedSessionIdRef.current = sessionId;

    targetQuery.cancel();
    ++confirmRevisionRef.current;
    resetPointerGestures();
    clearAnnotationSurface();
    phaseRef.current = "selecting";
    // El lazo libre no existe en una sesión de vídeo: se arranca en Ventana.
    const restoredMode = lastCaptureMode(payload.defaultMode || "window");
    const initialMode =
      payload.intent === "video" && restoredMode === "freeform" ? "window" : restoredMode;
    modeRef.current = initialMode;

    sessionRef.current = payload;
    setSession(payload);
    setPhase("selecting");
    setMode(initialMode);
    setActiveTool("pen");
    setActiveColor("#00C9B9");
    setStrokeWidth(4);
    setActiveTextBox(null);
    setIsDrawing(false);
    setIsDragging(false);
    dragStateRef.current = { active: false, start: null };
    lassoPointsRef.current = [];
    setHoveredColor(null);
    setToastMessage(null);
    dragTextBoxRef.current = null;
    resizeRef.current = null;
    dragMoveRef.current = null;
    // Sin selección previa: el objetivo se determina al mover el cursor, de modo que
    // nunca quede preseleccionada una ventana del sistema (barra de tareas, escritorio).
    activeTargetRef.current = null;
    subregionTargetRef.current = null;
    setActiveTarget(null);
    if (payload.monitors && payload.monitors.length > 0) {
      setActiveMonitor(payload.monitors[0]);
    } else {
      setActiveMonitor(null);
    }
    setSubregionTarget(null);
    setUseSubregion(false);
    setSelectionRect(null);
    setLassoPoints([]);
    setLassoClipPolygon(null);
    setAnnotatingPayload(null);
    setCanvasRect(null);
    setAnnotations([]);
    setHistoryIndex(-1);
    setCurrentAnnotation(null);
  }, []);

  // El backend mantiene el overlay oculto hasta que React haya limpiado la sesión anterior.
  useEffect(() => {
    if (session) void screenCaptureClient.overlayReady(session.sessionId).catch(() => {});
  }, [session]);

  useEffect(() => {
    const unlisten = listen<number | null>("screen_capture://session-ended", ({ payload }) => {
      if (payload !== null && payload === sessionRef.current?.sessionId) clearCaptureView();
    });
    return () => { void unlisten.then((stop) => stop()); };
  }, [clearCaptureView]);

  // Escuchar inicio de sesión desde Rust o hotkey global
  useEffect(() => {
    const unlistenPromise = listen<CaptureSessionInit>(
      "screen_capture://session-started",
      (event) => {
        if (event.payload) applySession(event.payload);
      }
    );

    // Respaldo: si el evento no llega (overlay oculto, webview pausada), la sesión
    // vigente se recupera del backend al montar y al recuperar el foco.
    const syncSession = async () => {
      try {
        const current = await screenCaptureClient.getSession();
        if (current) applySession(current);
      } catch {
        // Sin sesión disponible todavía.
      }
    };

    void syncSession();

    let disposed = false;
    let focusUnlisten: (() => void) | null = null;
    void getCurrentWebviewWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (disposed) return;
        if (focused) void syncSession();
        else resetPointerGestures();
      })
      .then((unlisten) => {
        focusUnlisten = unlisten;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (focusUnlisten) focusUnlisten();
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [applySession, resetPointerGestures]);

  // Cancelar captura completa
  const handleCancel = useCallback(async () => {
    clearCaptureView();
    try {
      await screenCaptureClient.cancelCapture();
    } catch {
      // Silencio intencional
    }
  }, []);

  // Iniciar la grabación de la región confirmada.
  // El backend aparta el overlay antes de capturar: si el overlay siguiera
  // visible, aparecería dentro del vídeo grabado.
  const handleStartRecording = useCallback(async (rect: RectSelection) => {
    targetQuery.cancel();
    ++confirmRevisionRef.current;
    setToastMessage("Iniciando la grabación…");
    try {
      // Cuenta atrás como en Recortes: el overlay sigue visible y avisa antes
      // de que la grabación arranque, para que el gesto quede fuera del vídeo.
      for (let remaining = 3; remaining > 0; remaining -= 1) {
        setCountdown(remaining);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCountdown(null);

      const preferences = loadRecordingPreferences();
      const outputFolder = await resolveRecordingFolder();
      await screenCaptureClient.startRecording({
        region: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        fps: preferences.fps,
        audioDevice: preferences.audioDevice,
        outputFolder,
        encoder: preferences.encoder,
        quality: preferences.quality,
        maxHeight: preferences.maxHeight,
        systemAudio: preferences.systemAudio,
      });
      await handleCancel();
    } catch (err) {
      console.error("Error al iniciar la grabación:", err);
      setToastMessage(`No se pudo iniciar la grabación: ${String(err)}`);
      setTimeout(() => setToastMessage(null), 5000);
    }
  }, [handleCancel]);

  // Confirmar recorte y pasar a anotación IN-SITU (sin abrir otra ventana)
  const handleConfirmToAnnotate = useCallback(async (rect: RectSelection, clipPolygon?: AnnotationPoint[], previousRect?: RectSelection) => {
    if (rect.width <= 4 || rect.height <= 4) return;
    // En una sesión de vídeo, confirmar la región significa «grabar aquí».
    if (sessionRef.current?.intent === "video") {
      await handleStartRecording(rect);
      return;
    }
    const sessionId = sessionRef.current?.sessionId;
    const revision = ++confirmRevisionRef.current;
    targetQuery.cancel();
    try {
      const payload = await screenCaptureClient.confirmCapture(rect);
      if (!sessionRef.current || sessionRef.current.sessionId !== sessionId || revision !== confirmRevisionRef.current) return;
      if (payload) {
        resetPointerGestures();
        bgImageRef.current = null;
        phaseRef.current = "annotating";
        rememberCaptureMode(modeRef.current);
        setSelectionRect(null);
        setActiveTextBox(null);
        setIsDrawing(false);
        setLassoClipPolygon(clipPolygon ?? null);
        setAnnotatingPayload(payload);
        setPhase("annotating");
        if (previousRect) {
          const dx = previousRect.x - payload.x;
          const dy = previousRect.y - payload.y;
          const shift = (p: AnnotationPoint) => ({ x: p.x + dx, y: p.y + dy });
          setAnnotations((items) => items.map((item) => ({
            ...item,
            points: item.points?.map(shift),
            startPoint: item.startPoint ? shift(item.startPoint) : undefined,
            endPoint: item.endPoint ? shift(item.endPoint) : undefined,
            rect: item.rect ? { ...item.rect, x: item.rect.x + dx, y: item.rect.y + dy } : undefined,
          })));
        } else {
          setAnnotations([]);
          setHistoryIndex(-1);
        }
        setCurrentAnnotation(null);
      }
    } catch (err) {
      if (revision !== confirmRevisionRef.current) return;
      setSelectionRect(null);
      console.error("Error al confirmar captura in-situ:", err);
    }
  }, []);

  // Volver a la fase de selección
  const handleRetrySelection = useCallback(() => {
    phaseRef.current = "selecting";
    ++confirmRevisionRef.current;
    resetPointerGestures();
    clearAnnotationSurface();
    setPhase("selecting");
    setActiveTextBox(null);
    setActiveTool("pen");
    setIsDrawing(false);
    setSelectionRect(null);
    setAnnotatingPayload(null);
    setCanvasRect(null);
    setLassoClipPolygon(null);
    setLassoPoints([]);
    setAnnotations([]);
    setHistoryIndex(-1);
    setCurrentAnnotation(null);
  }, []);

  // Copiar imagen final al portapapeles sin tocar disco y cerrar
  const handleCopy = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const revision = confirmRevisionRef.current;

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });

      if (!blob) throw new Error("No se pudo exportar lienzo a PNG");

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);

      if (sessionRef.current && confirmRevisionRef.current === revision) await handleCancel();
    } catch (err) {
      console.error("Error al copiar al portapapeles:", err);
    }
  }, []);

  // Guardar en el formato global sin pedir ruta cada vez
  const handleSaveAs = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const revision = confirmRevisionRef.current;
    const captureFormat = getCaptureFormat();

    try {
      let targetFolder = "";
      try {
        const stored = localStorage.getItem("prisma.system-settings.v1");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.screenCaptureFolder && typeof parsed.screenCaptureFolder === "string" && parsed.screenCaptureFolder.trim()) {
            targetFolder = parsed.screenCaptureFolder.trim();
          }
        }
      } catch {}

      if (!targetFolder) {
        try {
          const picturesDir = await getDefaultPicturesDir();
          if (picturesDir) {
            targetFolder = `${picturesDir}\\Capturas`;
          }
        } catch {}
      }

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      const defaultFilename = `Prisma_Captura_${dateStr}.${captureFormat.extension}`;

      const finalFolder = targetFolder || "C:\\Capturas";
      const fullPath = `${finalFolder}\\${defaultFilename}`;

      const dataUrl = canvas.toDataURL("image/png");
      if (!sessionRef.current || confirmRevisionRef.current !== revision) return;
      await screenCaptureClient.saveFile(fullPath, dataUrl, captureFormat.id);

      if (!sessionRef.current || confirmRevisionRef.current !== revision) return;
      setToastMessage(`Guardado en Capturas: ${defaultFilename}`);
      setTimeout(() => {
        if (sessionRef.current && confirmRevisionRef.current === revision) void handleCancel();
      }, 350);
    } catch (err) {
      if (!sessionRef.current || confirmRevisionRef.current !== revision) return;
      console.error("Error al guardar captura automáticamente:", err);
      try {
        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const defaultFilename = `Prisma_Captura_${dateStr}.${captureFormat.extension}`;
        const chosenPath = await save({
          title: "Guardar captura de pantalla",
          defaultPath: defaultFilename,
          filters: [{ name: `Imagen ${captureFormat.label}`, extensions: [captureFormat.extension] }],
        });
        if (chosenPath && sessionRef.current && confirmRevisionRef.current === revision) {
          const dataUrl = canvas.toDataURL("image/png");
          await screenCaptureClient.saveFile(chosenPath, dataUrl, captureFormat.id);
          if (sessionRef.current && confirmRevisionRef.current === revision) await handleCancel();
        }
      } catch {}
    }
  }, []);

  // Gestión de deshacer y rehacer anotaciones
  const handleUndo = useCallback(() => {
    setHistoryIndex((prev) => (prev >= 0 ? prev - 1 : -1));
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryIndex((prev) => {
      if (prev < annotationsRef.current.length - 1) {
        return prev + 1;
      }
      return prev;
    });
  }, []);

  const commitAnnotation = useCallback((item: AnnotationItem) => {
    setAnnotations((prev) => {
      const next = [...prev.slice(0, historyIndex + 1), item];
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [historyIndex]);

  const handleConfirmTextBox = useCallback(() => {
    if (!activeTextBox) return;
    const text = activeTextBox.text.trim();
    if (text) {
      const fontSize = activeTextBox.fontSize || Math.max(14, strokeWidth * 4 + 10);
      const newTextItem: AnnotationItem = {
        id: Math.random().toString(36).slice(2),
        tool: "text",
        color: activeTextBox.color,
        strokeWidth,
        startPoint: { x: activeTextBox.x, y: activeTextBox.y + fontSize },
        text,
        fontSize,
        rect: {
          x: activeTextBox.x,
          y: activeTextBox.y,
          width: Math.max(120, activeTextBox.width),
          height: Math.max(40, activeTextBox.height),
        },
      };
      commitAnnotation(newTextItem);
    }
    setActiveTextBox(null);
  }, [activeTextBox, strokeWidth, commitAnnotation]);

  const handleCancelTextBox = useCallback(() => {
    setActiveTextBox(null);
  }, []);

  const handleClearAnnotations = useCallback(() => {
    setAnnotations([]);
    setHistoryIndex(-1);
  }, []);

  // Manejo de atajos globales dentro de la capa
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const code = e.code;

      if (e.isComposing) return;
      if (activeTextBox) {
        if (e.key === "Escape") {
          e.preventDefault();
          handleCancelTextBox();
        }
        return;
      }
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;

      if (phaseRef.current === "selecting") {
        if (e.key === "Escape") {
          e.preventDefault();
          void handleCancel();
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (modeRef.current === "window") {
            const target = (useSubregionRef.current && subregionTargetRef.current)
              ? subregionTargetRef.current
              : activeTargetRef.current;
            if (target) {
              void handleConfirmToAnnotate({
                x: target.x,
                y: target.y,
                width: target.width,
                height: target.height,
              });
            }
          } else if (modeRef.current === "rect") {
            if (selectionRectRef.current) {
              void handleConfirmToAnnotate(selectionRectRef.current);
            }
          } else if (modeRef.current === "fullscreen") {
            const mon = activeMonitorRef.current || sessionRef.current?.monitors?.[0];
            if (mon) {
              void handleConfirmToAnnotate({
                x: mon.x,
                y: mon.y,
                width: mon.width,
                height: mon.height,
              });
            }
          }
        } else if (!isCtrl && !e.altKey) {
          if (key === "v" || code === "KeyV") {
            e.preventDefault();
            handleSetMode("window");
          } else if (key === "r" || code === "KeyR") {
            e.preventDefault();
            handleSetMode("rect");
          } else if ((key === "q" || code === "KeyQ") && sessionRef.current?.intent !== "video") {
            e.preventDefault();
            handleSetMode("freeform");
          } else if (key === "f" || code === "KeyF") {
            e.preventDefault();
            handleSetMode("fullscreen");
            const mon = activeMonitorRef.current || sessionRef.current?.monitors?.[0];
            if (mon) {
              void handleConfirmToAnnotate({
                x: mon.x,
                y: mon.y,
                width: mon.width,
                height: mon.height,
              });
            }
          } else if ((key === "c" || code === "KeyC") && sessionRef.current?.intent !== "video") {
            // Atajo oficial solicitado para Selector de Color en fase 1
            e.preventDefault();
            handleSetMode("eyedropper");
          } else if (key === "tab" && modeRef.current === "window") {
            e.preventDefault();
            setUseSubregion((prev) => !prev);
          }
        }
      } else if (phaseRef.current === "annotating") {
        if (e.key === "Escape") {
          e.preventDefault();
          void handleCancel();
        } else if (isCtrl && (key === "c" || code === "KeyC")) {
          e.preventDefault();
          void handleCopy();
        } else if (isCtrl && (key === "s" || code === "KeyS")) {
          e.preventDefault();
          void handleSaveAs();
        } else if (isCtrl && ((key === "z" || code === "KeyZ") && e.shiftKey)) {
          // Solicitado: Ctrl + Mayús + Z -> Rehacer
          e.preventDefault();
          handleRedo();
        } else if (isCtrl && (key === "z" || code === "KeyZ")) {
          // Solicitado: Ctrl + Z -> Deshacer
          e.preventDefault();
          handleUndo();
        } else if (isCtrl && (key === "y" || code === "KeyY")) {
          // Atajo complementario: Ctrl + Y -> Rehacer
          e.preventDefault();
          handleRedo();
        } else if (e.key === "Enter" && !activeTextBox) {
          e.preventDefault();
          void handleCopy();
        } else if (!isDrawing && !e.repeat) {
          const shortcut = annotationShortcut(e);
          if (!shortcut) return;
          e.preventDefault();
          if ("tool" in shortcut) setActiveTool(shortcut.tool);
          else if ("color" in shortcut) setActiveColor(shortcut.color);
          else if ("strokeWidth" in shortcut) setStrokeWidth(shortcut.strokeWidth);
          else if (shortcut.action === "retry") handleRetrySelection();
          else handleClearAnnotations();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel, handleConfirmToAnnotate, handleCopy, handleSaveAs, handleUndo, handleRedo, selectionRect, activeTextBox, handleConfirmTextBox, handleCancelTextBox, handleRetrySelection, handleClearAnnotations, isDrawing]);

  // Manejo de movimiento del cursor sobre la pantalla (Fase Selección)
  // Se escuchan eventos de puntero (pointer) y no de ratón (mouse) para que la
  // captura funcione igual con lápiz de tableta gráfica, con ratón o con el dedo:
  // el lápiz de una tableta no genera eventos `mousemove`, solo `pointermove`.
  const handlePointerMoveSelecting = useCallback(
    async (e: React.PointerEvent) => {
      if (phase !== "selecting") return;
      const sess = sessionRef.current;
      const currentMode = modeRef.current;
      const screenX = e.screenX;
      const screenY = e.screenY;

      if (currentMode === "eyedropper") {
        try {
          const res = await screenCaptureClient.pickColor(screenX, screenY);
          if (res) {
            setHoveredColor({
              hex: res.hex,
              rgb: `rgb(${res.r}, ${res.g}, ${res.b})`,
              x: e.clientX,
              y: e.clientY,
            });
          }
        } catch {}
        return;
      }

      if (currentMode === "freeform") {
        if (selectionPointer.matches(e.pointerId)) {
          const points = lassoPointsRef.current;
          const last = points[points.length - 1];
          if (!last || Math.hypot(screenX - last.x, screenY - last.y) >= 3) {
            const next = [...points, { x: screenX, y: screenY }];
            lassoPointsRef.current = next;
            setLassoPoints(next);
          }
        }
        return;
      }

      if (currentMode === "window") {
        // Mantener el marco actual hasta resolver el siguiente objetivo nativo.
        // Alternarlo con el catálogo inicial hacía parpadear ventanas y subregiones.
        targetQuery.request(screenX, screenY);
      } else if (currentMode === "fullscreen" && sess) {
        const mon = sess.monitors.find(
          (m) =>
            screenX >= m.x &&
            screenX <= m.x + m.width &&
            screenY >= m.y &&
            screenY <= m.y + m.height
        );
        if (mon) setActiveMonitor(mon);
      } else if (currentMode === "rect") {
        const drag = dragStateRef.current;
        if (drag.active && drag.start && selectionPointer.matches(e.pointerId)) {
          const x = Math.min(drag.start.x, screenX);
          const y = Math.min(drag.start.y, screenY);
          const width = Math.abs(screenX - drag.start.x);
          const height = Math.abs(screenY - drag.start.y);
          const next = { x, y, width, height };
          selectionRectRef.current = next;
          setSelectionRect(next);
        }
      }
    },
    [phase, targetQuery]
  );

  const handlePointerDownSelecting = (e: React.PointerEvent) => {
    if (phase !== "selecting") return;
    if ((e.target as HTMLElement).closest(".capture-floating-toolbar")) return;
    if ((e.target as HTMLElement).closest(".capture-target-box")) return;
    if (mode === "eyedropper") return;
    if (mode !== "rect" && mode !== "freeform") return;
    if (!selectionPointer.begin(e)) return;
    // Nota: no se llama a preventDefault() porque suprimiría los eventos de clic
    // compatibles (los botones de la barra y la confirmación dependen de ellos).
    // El desplazamiento/zoom con lápiz o dedo se evita con `touch-action: none`.

    if (mode === "freeform") {
      const first = { x: e.screenX, y: e.screenY };
      lassoPointsRef.current = [first];
      setLassoPoints([first]);
      return;
    }

    if (mode === "rect") {
      const start = { x: e.screenX, y: e.screenY };
      dragStateRef.current = { active: true, start };
      selectionRectRef.current = null;
      setIsDragging(true);
      setSelectionRect(null);
    }
  };

  const handlePointerUpSelecting = (e: React.PointerEvent) => {
    if (phase !== "selecting" || !selectionPointer.matches(e.pointerId)) return;
    if (e.type === "lostpointercapture" && e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const start = dragStateRef.current.start;
    selectionPointer.release();
    dragStateRef.current = { active: false, start: null };
    setIsDragging(false);
    if (e.type !== "pointerup") {
      selectionRectRef.current = null;
      lassoPointsRef.current = [];
      setSelectionRect(null);
      setLassoPoints([]);
      return;
    }

    if (mode === "freeform") {
      {
        const points = lassoPointsRef.current;
        if (points.length > 5) {
          const minX = Math.min(...points.map((p) => p.x));
          const maxX = Math.max(...points.map((p) => p.x));
          const minY = Math.min(...points.map((p) => p.y));
          const maxY = Math.max(...points.map((p) => p.y));
          const width = maxX - minX;
          const height = maxY - minY;

          if (width >= 16 && height >= 16) {
            const relativePolygon = points.map((p) => ({
              x: p.x - minX,
              y: p.y - minY,
            }));
            void handleConfirmToAnnotate({ x: minX, y: minY, width, height }, relativePolygon);
          } else {
            lassoPointsRef.current = [];
            setLassoPoints([]);
          }
        } else {
          lassoPointsRef.current = [];
          setLassoPoints([]);
        }
      }
      return;
    }

    if (mode === "rect") {
      // Se lee el ref: con lápiz, el `pointerup` puede llegar antes de que React
      // haya aplicado el último `setSelectionRect`.
      const rect = start ? {
        x: Math.min(start.x, e.screenX), y: Math.min(start.y, e.screenY),
        width: Math.abs(e.screenX - start.x), height: Math.abs(e.screenY - start.y),
      } : null;
      if (rect && rect.width >= 10 && rect.height >= 10) {
        void handleConfirmToAnnotate(rect);
      }
    }
  };

  // ── Redimensionamiento con Puntero Capturado (4 esquinas) ──
  const handleResizePointerDown = (
    handle: string,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    if (e.button !== 0 || activeTextBox) return;
    const rect = selectionRect ?? (phase === "annotating" ? annotatingPayload : null);
    if (!rect) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    resizeRef.current = {
      handle,
      startScreenX: e.screenX,
      startScreenY: e.screenY,
      startRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    const { handle, startScreenX, startScreenY, startRect } = resizeRef.current;
    const dx = e.screenX - startScreenX;
    const dy = e.screenY - startScreenY;

    let { x, y, width, height } = startRect;

    if (handle.includes("e")) {
      width = Math.max(20, startRect.width + dx);
    }
    if (handle.includes("s")) {
      height = Math.max(20, startRect.height + dy);
    }
    if (handle.includes("w")) {
      const newW = Math.max(20, startRect.width - dx);
      x = startRect.x + (startRect.width - newW);
      width = newW;
    }
    if (handle.includes("n")) {
      const newH = Math.max(20, startRect.height - dy);
      y = startRect.y + (startRect.height - newH);
      height = newH;
    }

    const sess = sessionRef.current;
    if (sess) {
      const right = Math.min(x + width, sess.virtualX + sess.virtualWidth);
      const bottom = Math.min(y + height, sess.virtualY + sess.virtualHeight);
      x = Math.max(sess.virtualX, x);
      y = Math.max(sess.virtualY, y);
      width = Math.max(20, right - x);
      height = Math.max(20, bottom - y);
    }
    selectionRectRef.current = { x, y, width, height };
    setSelectionRect(selectionRectRef.current);
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizeRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      resizeRef.current = null;
      if (e.type === "pointercancel") {
        setSelectionRect(null);
      } else if (phase === "annotating" && selectionRectRef.current && annotatingPayload) {
        void handleConfirmToAnnotate(selectionRectRef.current, undefined, annotatingPayload);
      }
    }
  };

  // Desplazamiento fluido del marco rectangular sin saltos
  const handleBoxPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".capture-resize-handle")) return;
    if (!selectionRect) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    dragMoveRef.current = {
      startScreenX: e.screenX,
      startScreenY: e.screenY,
      startRect: { ...selectionRect },
    };
  };

  const handleBoxPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragMoveRef.current) return;
    const { startScreenX, startScreenY, startRect } = dragMoveRef.current;
    const dx = e.screenX - startScreenX;
    const dy = e.screenY - startScreenY;
    setSelectionRect({
      ...startRect,
      x: startRect.x + dx,
      y: startRect.y + dy,
    });
  };

  const handleBoxPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragMoveRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      dragMoveRef.current = null;
    }
  };

  const handleClickSelecting = async (e: React.MouseEvent) => {
    if (phase !== "selecting") return;
    if ((e.target as HTMLElement).closest(".capture-floating-toolbar")) return;
    if ((e.target as HTMLElement).closest(".capture-resize-handle")) return;

    if (mode === "eyedropper") {
      const revision = confirmRevisionRef.current;
      try {
        const res = await screenCaptureClient.pickColor(e.screenX, e.screenY);
        if (res) {
          await navigator.clipboard.writeText(res.hex);
          if (!sessionRef.current || confirmRevisionRef.current !== revision) return;
          setActiveColor(res.hex);
          setHoveredColor(null);
          setToastMessage(`Color ${res.hex} copiado al portapapeles`);
          setTimeout(() => {
            if (sessionRef.current && confirmRevisionRef.current === revision) void handleCancel();
          }, 1500);
        }
      } catch (err) {
        console.error("Error al muestrear color:", err);
      }
      return;
    }

    if (mode === "freeform") return;

    // Solo evitar en modo rectángulo si se hace clic dentro del marco para moverlo
    if (mode === "rect" && (e.target as HTMLElement).closest(".capture-target-box")) return;

    if (mode === "window") {
      const sessionId = sessionRef.current?.sessionId;
      let target: DetectedTarget | null;
      try {
        target = await screenCaptureClient.detectWindowAt(e.screenX, e.screenY);
        if (target?.hwnd && useSubregionRef.current) {
          target = await screenCaptureClient.detectSubregion(target.hwnd, e.screenX, e.screenY) ?? target;
        }
      } catch { return; }
      if (!sessionRef.current || sessionRef.current.sessionId !== sessionId || modeRef.current !== "window") return;
      if (target) {
        void handleConfirmToAnnotate({
          x: target.x,
          y: target.y,
          width: target.width,
          height: target.height,
        });
      }
    } else if (mode === "fullscreen") {
      const mon = activeMonitor || session?.monitors?.[0];
      if (mon) {
        void handleConfirmToAnnotate({
          x: mon.x,
          y: mon.y,
          width: mon.width,
          height: mon.height,
        });
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (phase === "selecting" && mode === "window" && subregionTarget) {
      e.preventDefault();
      setUseSubregion((prev) => !prev);
    }
  };

  // ── Renderizado del Lienzo Compuesto en Anotación In-Situ ──

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = bgImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const visibleAnnotations = annotations.slice(0, historyIndex + 1);
    const toDraw = currentAnnotation ? [...visibleAnnotations, currentAnnotation] : visibleAnnotations;

    if (lassoClipPolygon && lassoClipPolygon.length > 2) {
      // 1. Recorte exclusivo del contenido interior del lazo libre
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lassoClipPolygon[0].x, lassoClipPolygon[0].y);
      for (let i = 1; i < lassoClipPolygon.length; i++) {
        ctx.lineTo(lassoClipPolygon[i].x, lassoClipPolygon[i].y);
      }
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      for (const item of toDraw) {
        drawAnnotation(ctx, item);
      }
      ctx.restore();

      // 2. Contorno exterior cyan punteado para delimitar el lazo con elegancia
      ctx.save();
      ctx.strokeStyle = "#00C9B9";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(lassoClipPolygon[0].x, lassoClipPolygon[0].y);
      for (let i = 1; i < lassoClipPolygon.length; i++) {
        ctx.lineTo(lassoClipPolygon[i].x, lassoClipPolygon[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      for (const item of toDraw) {
        drawAnnotation(ctx, item);
      }
    }
  }, [annotations, historyIndex, currentAnnotation, lassoClipPolygon]);

  const renderCanvasRef = useRef(renderCanvas);
  renderCanvasRef.current = renderCanvas;

  // Carga inicial de imagen congelada al entrar en fase de anotación
  useEffect(() => {
    if (phase !== "annotating" || !annotatingPayload?.dataUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      bgImageRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = annotatingPayload.width;
        canvas.height = annotatingPayload.height;
      }
      setCanvasRect({ x: annotatingPayload.x, y: annotatingPayload.y, width: annotatingPayload.width, height: annotatingPayload.height });
      renderCanvasRef.current();
    };
    img.src = annotatingPayload.dataUrl;
    return () => { img.onload = null; };
  }, [phase, annotatingPayload]);

  useEffect(() => {
    if (phase === "annotating") {
      renderCanvas();
    }
  }, [phase, renderCanvas]);

  // ── Eventos de Puntero para Dibujar sin Pérdida de Trazos ──
  const getCanvasLocalCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDownCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasPointer.begin(e)) return;
    dragTextBoxRef.current = null;

    const { x, y } = getCanvasLocalCoords(e);

    if (activeTool === "text") {
      if (activeTextBox && activeTextBox.text.trim()) {
        handleConfirmTextBox();
      }
      const initialFontSize = Math.max(14, strokeWidth * 4 + 10);
      dragTextBoxRef.current = { startX: x, startY: y };
      setActiveTextBox({
        x: Math.round(x),
        y: Math.round(y),
        width: 220,
        height: 60,
        text: "",
        fontSize: initialFontSize,
        color: activeColor,
      });
      return;
    }

    setIsDrawing(true);
    const newItem: AnnotationItem = {
      id: Math.random().toString(36).slice(2),
      tool: activeTool,
      color: activeColor,
      strokeWidth,
      points: [{ x, y }],
      startPoint: { x, y },
      endPoint: { x, y },
      rect: { x, y, width: 0, height: 0 },
    };
    currentAnnotationRef.current = newItem;
    setCurrentAnnotation(newItem);
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasPointer.matches(e.pointerId)) return;
    const { x, y } = getCanvasLocalCoords(e);

    if (activeTool === "text" && dragTextBoxRef.current) {
      const sx = dragTextBoxRef.current.startX;
      const sy = dragTextBoxRef.current.startY;
      const minX = Math.min(sx, x);
      const minY = Math.min(sy, y);
      const w = Math.max(140, Math.abs(x - sx));
      const h = Math.max(50, Math.abs(y - sy));
      setActiveTextBox((prev) =>
        prev
          ? {
              ...prev,
              x: Math.round(minX),
              y: Math.round(minY),
              width: Math.round(w),
              height: Math.round(h),
            }
          : null
      );
      return;
    }

    const prev = currentAnnotationRef.current;
    if (!prev) return;
    const next = (() => {
      if (prev.tool === "pen" || prev.tool === "highlighter") {
        return {
          ...prev,
          points: [...(prev.points || []), { x, y }],
        };
      }
      if ((prev.tool === "rect" || prev.tool === "ellipse") && prev.startPoint) {
        return {
          ...prev,
          rect: annotationShapeRect(prev.startPoint, { x, y }, e.shiftKey),
          endPoint: { x, y },
        };
      }
      if (prev.tool === "arrow") {
        return {
          ...prev,
          endPoint: { x, y },
        };
      }
      return prev;
    })();
    currentAnnotationRef.current = next;
    setCurrentAnnotation(currentAnnotationRef.current);
  };

  // Shift también responde al presionarlo o soltarlo sin mover el puntero.
  useEffect(() => {
    if (!isDrawing) return;
    const handleShift = (event: KeyboardEvent) => {
      if (event.key !== "Shift") return;
      const item = currentAnnotationRef.current;
      if (!item?.startPoint || !item.endPoint || (item.tool !== "rect" && item.tool !== "ellipse")) return;
      currentAnnotationRef.current = { ...item, rect: annotationShapeRect(item.startPoint, item.endPoint, event.shiftKey) };
      setCurrentAnnotation(currentAnnotationRef.current);
    };
    window.addEventListener("keydown", handleShift);
    window.addEventListener("keyup", handleShift);
    return () => {
      window.removeEventListener("keydown", handleShift);
      window.removeEventListener("keyup", handleShift);
    };
  }, [isDrawing]);

  const handlePointerUpCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasPointer.matches(e.pointerId)) return;
    if (e.type === "lostpointercapture" && e.currentTarget.hasPointerCapture(e.pointerId)) return;
    canvasPointer.release();
    const cancelled = e.type !== "pointerup";
    if (dragTextBoxRef.current) {
      dragTextBoxRef.current = null;
      if (cancelled) setActiveTextBox(null);
      else setTimeout(() => {
        textAreaRef.current?.focus();
      }, 50);
      return;
    }

    setIsDrawing(false);
    const item = currentAnnotationRef.current;
    currentAnnotationRef.current = null;
    setCurrentAnnotation(null);
    if (item && !cancelled) {
      const endPoint = getCanvasLocalCoords(e);
      commitAnnotation(
        (item.tool === "rect" || item.tool === "ellipse") && item.startPoint
          ? { ...item, endPoint, rect: annotationShapeRect(item.startPoint, endPoint, e.shiftKey) }
          : { ...item, endPoint, points: item.points ? [...item.points, endPoint] : undefined }
      );
    }
  };

  const displayedTarget =
    mode === "window"
      ? useSubregion && subregionTarget
        ? subregionTarget
        : activeTarget
      : null;

  // Cálculo de coordenadas relativas al overlay para posicionamiento in-situ
  const virtX = session?.virtualX ?? 0;
  const virtY = session?.virtualY ?? 0;

  // En una sesión de vídeo el lazo libre no aplica: la grabación es rectangular.
  const isVideoSession = session?.intent === "video";

  const inPlaceRect = selectionRect ?? annotatingPayload;
  const inPlaceLeft = inPlaceRect ? inPlaceRect.x - virtX : 0;
  const inPlaceTop = inPlaceRect ? inPlaceRect.y - virtY : 0;
  const inPlaceWidth = inPlaceRect?.width ?? 0;
  const inPlaceHeight = inPlaceRect?.height ?? 0;

  if (!session) return null;

  return (
    <div
      className={`capture-overlay-container ${phase === "annotating" ? "is-annotating" : ""}`}
      onPointerMove={handlePointerMoveSelecting}
      onPointerDown={handlePointerDownSelecting}
      onPointerUp={handlePointerUpSelecting}
      onPointerCancel={handlePointerUpSelecting}
      onLostPointerCapture={handlePointerUpSelecting}
      onClick={handleClickSelecting}
      onWheel={handleWheel}
      role="presentation"
    >
      {/* ── FASE 1: BARRA SUPERIOR DE SELECCIÓN EN UNA SOLA FILA REFINADA ── */}
      {phase === "selecting" && (
        <div
          className="capture-floating-toolbar is-refined-row"
          role="toolbar"
          aria-label="Selector de captura"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="capture-mode-row-group">
            {isVideoSession && (
              <span className="capture-video-badge" title="Sesión de grabación de vídeo">
                <span className="capture-video-badge-dot" aria-hidden="true" />
                Grabación
              </span>
            )}
            {MODE_OPTIONS.filter((opt) => !(isVideoSession && opt.id === "freeform")).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`capture-mode-btn ${mode === opt.id ? "is-active" : ""}`}
                onClick={() => {
                  handleSetMode(opt.id);
                  if (opt.id === "fullscreen") {
                    const mon = activeMonitorRef.current || sessionRef.current?.monitors?.[0];
                    if (mon) {
                      void handleConfirmToAnnotate({
                        x: mon.x,
                        y: mon.y,
                        width: mon.width,
                        height: mon.height,
                      });
                    }
                  }
                }}
                title={`${opt.label} (${opt.shortcut})`}
              >
                <Icon name={opt.icon} width={16} height={16} />
                <span className="label">{opt.label}</span>
              </button>
            ))}
          </div>

          <div className="capture-pill-divider" />

          {/* Selector de color en la pestaña 1 con atajo C */}
          {!isVideoSession && (
            <button
              type="button"
              className={`capture-mode-btn is-eyedropper ${mode === "eyedropper" ? "is-active" : ""}`}
              onClick={() => handleSetMode("eyedropper")}
              title="Selector de color (C) · Clic en la pantalla para copiar código hexadecimal"
            >
              <Icon name="pipette" width={16} height={16} />
              <span className="label">Selector de color</span>
            </button>
          )}

          <div className="capture-pill-divider" />

          <button
            type="button"
            className="capture-mode-btn is-cancel"
            onClick={(e) => {
              e.stopPropagation();
              void handleCancel();
            }}
            title="Cancelar captura (Esc)"
          >
            <Icon name="close" width={14} height={14} />
          </button>
        </div>
      )}

      {/* Tooltip del Cuentagotas en Fase de Selección (Pestaña 1) */}
      {phase === "selecting" && mode === "eyedropper" && hoveredColor && (
        <div
          className="capture-color-picker-tooltip"
          style={{
            left: `${hoveredColor.x + 18}px`,
            top: `${hoveredColor.y + 18}px`,
          }}
        >
          <div
            className="capture-color-picker-swatch"
            style={{ background: hoveredColor.hex }}
          />
          <div className="capture-color-picker-info">
            <span className="hex">{hoveredColor.hex}</span>
            <span className="rgb">{hoveredColor.rgb}</span>
          </div>
        </div>
      )}

      {/* ── Visualización en Vivo del Lazo Libre en Fase de Selección ── */}
      {phase === "selecting" && mode === "freeform" && lassoPoints.length > 1 && (
        <svg
          className="capture-lasso-svg"
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            pointerEvents: "none",
            zIndex: 999998,
          }}
        >
          <defs>
            <filter id="lasso-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="rgba(0, 201, 185, 0.5)" />
            </filter>
          </defs>
          <polygon
            points={lassoPoints
              .map((p) => `${p.x - virtX},${p.y - virtY}`)
              .join(" ")}
            fill="rgba(0, 201, 185, 0.15)"
            stroke="#00C9B9"
            strokeWidth="2.5"
            strokeDasharray="6 4"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#lasso-glow)"
          />
        </svg>
      )}

      {/* ── Resaltado en Modo Ventana ── */}
      {phase === "selecting" && mode === "window" && displayedTarget && (
        <div
          className="capture-target-box is-window-target"
          style={{
            left: `${displayedTarget.x - virtX}px`,
            top: `${displayedTarget.y - virtY}px`,
            width: `${displayedTarget.width}px`,
            height: `${displayedTarget.height}px`,
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.stopPropagation();
            void handleClickSelecting(e);
          }}
        >
          <div
            className={`capture-target-badge ${
              displayedTarget.y - virtY < 35 ? "is-flipped" : ""
            }`}
          >
            {displayedTarget.width} × {displayedTarget.height} px · Clic o Enter para capturar
            {displayedTarget.title ? ` · ${displayedTarget.title.slice(0, 32)}` : ""}
            {subregionTarget ? " (Rueda ratón para alternar subregión)" : ""}
          </div>
          <div className="capture-frame-handles is-preview" aria-hidden="true">
            {["nw", "ne", "se", "sw", "n", "s", "w", "e"].map((handle) => (
              <div key={handle} className={`capture-resize-handle ${handle}`} />
            ))}
          </div>
        </div>
      )}

      {/* ── Resaltado en Modo Pantalla Completa ── */}
      {phase === "selecting" && mode === "fullscreen" && activeMonitor && (
        <div
          className="capture-target-box"
          style={{
            left: `${activeMonitor.x - virtX}px`,
            top: `${activeMonitor.y - virtY}px`,
            width: `${activeMonitor.width}px`,
            height: `${activeMonitor.height}px`,
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.stopPropagation();
            void handleConfirmToAnnotate({
              x: activeMonitor.x,
              y: activeMonitor.y,
              width: activeMonitor.width,
              height: activeMonitor.height,
            });
          }}
        >
          <div className="capture-target-badge">
            {activeMonitor.name} · {activeMonitor.width} × {activeMonitor.height} px · Clic o Enter para capturar
          </div>
        </div>
      )}

      {/* ── Resaltado y Tiradores en Modo Rectángulo (4 esquinas con puntero capturado) ── */}
      {phase === "selecting" && mode === "rect" && selectionRect && (
        <div
          className="capture-target-box"
          style={{
            left: `${selectionRect.x - virtX}px`,
            top: `${selectionRect.y - virtY}px`,
            width: `${selectionRect.width}px`,
            height: `${selectionRect.height}px`,
            pointerEvents: "auto",
          }}
          onPointerDown={handleBoxPointerDown}
          onPointerMove={handleBoxPointerMove}
          onPointerUp={handleBoxPointerUp}
          onPointerCancel={handleBoxPointerUp}
          onDoubleClick={() => void handleConfirmToAnnotate(selectionRect)}
        >
          <div
            className={`capture-target-badge ${
              selectionRect.y - virtY < 35 ? "is-flipped" : ""
            }`}
          >
            {selectionRect.width} × {selectionRect.height} px · Doble clic o Enter para capturar
          </div>

          {!isDragging && (
            <>
              {/* 4 Esquinas Principales de Redimensionamiento */}
              <div
                className="capture-resize-handle nw"
                onPointerDown={(e) => handleResizePointerDown("nw", e)}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                onPointerCancel={handleResizePointerUp}
                title="Redimensionar esquina superior izquierda"
              />
              <div
                className="capture-resize-handle ne"
                onPointerDown={(e) => handleResizePointerDown("ne", e)}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                onPointerCancel={handleResizePointerUp}
                title="Redimensionar esquina superior derecha"
              />
              <div
                className="capture-resize-handle se"
                onPointerDown={(e) => handleResizePointerDown("se", e)}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                onPointerCancel={handleResizePointerUp}
                title="Redimensionar esquina inferior derecha"
              />
              <div
                className="capture-resize-handle sw"
                onPointerDown={(e) => handleResizePointerDown("sw", e)}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                onPointerCancel={handleResizePointerUp}
                title="Redimensionar esquina inferior izquierda"
              />

              {/* Tiradores Cardinales */}
              <div
                className="capture-resize-handle n"
                onPointerDown={(e) => handleResizePointerDown("n", e)}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                onPointerCancel={handleResizePointerUp}
              />
              <div
                className="capture-resize-handle s"
                onPointerDown={(e) => handleResizePointerDown("s", e)}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                onPointerCancel={handleResizePointerUp}
              />
              <div
                className="capture-resize-handle w"
                onPointerDown={(e) => handleResizePointerDown("w", e)}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                onPointerCancel={handleResizePointerUp}
              />
              <div
                className="capture-resize-handle e"
                onPointerDown={(e) => handleResizePointerDown("e", e)}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                onPointerCancel={handleResizePointerUp}
              />
            </>
          )}
        </div>
      )}

      {/* ── FASE 2: ANOTACIÓN IN-SITU DIRECTAMENTE SOBRE EL ÁREA TOMADA ── */}
      {phase === "annotating" && annotatingPayload && (
        <>
          {/* Caja recortada con el lienzo de dibujo interactivo */}
          <div
            className={`capture-inplace-box ${lassoClipPolygon ? "is-lasso" : ""}`}
            style={{
              left: `${inPlaceLeft}px`,
              top: `${inPlaceTop}px`,
              width: `${inPlaceWidth}px`,
              height: `${inPlaceHeight}px`,
            }}
          >
            {!lassoClipPolygon && mode !== "fullscreen" && (
              <div className="capture-frame-handles">
                {["nw", "ne", "se", "sw", "n", "s", "w", "e"].map((handle) => (
                  <div key={handle} className={`capture-resize-handle ${handle}`}
                    onPointerDown={(e) => handleResizePointerDown(handle, e)}
                    onPointerMove={handleResizePointerMove}
                    onPointerUp={handleResizePointerUp}
                    onPointerCancel={handleResizePointerUp} />
                ))}
              </div>
            )}
            <div className="capture-inplace-viewport">
              <canvas
                ref={canvasRef}
                width={annotatingPayload.width}
                height={annotatingPayload.height}
                className="capture-inplace-canvas"
                style={{
                  left: `${(canvasRect?.x ?? annotatingPayload.x) - virtX - inPlaceLeft}px`,
                  top: `${(canvasRect?.y ?? annotatingPayload.y) - virtY - inPlaceTop}px`,
                }}
                onPointerDown={handlePointerDownCanvas}
                onPointerMove={handlePointerMoveCanvas}
                onPointerUp={handlePointerUpCanvas}
                onPointerCancel={handlePointerUpCanvas}
                onLostPointerCapture={handlePointerUpCanvas}
                onPointerLeave={() => setHoveredColor(null)}
              />
            </div>
          </div>

          {/* Cuadro de Texto Interactivo In-Situ (Elegir caja arrastrando o clic) */}
          {activeTextBox && (
            <div
              className="capture-text-box-container"
              style={{
                left: `${inPlaceLeft + activeTextBox.x}px`,
                top: `${inPlaceTop + activeTextBox.y}px`,
                width: `${activeTextBox.width}px`,
                minHeight: `${activeTextBox.height}px`,
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="capture-text-box-header">
                <span className="capture-text-box-hint">Cuadro de texto</span>
                <div className="capture-text-box-actions">
                  <button
                    type="button"
                    className="capture-text-btn is-check"
                    onClick={handleConfirmTextBox}
                    title="Confirmar texto (Enter)"
                  >
                    <Icon name="check" width={13} height={13} />
                  </button>
                  <button
                    type="button"
                    className="capture-text-btn is-close"
                    onClick={handleCancelTextBox}
                    title="Cancelar (Esc)"
                  >
                    <Icon name="close" width={13} height={13} />
                  </button>
                </div>
              </div>
              <textarea
                ref={textAreaRef}
                className="capture-text-box-textarea"
                autoFocus
                value={activeTextBox.text}
                placeholder="Escribe tu texto..."
                style={{
                  color: activeTextBox.color,
                  fontSize: `${activeTextBox.fontSize}px`,
                  lineHeight: 1.25,
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveTextBox((prev) => (prev ? { ...prev, text: val } : null));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleConfirmTextBox();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    handleCancelTextBox();
                  }
                }}
              />
            </div>
          )}

          {/* Barra Flotante de Herramientas Anclada Arriba Fija */}
          <CaptureAnnotationBar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            activeColor={activeColor}
            setActiveColor={setActiveColor}
            strokeWidth={strokeWidth}
            setStrokeWidth={setStrokeWidth}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyIndex >= 0}
            canRedo={historyIndex < annotations.length - 1}
            canClear={annotations.length > 0}
            onClear={handleClearAnnotations}
            onRetrySelection={handleRetrySelection}
            onCopy={() => void handleCopy()}
            onSaveAs={() => void handleSaveAs()}
            onCancel={() => void handleCancel()}
          />
        </>
      )}

      {/* Cuenta atrás de arranque de la grabación */}
      {countdown !== null && (
        <div className="capture-countdown" role="status" aria-live="assertive">
          <span className="capture-countdown-ring" aria-hidden="true" />
          <strong className="capture-countdown-number">{countdown}</strong>
          <span className="capture-countdown-label">La grabación empieza en…</span>
        </div>
      )}

      {/* Retroalimentación Toast Global (Fase 1 y Fase 2) */}
      {toastMessage && (
        <div className="capture-editor-toast">
          <Icon name="check" width={16} height={16} style={{ color: "#00C9B9" }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
