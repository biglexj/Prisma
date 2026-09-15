import { useState, useRef, useCallback, useEffect } from "react";
import { Icon } from "../../../shared/ui/Icon";
import "./upscale-comparison.css";

interface UpscaleComparisonSliderProps {
  originalUrl: string;
  upscaledUrl: string;
  originalPath: string;
  upscaledPath: string;
  scale: number;
  modelName: string;
  durationSecs: number;
  onOpenFolder: () => void;
  onClear: () => void;
}

type ViewMode = "split" | "upscaled" | "original";

export function UpscaleComparisonSlider({
  originalUrl,
  upscaledUrl,
  originalPath,
  upscaledPath,
  scale,
  modelName,
  durationSecs,
  onOpenFolder,
  onClear,
}: UpscaleComparisonSliderProps) {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [origDimensions, setOrigDimensions] = useState<{ w: number; h: number } | null>(null);
  const [upscaledDimensions, setUpscaledDimensions] = useState<{ w: number; h: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPos(percentage);
    },
    []
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (viewMode !== "split") return;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    handlePointerMove(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  const handlePointerMoveEvent = (e: React.PointerEvent) => {
    if (isDragging && viewMode === "split") {
      handlePointerMove(e.clientX);
    }
  };

  // Teclado para accesibilidad
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (viewMode !== "split") return;
    if (e.key === "ArrowLeft") {
      setSliderPos((prev) => Math.max(0, prev - 5));
    } else if (e.key === "ArrowRight") {
      setSliderPos((prev) => Math.min(100, prev + 5));
    }
  };

  // Limpiar arrastre si el puntero se pierde
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener("pointerup", handleGlobalMouseUp);
    return () => window.removeEventListener("pointerup", handleGlobalMouseUp);
  }, []);

  const filename = upscaledPath.split(/[\\/]/).pop() || "imagen_upscaled";

  return (
    <div className="upscale-comparison-widget">
      {/* ── Barra Superior de Modos de Vista y Acciones ── */}
      <div className="comparison-toolbar">
        <div className="comparison-modes-group">
          <button
            type="button"
            className={`comparison-mode-btn ${viewMode === "split" ? "active" : ""}`}
            onClick={() => setViewMode("split")}
            title="Dividir pantalla con deslizador interactivo"
          >
            <Icon name="columns" />
            <span>Antes / Después</span>
          </button>
          <button
            type="button"
            className={`comparison-mode-btn ${viewMode === "upscaled" ? "active" : ""}`}
            onClick={() => setViewMode("upscaled")}
            title="Ver imagen escalada completa"
          >
            <Icon name="sparkles" />
            <span>Escalada ({scale}x)</span>
          </button>
          <button
            type="button"
            className={`comparison-mode-btn ${viewMode === "original" ? "active" : ""}`}
            onClick={() => setViewMode("original")}
            title="Ver imagen original"
          >
            <Icon name="image" />
            <span>Original</span>
          </button>
        </div>

        <div className="comparison-actions-right">
          <button
            type="button"
            className="comparison-action-btn primary"
            onClick={onOpenFolder}
            title="Abrir ubicación del archivo escalado en el explorador"
          >
            <Icon name="folder-open" />
            <span>Abrir en Carpeta</span>
          </button>
          <button
            type="button"
            className="comparison-action-btn secondary"
            onClick={onClear}
            title="Cargar otra imagen para procesar"
          >
            <Icon name="refresh" />
            <span>Nueva Imagen</span>
          </button>
        </div>
      </div>

      {/* ── Contenedor Interactivo de Comparación ── */}
      <div
        ref={containerRef}
        className={`comparison-viewport ${isDragging ? "is-dragging" : ""} mode-${viewMode}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMoveEvent}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label="Comparación antes y después del escalado neuronal"
      >
        {/* Imagen Escalada (Capas de fondo en split o completa en viewMode upscaled) */}
        {(viewMode === "split" || viewMode === "upscaled") && (
          <div className="comparison-layer upscaled-layer">
            <img
              src={upscaledUrl}
              alt="Imagen escalada con IA"
              className="comparison-image"
              onLoad={(e) => {
                const img = e.currentTarget;
                setUpscaledDimensions({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
            <span className="comparison-layer-tag tag-after">
              <Icon name="sparkles" />
              <span>Después · {scale}x</span>
            </span>
          </div>
        )}

        {/* Imagen Original (Superpuesta con clip-path en split o completa en viewMode original) */}
        {(viewMode === "split" || viewMode === "original") && (
          <div
            className="comparison-layer original-layer"
            style={
              viewMode === "split"
                ? { clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }
                : undefined
            }
          >
            <img
              src={originalUrl}
              alt="Imagen original previa al escalado"
              className="comparison-image"
              onLoad={(e) => {
                const img = e.currentTarget;
                setOrigDimensions({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
            <span className="comparison-layer-tag tag-before">
              <Icon name="image" />
              <span>Antes · Original</span>
            </span>
          </div>
        )}

        {/* Línea Divisoria y Agarrador Deslizante (Solo en modo split) */}
        {viewMode === "split" && (
          <div
            className="comparison-divider"
            style={{ left: `${sliderPos}%` }}
            title="Arrastra para comparar antes y después"
          >
            <div className="comparison-divider-line" />
            <div className="comparison-handle">
              <Icon name="chevron-left" />
              <Icon name="chevron-right" />
            </div>
            <div className="comparison-divider-line" />
          </div>
        )}
      </div>

      {/* ── Barra de Métricas y Estado Pos-Inferencia ── */}
      <div className="comparison-footer-metrics">
        <div className="metrics-left">
          <span className="metric-chip success">
            <Icon name="check" />
            <span>Escalado Exitoso</span>
          </span>
          <span className="metric-chip">
            <Icon name="clock" />
            <span>{durationSecs.toFixed(2)}s</span>
          </span>
          <span className="metric-chip highlight">
            <Icon name="sparkles" />
            <span>{modelName}</span>
          </span>
        </div>

        <div className="metrics-right">
          {origDimensions && upscaledDimensions ? (
            <span className="dimensions-pill">
              <span className="dim-orig">{origDimensions.w}×{origDimensions.h}</span>
              <span className="dim-arrow">→</span>
              <span className="dim-upscaled">{upscaledDimensions.w}×{upscaledDimensions.h} ({scale}x)</span>
            </span>
          ) : (
            <span className="dimensions-filename" title={filename}>
              {filename}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
