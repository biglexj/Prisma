import { useEffect, useState, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../shared/ui/Icon";
import type {
  AnnotationItem,
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

// Paleta oficial con el color insignia de Prisma (#00C9B9) en primer lugar
const PALETTE = [
  "#00C9B9", // Color característico de Prisma (Turquesa / Cyan Prisma)
  "#ff4757", // Rojo vibrante
  "#ffa502", // Naranja
  "#eccc68", // Amarillo
  "#2ed573", // Verde
  "#1e90ff", // Azul
  "#ffffff", // Blanco
  "#2f3542", // Negro / Carbón
];

export function ScreenCaptureOverlay() {
  const [session, setSession] = useState<CaptureSessionInit | null>(null);
  const [phase, setPhase] = useState<"selecting" | "annotating">("selecting");
  const [mode, setMode] = useState<CaptureMode>("window");
  const [activeTarget, setActiveTarget] = useState<DetectedTarget | null>(null);
  const [subregionTarget, setSubregionTarget] = useState<DetectedTarget | null>(null);
  const [useSubregion, setUseSubregion] = useState(false);
  const [activeMonitor, setActiveMonitor] = useState<MonitorTarget | null>(null);

  // Estados para modo Rectángulo en fase de selección
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<RectSelection | null>(null);
  const [activeResizeHandle, setActiveResizeHandle] = useState<string | null>(null);

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
          setMode(event.payload.defaultMode || "window");
          setActiveTarget(null);
          setSubregionTarget(null);
          setUseSubregion(false);
          setSelectionRect(null);
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
  const handleConfirmToAnnotate = useCallback(async (rect: RectSelection) => {
    if (rect.width <= 4 || rect.height <= 4) return;
    try {
      const payload = await screenCaptureClient.confirmCapture(rect);
      if (payload) {
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

  // Guardar archivo PNG en disco y cerrar
  const handleSaveAs = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const defaultFilename = `Prisma_Captura_${dateStr}.png`;

      const chosenPath = await save({
        title: "Guardar captura de pantalla",
        defaultPath: defaultFilename,
        filters: [{ name: "Imagen PNG", extensions: ["png"] }],
      });

      if (!chosenPath) return;

      const dataUrl = canvas.toDataURL("image/png");
      await screenCaptureClient.saveFile(chosenPath, dataUrl);
      await screenCaptureClient.cancelCapture();
    } catch (err) {
      console.error("Error al guardar archivo PNG:", err);
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
        } else if (e.key === "Enter" && modeRef.current === "rect" && selectionRect) {
          e.preventDefault();
          void handleConfirmToAnnotate(selectionRect);
        } else if (e.key === "Tab" && modeRef.current === "window") {
          e.preventDefault();
          setUseSubregion((prev) => !prev);
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
          // Solicitado: Ctrl + Mayús + Z -> Deshacer
          e.preventDefault();
          handleUndo();
        } else if (isCtrl && (key === "z" || code === "KeyZ")) {
          // Atajo estándar: Ctrl + Z -> Deshacer
          e.preventDefault();
          handleUndo();
        } else if (isCtrl && (key === "y" || code === "KeyY")) {
          // Atajo estándar: Ctrl + Y -> Rehacer
          e.preventDefault();
          handleRedo();
        } else if (e.key === "Enter") {
          e.preventDefault();
          void handleCopy();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel, handleConfirmToAnnotate, handleCopy, handleSaveAs, handleUndo, handleRedo, selectionRect]);

  // Manejo de movimiento del cursor sobre la pantalla (Fase Selección)
  const handleMouseMoveSelecting = useCallback(
    async (e: React.MouseEvent) => {
      if (phase !== "selecting") return;
      const sess = sessionRef.current;
      const currentMode = modeRef.current;
      const screenX = e.screenX;
      const screenY = e.screenY;

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
        } else if (activeResizeHandle && selectionRect) {
          let { x, y, width, height } = selectionRect;
          if (activeResizeHandle.includes("e")) {
            width = Math.max(10, screenX - x);
          }
          if (activeResizeHandle.includes("s")) {
            height = Math.max(10, screenY - y);
          }
          if (activeResizeHandle.includes("w")) {
            const newW = Math.max(10, x + width - screenX);
            x = x + width - newW;
            width = newW;
          }
          if (activeResizeHandle.includes("n")) {
            const newH = Math.max(10, y + height - screenY);
            y = y + height - newH;
            height = newH;
          }
          setSelectionRect({ x, y, width, height });
        }
      }
    },
    [phase, isDragging, dragStart, activeResizeHandle, selectionRect]
  );

  const handleMouseDownSelecting = (e: React.MouseEvent) => {
    if (phase !== "selecting" || e.button !== 0) return;
    if (mode === "rect" && !activeResizeHandle) {
      setIsDragging(true);
      setDragStart({ x: e.screenX, y: e.screenY });
      setSelectionRect(null);
    }
  };

  const handleMouseUpSelecting = () => {
    if (phase !== "selecting") return;
    if (mode === "rect") {
      setIsDragging(false);
      setActiveResizeHandle(null);
    }
  };

  const handleClickSelecting = (e: React.MouseEvent) => {
    if (phase !== "selecting") return;
    if ((e.target as HTMLElement).closest(".capture-floating-toolbar")) return;
    if ((e.target as HTMLElement).closest(".capture-resize-handle")) return;

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
    } else if (mode === "fullscreen" && activeMonitor) {
      void handleConfirmToAnnotate({
        x: activeMonitor.x,
        y: activeMonitor.y,
        width: activeMonitor.width,
        height: activeMonitor.height,
      });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (phase === "selecting" && mode === "window" && subregionTarget) {
      e.preventDefault();
      setUseSubregion((prev) => !prev);
    }
  };

  // ── Renderizado del Lienzo Compuesto en Anotación In-Situ ──
  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromx: number,
    fromy: number,
    tox: number,
    toy: number,
    headlen: number
  ) => {
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  const drawAnnotation = (ctx: CanvasRenderingContext2D, item: AnnotationItem) => {
    ctx.save();
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = item.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (item.tool === "highlighter") {
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = item.strokeWidth * 3.5;
    }

    if (item.tool === "pen" || item.tool === "highlighter") {
      if (item.points && item.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(item.points[0].x, item.points[0].y);
        for (let i = 1; i < item.points.length; i++) {
          ctx.lineTo(item.points[i].x, item.points[i].y);
        }
        ctx.stroke();
      }
    } else if (item.tool === "rect" && item.rect) {
      ctx.beginPath();
      ctx.strokeRect(item.rect.x, item.rect.y, item.rect.width, item.rect.height);
    } else if (item.tool === "arrow" && item.startPoint && item.endPoint) {
      drawArrow(ctx, item.startPoint.x, item.startPoint.y, item.endPoint.x, item.endPoint.y, item.strokeWidth * 3.5);
    } else if (item.tool === "text" && item.startPoint && item.text) {
      ctx.font = `bold ${item.fontSize || 20}px Inter, sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 4;
      ctx.fillText(item.text, item.startPoint.x, item.startPoint.y);
    }

    ctx.restore();
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = bgImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const visibleAnnotations = annotations.slice(0, historyIndex + 1);
    const toDraw = currentAnnotation ? [...visibleAnnotations, currentAnnotation] : visibleAnnotations;

    for (const item of toDraw) {
      drawAnnotation(ctx, item);
    }
  }, [annotations, historyIndex, currentAnnotation]);

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
      const text = window.prompt("Introduce el texto para la anotación:");
      if (text && text.trim()) {
        const newTextItem: AnnotationItem = {
          id: Math.random().toString(36).slice(2),
          tool: "text",
          color: activeColor,
          strokeWidth,
          startPoint: { x, y },
          text: text.trim(),
          fontSize: strokeWidth * 5 + 12,
        };
        commitAnnotation(newTextItem);
      }
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
    if (!isDrawing) return;
    const { x, y } = getCanvasLocalCoords(e);

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

  // Posicionamiento de la barra flotante anclada a la región recortada
  const toolbarWidth = 620;
  const rawTbLeft = inPlaceLeft + inPlaceWidth / 2 - toolbarWidth / 2;
  const clampedLeft = typeof window !== "undefined"
    ? Math.max(16, Math.min(window.innerWidth - toolbarWidth - 16, rawTbLeft))
    : rawTbLeft;

  let clampedTop = inPlaceTop + inPlaceHeight + 14;
  if (typeof window !== "undefined" && clampedTop + 65 > window.innerHeight) {
    clampedTop = Math.max(16, inPlaceTop - 65);
  }

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
      {/* ── FASE 1: BARRA SUPERIOR DE SELECCIÓN ── */}
      {phase === "selecting" && (
        <div className="capture-floating-toolbar" role="toolbar" aria-label="Selector de captura">
          <button
            type="button"
            className={`capture-pill-btn ${mode === "window" ? "is-active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setMode("window");
            }}
            title="Modo Ventana (Predeterminado)"
          >
            <Icon name="columns" width={15} height={15} />
            <span>Ventana</span>
          </button>

          <button
            type="button"
            className={`capture-pill-btn ${mode === "rect" ? "is-active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setMode("rect");
            }}
            title="Modo Rectángulo libre"
          >
            <Icon name="crop" width={15} height={15} />
            <span>Rectángulo</span>
          </button>

          <button
            type="button"
            className={`capture-pill-btn ${mode === "fullscreen" ? "is-active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setMode("fullscreen");
            }}
            title="Modo Pantalla Completa"
          >
            <Icon name="fullscreen" width={15} height={15} />
            <span>Pantalla Completa</span>
          </button>

          <div className="capture-pill-divider" />

          <button
            type="button"
            className="capture-pill-btn is-cancel"
            onClick={(e) => {
              e.stopPropagation();
              void handleCancel();
            }}
            title="Cancelar (Esc)"
          >
            <Icon name="close" width={14} height={14} />
            <span>Cancelar (Esc)</span>
          </button>
        </div>
      )}

      {/* ── Resaltado en Modo Ventana ── */}
      {phase === "selecting" && mode === "window" && displayedTarget && (
        <div
          className="capture-target-box"
          style={{
            left: `${displayedTarget.x - virtX}px`,
            top: `${displayedTarget.y - virtY}px`,
            width: `${displayedTarget.width}px`,
            height: `${displayedTarget.height}px`,
          }}
        >
          <div
            className={`capture-target-badge ${
              displayedTarget.y - virtY < 35 ? "is-flipped" : ""
            }`}
          >
            {displayedTarget.width} × {displayedTarget.height} px
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
          }}
        >
          <div className="capture-target-badge">
            {activeMonitor.name} · {activeMonitor.width} × {activeMonitor.height} px
          </div>
        </div>
      )}

      {/* ── Resaltado y Tiradores en Modo Rectángulo ── */}
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
              <div
                className="capture-resize-handle nw"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setActiveResizeHandle("nw");
                }}
              />
              <div
                className="capture-resize-handle n"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setActiveResizeHandle("n");
                }}
              />
              <div
                className="capture-resize-handle ne"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setActiveResizeHandle("ne");
                }}
              />
              <div
                className="capture-resize-handle e"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setActiveResizeHandle("e");
                }}
              />
              <div
                className="capture-resize-handle se"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setActiveResizeHandle("se");
                }}
              />
              <div
                className="capture-resize-handle s"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setActiveResizeHandle("s");
                }}
              />
              <div
                className="capture-resize-handle sw"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setActiveResizeHandle("sw");
                }}
              />
              <div
                className="capture-resize-handle w"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setActiveResizeHandle("w");
                }}
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
            className="capture-inplace-box"
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
            />
          </div>

          {/* Barra Flotante de Herramientas Anclada a la Captura */}
          <div
            className="capture-annotation-floating-bar"
            style={{
              left: `${clampedLeft}px`,
              top: `${clampedTop}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Herramientas de trazo */}
            <div className="capture-toolbar-subgroup">
              <button
                type="button"
                className={`capture-tool-btn ${activeTool === "pen" ? "is-active" : ""}`}
                onClick={() => setActiveTool("pen")}
                title="Lápiz libre"
              >
                <Icon name="edit" width={17} height={17} />
              </button>
              <button
                type="button"
                className={`capture-tool-btn ${activeTool === "highlighter" ? "is-active" : ""}`}
                onClick={() => setActiveTool("highlighter")}
                title="Resaltador translúcido"
              >
                <Icon name="sliders" width={17} height={17} />
              </button>
              <button
                type="button"
                className={`capture-tool-btn ${activeTool === "arrow" ? "is-active" : ""}`}
                onClick={() => setActiveTool("arrow")}
                title="Flecha indicadora"
              >
                <Icon name="arrow-right" width={17} height={17} />
              </button>
              <button
                type="button"
                className={`capture-tool-btn ${activeTool === "rect" ? "is-active" : ""}`}
                onClick={() => setActiveTool("rect")}
                title="Marco rectangular"
              >
                <Icon name="crop" width={17} height={17} />
              </button>
              <button
                type="button"
                className={`capture-tool-btn ${activeTool === "text" ? "is-active" : ""}`}
                onClick={() => setActiveTool("text")}
                title="Texto anotado"
              >
                <Icon name="file-text" width={17} height={17} />
              </button>
            </div>

            <div className="capture-pill-divider" />

            {/* Paleta con #00C9B9 en 1er lugar */}
            <div className="capture-toolbar-subgroup">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`capture-color-swatch ${activeColor === c ? "is-active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setActiveColor(c)}
                  title={c === "#00C9B9" ? "Color Insignia Prisma (#00C9B9)" : c}
                />
              ))}
            </div>

            <div className="capture-pill-divider" />

            {/* Grosor de trazo */}
            <div className="capture-toolbar-subgroup">
              {[2, 4, 8].map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`capture-tool-btn ${strokeWidth === w ? "is-active" : ""}`}
                  onClick={() => setStrokeWidth(w)}
                  title={`Grosor: ${w}px`}
                >
                  <span
                    style={{
                      width: `${w * 2 + 2}px`,
                      height: `${w * 2 + 2}px`,
                      borderRadius: "50%",
                      background: "currentColor",
                    }}
                  />
                </button>
              ))}
            </div>

            <div className="capture-pill-divider" />

            {/* Deshacer / Rehacer / Limpiar */}
            <div className="capture-toolbar-subgroup">
              <button
                type="button"
                className="capture-tool-btn"
                onClick={handleUndo}
                disabled={historyIndex < 0}
                title="Deshacer (Ctrl+Mayús+Z / Ctrl+Z)"
              >
                <Icon name="undo" width={16} height={16} />
              </button>
              <button
                type="button"
                className="capture-tool-btn"
                onClick={handleRedo}
                disabled={historyIndex >= annotations.length - 1}
                title="Rehacer (Ctrl+Y)"
              >
                <Icon name="rotate-cw" width={16} height={16} />
              </button>
              <button
                type="button"
                className="capture-tool-btn"
                onClick={() => {
                  setAnnotations([]);
                  setHistoryIndex(-1);
                }}
                disabled={annotations.length === 0}
                title="Limpiar todas las anotaciones"
              >
                <Icon name="trash" width={16} height={16} />
              </button>
            </div>

            <div className="capture-pill-divider" />

            {/* Acciones Finales: Copiar, Guardar, Reintentar, Cerrar */}
            <div className="capture-toolbar-subgroup">
              <button
                type="button"
                className="capture-tool-btn"
                onClick={handleRetrySelection}
                title="Volver a seleccionar área"
              >
                <Icon name="refresh" width={16} height={16} />
              </button>

              <button
                type="button"
                className="capture-btn-primary"
                onClick={() => void handleCopy()}
                title="Copiar imagen al portapapeles sin tocar disco (Ctrl+C / Enter)"
              >
                <Icon name="copy" width={15} height={15} />
                <span>Copiar</span>
              </button>

              <button
                type="button"
                className="capture-pill-btn"
                style={{ background: "rgba(255, 255, 255, 0.12)" }}
                onClick={() => void handleSaveAs()}
                title="Guardar como archivo PNG en disco (Ctrl+S)"
              >
                <Icon name="save" width={15} height={15} />
                <span>Guardar</span>
              </button>

              <button
                type="button"
                className="capture-tool-btn is-cancel"
                onClick={() => void handleCancel()}
                title="Cerrar y descartar (Esc)"
              >
                <Icon name="close" width={15} height={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
