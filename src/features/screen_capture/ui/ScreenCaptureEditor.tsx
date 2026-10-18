import { useEffect, useState, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { save } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../shared/ui/Icon";
import type { AnnotationItem, AnnotationTool, EditorPayload } from "../model/types";
import { screenCaptureClient } from "../services/screenCaptureClient";
import "./screen-capture.css";

const PALETTE = [
  "#ff4757", // Rojo vibrante
  "#ffa502", // Naranja
  "#eccc68", // Amarillo
  "#2ed573", // Verde
  "#00d2d3", // Cyan
  "#1e90ff", // Azul
  "#ffffff", // Blanco
  "#2f3542", // Negro / Carbón
];

export function ScreenCaptureEditor() {
  const [payload, setPayload] = useState<EditorPayload | null>(null);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("pen");
  const [activeColor, setActiveColor] = useState<string>("#ff4757");
  const [strokeWidth, setStrokeWidth] = useState<number>(4);

  // Historial de anotaciones vectoriales
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Estado de dibujo activo
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<AnnotationItem | null>(null);

  // Feedback / Toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Referencias a los lienzos
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Escuchar payload proveniente de Rust al confirmar selección
  useEffect(() => {
    // Intentar leer payload inicial si ya existía
    void screenCaptureClient.getEditorPayload().then((p) => {
      if (p) setPayload(p);
    });

    const unlistenPromise = listen<EditorPayload>(
      "screen_capture://editor-payload",
      (event) => {
        if (event.payload) {
          setPayload(event.payload);
          setAnnotations([]);
          setHistoryIndex(-1);
        }
      }
    );

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Cargar imagen de fondo
  useEffect(() => {
    if (!payload?.dataUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = payload.dataUrl;
    img.onload = () => {
      bgImageRef.current = img;
      renderCanvas();
    };
  }, [payload]);

  // Renderizar lienzo compuesto
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = bgImageRef.current;
    if (!canvas || !img) return;

    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 1. Dibujar captura original
    ctx.drawImage(img, 0, 0);

    // 2. Dibujar anotaciones hasta el índice actual
    const visibleAnnotations = annotations.slice(0, historyIndex + 1);
    const toDraw = currentAnnotation
      ? [...visibleAnnotations, currentAnnotation]
      : visibleAnnotations;

    for (const item of toDraw) {
      drawAnnotation(ctx, item);
    }
  }, [annotations, historyIndex, currentAnnotation]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, item: AnnotationItem) => {
    ctx.save();
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = item.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (item.tool === "highlighter") {
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = item.strokeWidth * 3;
    }

    if (item.tool === "pen" || item.tool === "highlighter") {
      if (item.points && item.points.length > 1) {
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
      drawArrow(ctx, item.startPoint.x, item.startPoint.y, item.endPoint.x, item.endPoint.y, item.strokeWidth * 3);
    } else if (item.tool === "text" && item.startPoint && item.text) {
      ctx.font = `bold ${item.fontSize || 20}px Inter, sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.fillText(item.text, item.startPoint.x, item.startPoint.y);
    }

    ctx.restore();
  };

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

    // Cabeza de flecha
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  // Coordenadas locales dentro de la imagen
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === "select") return;
    const { x, y } = getCanvasCoords(e);

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
          fontSize: strokeWidth * 6 + 10,
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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAnnotation) return;
    const { x, y } = getCanvasCoords(e);

    if (activeTool === "pen" || activeTool === "highlighter") {
      setCurrentAnnotation((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...(prev.points || []), { x, y }],
        };
      });
    } else if (activeTool === "rect") {
      setCurrentAnnotation((prev) => {
        if (!prev || !prev.startPoint) return null;
        const rx = Math.min(prev.startPoint.x, x);
        const ry = Math.min(prev.startPoint.y, y);
        const rw = Math.abs(x - prev.startPoint.x);
        const rh = Math.abs(y - prev.startPoint.y);
        return {
          ...prev,
          rect: { x: rx, y: ry, width: rw, height: rh },
        };
      });
    } else if (activeTool === "arrow") {
      setCurrentAnnotation((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          endPoint: { x, y },
        };
      });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentAnnotation) return;
    setIsDrawing(false);
    commitAnnotation(currentAnnotation);
    setCurrentAnnotation(null);
  };

  const commitAnnotation = (item: AnnotationItem) => {
    const nextList = [...annotations.slice(0, historyIndex + 1), item];
    setAnnotations(nextList);
    setHistoryIndex(nextList.length - 1);
  };

  const handleUndo = useCallback(() => {
    if (historyIndex >= 0) {
      setHistoryIndex((prev) => prev - 1);
    }
  }, [historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < annotations.length - 1) {
      setHistoryIndex((prev) => prev + 1);
    }
  }, [historyIndex, annotations.length]);

  // Copiar imagen renderizada al portapapeles sin tocar disco
  const handleCopy = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });

      if (!blob) throw new Error("No se pudo exportar el lienzo a PNG");

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);

      showToast("¡Captura copiada al portapapeles sin tocar disco!");
    } catch (err) {
      console.error("Error al copiar imagen:", err);
      showToast("Error al copiar al portapapeles.");
    }
  }, [showToast]);

  // Guardar como PNG mediante diálogo del sistema
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

      if (!chosenPath) return; // Usuario canceló el diálogo

      const dataUrl = canvas.toDataURL("image/png");
      await screenCaptureClient.saveFile(chosenPath, dataUrl);
      showToast(`¡Guardada con éxito en ${chosenPath.replace(/.*[/\\]/, "")}!`);
    } catch (err) {
      console.error("Error al guardar archivo:", err);
      showToast("Error al guardar la captura en disco.");
    }
  }, [showToast]);

  // Nueva captura
  const handleNewCapture = async () => {
    try {
      await screenCaptureClient.startCapture("window");
    } catch (err) {
      console.error("Error al iniciar nueva captura:", err);
    }
  };

  // Atajos de teclado en el editor (Ctrl+C, Ctrl+S, Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void handleCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSaveAs();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCopy, handleSaveAs, handleUndo, handleRedo]);

  const win = getCurrentWebviewWindow();

  return (
    <div className="capture-editor-window">
      {/* ── Barra de Título y Controles de Ventana Dedicada ── */}
      <header className="capture-editor-header">
        <div className="capture-editor-header-left">
          <Icon name="camera" width={18} height={18} />
          <span className="capture-editor-title">Editor de Captura · Prisma</span>
          {payload && (
            <span className="capture-editor-meta-pill">
              {payload.width} × {payload.height} px
            </span>
          )}
        </div>

        <div className="capture-editor-window-controls">
          <button
            type="button"
            className="capture-win-btn"
            onClick={() => void win.minimize()}
            title="Minimizar"
          >
            <Icon name="minus" width={14} height={14} />
          </button>
          <button
            type="button"
            className="capture-win-btn"
            onClick={() => void win.toggleMaximize()}
            title="Maximizar / Restaurar"
          >
            <Icon name="expand" width={14} height={14} />
          </button>
          <button
            type="button"
            className="capture-win-btn close"
            onClick={() => void win.close()}
            title="Cerrar Editor"
          >
            <Icon name="close" width={14} height={14} />
          </button>
        </div>
      </header>

      {/* ── Barra de Herramientas de Edición ── */}
      <div className="capture-editor-toolbar" role="toolbar" aria-label="Herramientas de anotación">
        {/* Grupo de Herramientas Vectoriales */}
        <div className="capture-toolbar-group">
          <button
            type="button"
            className={`capture-tool-btn ${activeTool === "select" ? "is-active" : ""}`}
            onClick={() => setActiveTool("select")}
            title="Mover / Puntero"
          >
            <Icon name="hand" width={18} height={18} />
          </button>
          <button
            type="button"
            className={`capture-tool-btn ${activeTool === "pen" ? "is-active" : ""}`}
            onClick={() => setActiveTool("pen")}
            title="Lápiz libre"
          >
            <Icon name="edit" width={18} height={18} />
          </button>
          <button
            type="button"
            className={`capture-tool-btn ${activeTool === "highlighter" ? "is-active" : ""}`}
            onClick={() => setActiveTool("highlighter")}
            title="Resaltador fluorescente"
          >
            <Icon name="brush" width={18} height={18} />
          </button>
          <button
            type="button"
            className={`capture-tool-btn ${activeTool === "rect" ? "is-active" : ""}`}
            onClick={() => setActiveTool("rect")}
            title="Marco / Rectángulo"
          >
            <Icon name="crop" width={18} height={18} />
          </button>
          <button
            type="button"
            className={`capture-tool-btn ${activeTool === "arrow" ? "is-active" : ""}`}
            onClick={() => setActiveTool("arrow")}
            title="Flecha indicadora"
          >
            <Icon name="arrow-right" width={18} height={18} />
          </button>
          <button
            type="button"
            className={`capture-tool-btn ${activeTool === "text" ? "is-active" : ""}`}
            onClick={() => setActiveTool("text")}
            title="Texto anotado"
          >
            <Icon name="file-text" width={18} height={18} />
          </button>
        </div>

        {/* Paleta de Colores */}
        <div className="capture-toolbar-group">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`capture-color-swatch ${activeColor === c ? "is-active" : ""}`}
              style={{ background: c }}
              onClick={() => setActiveColor(c)}
              title={c}
            />
          ))}
        </div>

        {/* Grosor de Trazo */}
        <div className="capture-toolbar-group">
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

        {/* Deshacer / Rehacer */}
        <div className="capture-toolbar-group">
          <button
            type="button"
            className="capture-tool-btn"
            onClick={handleUndo}
            disabled={historyIndex < 0}
            title="Deshacer (Ctrl+Z)"
          >
            <Icon name="undo" width={18} height={18} />
          </button>
          <button
            type="button"
            className="capture-tool-btn"
            onClick={handleRedo}
            disabled={historyIndex >= annotations.length - 1}
            title="Rehacer (Ctrl+Y)"
          >
            <Icon name="rotate-cw" width={18} height={18} />
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
            <Icon name="trash" width={18} height={18} />
          </button>
        </div>

        {/* Acciones Finales: Copiar y Guardar */}
        <div className="capture-toolbar-group" style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className="capture-pill-btn"
            onClick={() => void handleNewCapture()}
            title="Tomar otra captura"
          >
            <Icon name="camera" width={16} height={16} />
            <span>Nueva Captura</span>
          </button>

          <button
            type="button"
            className="capture-btn-primary"
            onClick={() => void handleCopy()}
            title="Copiar imagen al portapapeles sin guardar archivo (Ctrl+C)"
          >
            <Icon name="copy" width={16} height={16} />
            <span>Copiar (Ctrl+C)</span>
          </button>

          <button
            type="button"
            className="capture-pill-btn"
            style={{ background: "var(--surface-container-high)" }}
            onClick={() => void handleSaveAs()}
            title="Guardar archivo PNG en disco (Ctrl+S)"
          >
            <Icon name="save" width={16} height={16} />
            <span>Guardar como…</span>
          </button>
        </div>
      </div>

      {/* ── Lienzo Principal ── */}
      <div className="capture-editor-canvas-container">
        <div className="capture-canvas-wrapper">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        </div>
      </div>

      {/* ── Toast Flotante ── */}
      {toastMessage && (
        <div className="capture-editor-toast" role="status">
          <Icon name="check" width={16} height={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
