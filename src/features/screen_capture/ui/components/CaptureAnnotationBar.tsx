import { Icon } from "../../../../shared/ui/Icon";
import type { AnnotationTool } from "../../model/types";

const PALETTE = ["#00C9B9", "#FF5252", "#FFD600", "#4CAF50", "#2196F3", "#FFFFFF", "#212121"];
const STROKE_WIDTHS = [2, 4, 8];

interface CaptureAnnotationBarProps {
  activeTool: AnnotationTool;
  setActiveTool: (tool: AnnotationTool) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
  onRetrySelection: () => void;
  onCopy: () => void;
  onSaveAs: () => void;
  onCancel?: () => void;
}

export function CaptureAnnotationBar({
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  strokeWidth,
  setStrokeWidth,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
  onRetrySelection,
  onCopy,
  onSaveAs,
  onCancel,
}: CaptureAnnotationBarProps) {
  return (
    <div
      className="capture-annotation-floating-bar"
      role="toolbar"
      aria-label="Herramientas de anotación"
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
          <Icon name="brush" width={16} height={16} />
        </button>
        <button
          type="button"
          className={`capture-tool-btn ${activeTool === "highlighter" ? "is-active" : ""}`}
          onClick={() => setActiveTool("highlighter")}
          title="Resaltador translúcido"
        >
          <Icon name="sliders" width={16} height={16} />
        </button>
        <button
          type="button"
          className={`capture-tool-btn ${activeTool === "arrow" ? "is-active" : ""}`}
          onClick={() => setActiveTool("arrow")}
          title="Flecha direccional"
        >
          <Icon name="arrow-right" width={16} height={16} />
        </button>
        <button
          type="button"
          className={`capture-tool-btn ${activeTool === "rect" ? "is-active" : ""}`}
          onClick={() => setActiveTool("rect")}
          title="Rectángulo hueco"
        >
          <Icon name="crop" width={16} height={16} />
        </button>
        <button
          type="button"
          className={`capture-tool-btn ${activeTool === "text" ? "is-active" : ""}`}
          onClick={() => setActiveTool("text")}
          title="Texto"
        >
          <Icon name="file-text" width={16} height={16} />
        </button>
      </div>

      <div className="capture-pill-divider" />

      {/* Paleta de Colores */}
      <div className="capture-toolbar-subgroup">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            className={`capture-color-dot ${activeColor === c ? "is-active" : ""}`}
            style={{ background: c }}
            onClick={() => setActiveColor(c)}
            title={c === "#00C9B9" ? "Color Insignia Prisma (Predeterminado)" : c}
          />
        ))}
      </div>

      <div className="capture-pill-divider" />

      {/* Selector de Grosor */}
      <div className="capture-toolbar-subgroup">
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            className={`capture-stroke-btn ${strokeWidth === w ? "is-active" : ""}`}
            onClick={() => setStrokeWidth(w)}
            title={`Grosor: ${w}px`}
          >
            <span
              className="capture-stroke-indicator"
              style={{
                width: `${w * 2 + 2}px`,
                height: `${w * 2 + 2}px`,
              }}
            />
          </button>
        ))}
      </div>

      <div className="capture-pill-divider" />

      {/* Deshacer, Rehacer, Borrar */}
      <div className="capture-toolbar-subgroup">
        <button
          type="button"
          className="capture-tool-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Deshacer (Ctrl+Z)"
        >
          <Icon name="undo" width={16} height={16} />
        </button>
        <button
          type="button"
          className="capture-tool-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Rehacer (Ctrl+Mayús+Z / Ctrl+Y)"
        >
          <Icon name="rotate-cw" width={16} height={16} />
        </button>
        <button
          type="button"
          className="capture-tool-btn is-cancel"
          onClick={onClear}
          title="Limpiar todas las anotaciones"
        >
          <Icon name="broom" width={16} height={16} />
        </button>
        <button
          type="button"
          className="capture-tool-btn"
          onClick={onRetrySelection}
          title="Reintentar selección de área"
        >
          <Icon name="refresh" width={16} height={16} />
        </button>
      </div>

      <div className="capture-pill-divider" />

      {/* Acciones Finales: Copiar y Guardar */}
      <div className="capture-toolbar-subgroup">
        <button
          type="button"
          className="capture-pill-btn is-active"
          onClick={onCopy}
          title="Copiar imagen al portapapeles sin tocar disco (Ctrl+C / Enter)"
        >
          <Icon name="copy" width={15} height={15} />
          <span>Copiar</span>
        </button>
        <button
          type="button"
          className="capture-pill-btn"
          onClick={onSaveAs}
          style={{ background: "rgba(255, 255, 255, 0.12)" }}
          title="Guardar como archivo PNG en disco (Ctrl+S)"
        >
          <Icon name="save" width={15} height={15} />
          <span>Guardar</span>
        </button>

        {onCancel && (
          <button
            type="button"
            className="capture-tool-btn is-cancel"
            onClick={onCancel}
            title="Cerrar y descartar (Esc)"
          >
            <Icon name="close" width={15} height={15} />
          </button>
        )}
      </div>
    </div>
  );
}
