import { useEffect, useState, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../shared/ui/Icon";
import { CaptureAnnotationBar } from "./components/CaptureAnnotationBar";
import { drawAnnotation } from "./utils/annotationDrawing";
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
  // Recordar la última herramienta/modo utilizada (Ventana, Rectángulo, Lazo o Pantalla Completa)
  const [mode, setMode] = useState<CaptureMode>(() => {
    try {
      const saved = localStorage.getItem("prisma.screen-capture.last-mode");
      if (saved && ["window", "rect", "freeform", "fullscreen", "eyedropper"].includes(saved)) {
        return saved as CaptureMode;
      }
    } catch {}
    return "window";
  });
  const [activeTarget, setActiveTarget] = useState<DetectedTarget | null>(null);
  const [subregionTarget, setSubregionTarget] = useState<DetectedTarget | null>(null);
  const [useSubregion, setUseSubregion] = useState(false);
  const [activeMonitor, setActiveMonitor] = useState<MonitorTarget | null>(null);

  // Estados para modo Rectángulo en fase de selección
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<RectSelection | null>(null);

  // Estados para modo Lazo Libre (mano alzada)
  const [lassoPoints, setLassoPoints] = useState<AnnotationPoint[]>([]);
  const [isDrawingLasso, setIsDrawingLasso] = useState(false);
  const [lassoClipPolygon, setLassoClipPolygon] = useState<AnnotationPoint[] | null>(null);

  // Selector de color / Cuentagotas y retroalimentación Toast
  const [hoveredColor, setHoveredColor] = useState<{ hex: string; rgb: string; x: number; y: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Cuadro de texto interactivo in-situ (elegir marco de texto arrastrando o clic)
  const [activeTextBox, setActiveTextBox] = useState<ActiveTextBox | null>(null);
  const dragTextBoxRef = useRef<{ startX: number; startY: number } | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // Cambiar modo y persistir selección en localStorage
  const handleSetMode = useCallback((newMode: CaptureMode) => {
    setMode(newMode);
    try {
      localStorage.setItem("prisma.screen-capture.last-mode", newMode);
    } catch {}
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  // Escuchar inicio de sesión desde Rust o hotkey global
  useEffect(() => {
    const unlistenPromise = listen<CaptureSessionInit>(
      "screen_capture://session-started",
      (event) => {
        if (event.payload) {
          setSession(event.payload);
          setPhase("selecting");
          let initialMode: CaptureMode = event.payload.defaultMode || "window";
          try {
            const saved = localStorage.getItem("prisma.screen-capture.last-mode") as CaptureMode | null;
            if (saved && ["window", "rect", "freeform", "fullscreen"].includes(saved)) {
              initialMode = saved;
            }
          } catch {}
          setMode(initialMode);
          if (event.payload.targets && event.payload.targets.length > 0) {
            setActiveTarget(event.payload.targets[0]);
          } else {
            setActiveTarget(null);
          }
          if (event.payload.monitors && event.payload.monitors.length > 0) {
            setActiveMonitor(event.payload.monitors[0]);
          } else {
            setActiveMonitor(null);
          }
          setSubregionTarget(null);
          setUseSubregion(false);
          setSelectionRect(null);
          setLassoPoints([]);
          setLassoClipPolygon(null);
          setAnnotatingPayload(null);
          setAnnotations([]);
          setHistoryIndex(-1);
          setCurrentAnnotation(null);
        }
      }
    );

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Cancelar captura completa
  const handleCancel = useCallback(async () => {
    try {
      await screenCaptureClient.cancelCapture();
    } catch {
      // Silencio intencional
    }
  }, []);

  // Confirmar recorte y pasar a anotación IN-SITU (sin abrir otra ventana)
  const handleConfirmToAnnotate = useCallback(async (rect: RectSelection, clipPolygon?: AnnotationPoint[]) => {
    if (rect.width <= 4 || rect.height <= 4) return;
    try {
      const payload = await screenCaptureClient.confirmCapture(rect);
      if (payload) {
        setLassoClipPolygon(clipPolygon ?? null);
        setAnnotatingPayload(payload);
        setPhase("annotating");
        setAnnotations([]);
        setHistoryIndex(-1);
        setCurrentAnnotation(null);
      }
    } catch (err) {
      console.error("Error al confirmar captura in-situ:", err);
    }
  }, []);

  // Volver a la fase de selección
  const handleRetrySelection = useCallback(() => {
    setPhase("selecting");
    setAnnotatingPayload(null);
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

      await screenCaptureClient.cancelCapture();
    } catch (err) {
      console.error("Error al copiar al portapapeles:", err);
    }
  }, []);

  // Guardar archivo PNG en disco de forma automática sin pedir ruta cada vez
  const handleSaveAs = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
      const defaultFilename = `Prisma_Captura_${dateStr}.png`;

      const finalFolder = targetFolder || "C:\\Capturas";
      const fullPath = `${finalFolder}\\${defaultFilename}`;

      const dataUrl = canvas.toDataURL("image/png");
      await screenCaptureClient.saveFile(fullPath, dataUrl);

      setToastMessage(`Guardado en Capturas: ${defaultFilename}`);
      setTimeout(() => {
        void screenCaptureClient.cancelCapture();
      }, 350);
    } catch (err) {
      console.error("Error al guardar archivo PNG automáticamente:", err);
      try {
        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const defaultFilename = `Prisma_Captura_${dateStr}.png`;
        const chosenPath = await save({
          title: "Guardar captura de pantalla",
          defaultPath: defaultFilename,
          filters: [{ name: "Imagen PNG", extensions: ["png"] }],
        });
        if (chosenPath) {
          const dataUrl = canvas.toDataURL("image/png");
          await screenCaptureClient.saveFile(chosenPath, dataUrl);
          await screenCaptureClient.cancelCapture();
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

  // Manejo de atajos globales dentro de la capa
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const code = e.code;

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
          } else if (key === "q" || code === "KeyQ") {
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
          } else if (key === "c" || code === "KeyC") {
            // Atajo oficial solicitado para Selector de Color en fase 1
            e.preventDefault();
            handleSetMode("eyedropper");
          } else if (key === "tab" && modeRef.current === "window") {
            e.preventDefault();
            setUseSubregion((prev) => !prev);
          }
        }
      } else if (phaseRef.current === "annotating") {
        if (activeTextBox) {
          if (e.key === "Escape") {
            e.preventDefault();
            handleCancelTextBox();
            return;
          }
        }
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
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel, handleConfirmToAnnotate, handleCopy, handleSaveAs, handleUndo, handleRedo, selectionRect, activeTextBox, handleConfirmTextBox, handleCancelTextBox]);

  // Manejo de movimiento del cursor sobre la pantalla (Fase Selección)
  const handleMouseMoveSelecting = useCallback(
    async (e: React.MouseEvent) => {
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
        if (isDrawingLasso) {
          setLassoPoints((prev) => {
            const last = prev[prev.length - 1];
            if (last) {
              const dist = Math.hypot(screenX - last.x, screenY - last.y);
              if (dist < 3) return prev;
            }
            return [...prev, { x: screenX, y: screenY }];
          });
        }
        return;
      }

      if (currentMode === "window" && sess) {
        const found = sess.targets.find(
          (t) =>
            screenX >= t.x &&
            screenX <= t.x + t.width &&
            screenY >= t.y &&
            screenY <= t.y + t.height
        );

        if (found) {
          setActiveTarget(found);
          try {
            const sub = await screenCaptureClient.detectSubregion(
              found.x,
              found.y,
              screenX,
              screenY
            );
            if (sub && sub.width < found.width && sub.height < found.height) {
              setSubregionTarget(sub);
            } else {
              setSubregionTarget(null);
            }
          } catch {
            setSubregionTarget(null);
          }
        }
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
        if (isDragging && dragStart) {
          const x = Math.min(dragStart.x, screenX);
          const y = Math.min(dragStart.y, screenY);
          const width = Math.abs(screenX - dragStart.x);
          const height = Math.abs(screenY - dragStart.y);
          setSelectionRect({ x, y, width, height });
        }
      }
    },
    [phase, isDragging, dragStart, isDrawingLasso]
  );

  const handleMouseDownSelecting = (e: React.MouseEvent) => {
    if (phase !== "selecting" || e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".capture-floating-toolbar")) return;
    if ((e.target as HTMLElement).closest(".capture-target-box")) return;
    if (mode === "eyedropper") return;

    if (mode === "freeform") {
      setIsDrawingLasso(true);
      setLassoPoints([{ x: e.screenX, y: e.screenY }]);
      return;
    }

    if (mode === "rect") {
      setIsDragging(true);
      setDragStart({ x: e.screenX, y: e.screenY });
      setSelectionRect(null);
    }
  };

  const handleMouseUpSelecting = () => {
    if (phase !== "selecting") return;

    if (mode === "freeform") {
      if (isDrawingLasso) {
        setIsDrawingLasso(false);
        if (lassoPoints.length > 5) {
          const minX = Math.min(...lassoPoints.map((p) => p.x));
          const maxX = Math.max(...lassoPoints.map((p) => p.x));
          const minY = Math.min(...lassoPoints.map((p) => p.y));
          const maxY = Math.max(...lassoPoints.map((p) => p.y));
          const width = maxX - minX;
          const height = maxY - minY;

          if (width >= 16 && height >= 16) {
            const relativePolygon = lassoPoints.map((p) => ({
              x: p.x - minX,
              y: p.y - minY,
            }));
            void handleConfirmToAnnotate({ x: minX, y: minY, width, height }, relativePolygon);
          } else {
            setLassoPoints([]);
          }
        } else {
          setLassoPoints([]);
        }
      }
      return;
    }

    if (mode === "rect") {
      setIsDragging(false);
      if (selectionRect && selectionRect.width >= 10 && selectionRect.height >= 10) {
        void handleConfirmToAnnotate(selectionRect);
      }
    }
  };

  // ── Redimensionamiento con Puntero Capturado (4 esquinas) ──
  const handleResizePointerDown = (
    handle: string,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    if (!selectionRect) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    resizeRef.current = {
      handle,
      startScreenX: e.screenX,
      startScreenY: e.screenY,
      startRect: { ...selectionRect },
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

    setSelectionRect({ x, y, width, height });
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizeRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      resizeRef.current = null;
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
      try {
        const res = await screenCaptureClient.pickColor(e.screenX, e.screenY);
        if (res) {
          await navigator.clipboard.writeText(res.hex);
          setActiveColor(res.hex);
          setHoveredColor(null);
          setToastMessage(`Color ${res.hex} copiado al portapapeles`);
          setTimeout(() => {
            void handleCancel();
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
      const target = useSubregion && subregionTarget ? subregionTarget : activeTarget;
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

  // Carga inicial de imagen congelada al entrar en fase de anotación
  useEffect(() => {
    if (phase !== "annotating" || !annotatingPayload?.dataUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = annotatingPayload.dataUrl;
    img.onload = () => {
      bgImageRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = annotatingPayload.width;
        canvas.height = annotatingPayload.height;
      }
      renderCanvas();
    };
  }, [phase, annotatingPayload, renderCanvas]);

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
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

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
    setCurrentAnnotation(newItem);
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
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

    if (!isDrawing) return;

    setCurrentAnnotation((prev) => {
      if (!prev) return null;
      if (prev.tool === "pen" || prev.tool === "highlighter") {
        return {
          ...prev,
          points: [...(prev.points || []), { x, y }],
        };
      }
      if (prev.tool === "rect" && prev.startPoint) {
        const rx = Math.min(prev.startPoint.x, x);
        const ry = Math.min(prev.startPoint.y, y);
        const rw = Math.abs(x - prev.startPoint.x);
        const rh = Math.abs(y - prev.startPoint.y);
        return {
          ...prev,
          rect: { x: rx, y: ry, width: rw, height: rh },
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
    });
  };

  const handlePointerUpCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragTextBoxRef.current) {
      dragTextBoxRef.current = null;
      setTimeout(() => {
        textAreaRef.current?.focus();
      }, 50);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (currentAnnotation) {
      commitAnnotation(currentAnnotation);
      setCurrentAnnotation(null);
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

  const inPlaceLeft = annotatingPayload ? annotatingPayload.x - virtX : 0;
  const inPlaceTop = annotatingPayload ? annotatingPayload.y - virtY : 0;
  const inPlaceWidth = annotatingPayload ? annotatingPayload.width : 0;
  const inPlaceHeight = annotatingPayload ? annotatingPayload.height : 0;

  return (
    <div
      className={`capture-overlay-container ${phase === "annotating" ? "is-annotating" : ""}`}
      onMouseMove={handleMouseMoveSelecting}
      onMouseDown={handleMouseDownSelecting}
      onMouseUp={handleMouseUpSelecting}
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
            {MODE_OPTIONS.map((opt) => (
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
                <span className="shortcut">{opt.shortcut}</span>
              </button>
            ))}
          </div>

          <div className="capture-pill-divider" />

          {/* Selector de color en la pestaña 1 con atajo C */}
          <button
            type="button"
            className={`capture-mode-btn is-eyedropper ${mode === "eyedropper" ? "is-active" : ""}`}
            onClick={() => handleSetMode("eyedropper")}
            title="Selector de color (C) · Clic en la pantalla para copiar código hexadecimal"
          >
            <Icon name="pipette" width={16} height={16} />
            <span className="label">Selector de color</span>
            <span className="shortcut">C</span>
          </button>

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
            void handleConfirmToAnnotate({
              x: displayedTarget.x,
              y: displayedTarget.y,
              width: displayedTarget.width,
              height: displayedTarget.height,
            });
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
            <canvas
              ref={canvasRef}
              className="capture-inplace-canvas"
              style={{
                width: `${inPlaceWidth}px`,
                height: `${inPlaceHeight}px`,
              }}
              onPointerDown={handlePointerDownCanvas}
              onPointerMove={handlePointerMoveCanvas}
              onPointerUp={handlePointerUpCanvas}
              onPointerCancel={handlePointerUpCanvas}
              onPointerLeave={() => setHoveredColor(null)}
            />
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
            onClear={() => {
              setAnnotations([]);
              setHistoryIndex(-1);
            }}
            onRetrySelection={handleRetrySelection}
            onCopy={() => void handleCopy()}
            onSaveAs={() => void handleSaveAs()}
            onCancel={() => void handleCancel()}
          />
        </>
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
