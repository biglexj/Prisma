import { useEffect, useState, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Icon } from "../../../shared/ui/Icon";
import type {
  CaptureMode,
  CaptureSessionInit,
  DetectedTarget,
  MonitorTarget,
  RectSelection,
} from "../model/types";
import { screenCaptureClient } from "../services/screenCaptureClient";
import "./screen-capture.css";

export function ScreenCaptureOverlay() {
  const [session, setSession] = useState<CaptureSessionInit | null>(null);
  const [mode, setMode] = useState<CaptureMode>("window");
  const [activeTarget, setActiveTarget] = useState<DetectedTarget | null>(null);
  const [subregionTarget, setSubregionTarget] = useState<DetectedTarget | null>(null);
  const [useSubregion, setUseSubregion] = useState(false);
  const [activeMonitor, setActiveMonitor] = useState<MonitorTarget | null>(null);

  // Estados para modo Rectángulo
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<RectSelection | null>(null);
  const [activeResizeHandle, setActiveResizeHandle] = useState<string | null>(null);

  // Referencias para evitar desincronizaciones de eventos
  const sessionRef = useRef<CaptureSessionInit | null>(null);
  sessionRef.current = session;
  const modeRef = useRef<CaptureMode>(mode);
  modeRef.current = mode;

  // Escuchar inicio de sesión desde Rust o hotkey global
  useEffect(() => {
    const unlistenPromise = listen<CaptureSessionInit>(
      "screen_capture://session-started",
      (event) => {
        if (event.payload) {
          setSession(event.payload);
          setMode(event.payload.defaultMode || "window");
          setActiveTarget(null);
          setSubregionTarget(null);
          setUseSubregion(false);
          setSelectionRect(null);
        }
      }
    );

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Cancelar captura
  const handleCancel = useCallback(async () => {
    try {
      await screenCaptureClient.cancelCapture();
    } catch {
      // Ignorar error al cancelar
    }
  }, []);

  // Confirmar captura del rectángulo seleccionado
  const handleConfirm = useCallback(
    async (rect: RectSelection) => {
      if (rect.width <= 2 || rect.height <= 2) return;
      try {
        await screenCaptureClient.confirmCapture(rect);
      } catch (err) {
        console.error("Error al confirmar captura:", err);
      }
    },
    []
  );

  // Manejo de teclado (Esc para cancelar, Enter para confirmar en Rectángulo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void handleCancel();
      } else if (e.key === "Enter" && modeRef.current === "rect" && selectionRect) {
        e.preventDefault();
        void handleConfirm(selectionRect);
      } else if (e.key === "Tab" && modeRef.current === "window") {
        e.preventDefault();
        setUseSubregion((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel, handleConfirm, selectionRect]);

  // Manejo de movimiento del cursor sobre la pantalla
  const handleMouseMove = useCallback(
    async (e: React.MouseEvent) => {
      const sess = sessionRef.current;
      const currentMode = modeRef.current;

      // Coordenadas absolutas de pantalla virtual
      const screenX = e.screenX;
      const screenY = e.screenY;

      if (currentMode === "window" && sess) {
        // Encontrar ventana bajo el cursor
        const found = sess.targets.find(
          (t) =>
            screenX >= t.x &&
            screenX <= t.x + t.width &&
            screenY >= t.y &&
            screenY <= t.y + t.height
        );

        if (found) {
          setActiveTarget(found);
          // Consultar subelemento hijo si procede
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
          // Ajuste fino con tiradores
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
    [isDragging, dragStart, activeResizeHandle, selectionRect]
  );

  // Manejo de inicio de arrastre en Rectángulo
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Solo clic izquierdo
    if (mode === "rect") {
      if (!activeResizeHandle) {
        setIsDragging(true);
        setDragStart({ x: e.screenX, y: e.screenY });
        setSelectionRect(null);
      }
    }
  };

  const handleMouseUp = () => {
    if (mode === "rect") {
      setIsDragging(false);
      setActiveResizeHandle(null);
    }
  };

  // Clic de confirmación
  const handleClick = (e: React.MouseEvent) => {
    // Si se hizo clic en la barra de herramientas superior, ignorar
    if ((e.target as HTMLElement).closest(".capture-floating-toolbar")) return;
    if ((e.target as HTMLElement).closest(".capture-resize-handle")) return;

    if (mode === "window") {
      const target = useSubregion && subregionTarget ? subregionTarget : activeTarget;
      if (target) {
        void handleConfirm({
          x: target.x,
          y: target.y,
          width: target.width,
          height: target.height,
        });
      }
    } else if (mode === "fullscreen" && activeMonitor) {
      void handleConfirm({
        x: activeMonitor.x,
        y: activeMonitor.y,
        width: activeMonitor.width,
        height: activeMonitor.height,
      });
    }
  };

  // Rueda del ratón para alternar entre ventana completa y región hija
  const handleWheel = (e: React.WheelEvent) => {
    if (mode === "window" && subregionTarget) {
      e.preventDefault();
      setUseSubregion((prev) => !prev);
    }
  };

  // Objetivo visible a dibujar en pantalla
  const displayedTarget =
    mode === "window"
      ? useSubregion && subregionTarget
        ? subregionTarget
        : activeTarget
      : null;

  return (
    <div
      className="capture-overlay-container"
      onMouseMove={(e) => void handleMouseMove(e)}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onWheel={handleWheel}
      role="presentation"
    >
      {/* ── Barra Flotante Superior de Modos ── */}
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

      {/* ── Resaltado en Modo Ventana ── */}
      {mode === "window" && displayedTarget && (
        <div
          className="capture-target-box"
          style={{
            left: `${displayedTarget.x}px`,
            top: `${displayedTarget.y}px`,
            width: `${displayedTarget.width}px`,
            height: `${displayedTarget.height}px`,
          }}
        >
          <div
            className={`capture-target-badge ${
              displayedTarget.y < 35 ? "is-flipped" : ""
            }`}
          >
            {displayedTarget.width} × {displayedTarget.height} px
            {displayedTarget.title ? ` · ${displayedTarget.title.slice(0, 32)}` : ""}
            {subregionTarget ? " (Gira la rueda para alternar región)" : ""}
          </div>
        </div>
      )}

      {/* ── Resaltado en Modo Pantalla Completa ── */}
      {mode === "fullscreen" && activeMonitor && (
        <div
          className="capture-target-box"
          style={{
            left: `${activeMonitor.x}px`,
            top: `${activeMonitor.y}px`,
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
      {mode === "rect" && selectionRect && (
        <div
          className="capture-target-box"
          style={{
            left: `${selectionRect.x}px`,
            top: `${selectionRect.y}px`,
            width: `${selectionRect.width}px`,
            height: `${selectionRect.height}px`,
            pointerEvents: "auto",
          }}
          onDoubleClick={() => void handleConfirm(selectionRect)}
        >
          <div
            className={`capture-target-badge ${
              selectionRect.y < 35 ? "is-flipped" : ""
            }`}
          >
            {selectionRect.width} × {selectionRect.height} px · Doble clic o Enter para capturar
          </div>

          {/* Tiradores en los 8 puntos cardinales */}
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
    </div>
  );
}
