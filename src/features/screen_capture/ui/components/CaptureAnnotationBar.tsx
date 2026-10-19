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
  canClear?: boolean;
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
  canClear = true,
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
        <button
          type="button"
          className={`capture-tool-btn ${activeTool === "eyedropper" ? "is-active" : ""}`}
          onClick={() => setActiveTool("eyedropper")}
          title="Selector de color / Cuentagotas (Copiar Hexadecimal #HEX)"
        >
          <Icon name="pipette" width={17} height={17} />
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
        {STROKE_WIDTHS.map((w) => (
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

      {/* Deshacer / Rehacer / Limpiar / Reintentar */}
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
          className="capture-tool-btn"
          onClick={onClear}
          disabled={!canClear}
          title="Limpiar todas las anotaciones"
        >
          <Icon name="trash" width={16} height={16} />
        </button>
        <button
          type="button"
          className="capture-tool-btn"
          onClick={onRetrySelection}
          title="Volver a seleccionar área"
        >
          <Icon name="refresh" width={16} height={16} />
        </button>
      </div>

      <div className="capture-pill-divider" />

      {/* Acciones Finales: Copiar, Guardar, Cerrar */}
      <div className="capture-toolbar-subgroup">
        <button
          type="button"
          className="capture-btn-primary"
          onClick={onCopy}
          title="Copiar imagen al portapapeles sin tocar disco (Ctrl+C / Enter)"
        >
          <Icon name="copy" width={15} height={15} />
          <span>Copiar</span>
        </button>

        <button
          type="button"
          className="capture-pill-btn"
          style={{ background: "rgba(255, 255, 255, 0.12)" }}
          onClick={onSaveAs}
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
