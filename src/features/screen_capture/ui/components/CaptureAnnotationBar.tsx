import { Icon } from "../../../../shared/ui/Icon";
import type { AnnotationTool } from "../../model/types";
import { ANNOTATION_KEYS, CAPTURE_PALETTE, CAPTURE_STROKE_WIDTHS } from "../../model/captureControls";

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
      <div className="capture-toolbar-subgroup" aria-label="Dibujo y texto">
        {([
          ["pen", "Lápiz libre", "m4 16 12-12 4 4L8 20H4v-4Zm10-10 4 4"],
          ["highlighter", "Resaltador translúcido", "m5 13 9-9 6 6-9 9-6-6Zm0 0-2 5 3 3 5-2M3 22h14"],
          ["text", "Texto anotado", "M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3"],
        ] as const).map(([tool, label, path]) => (
          <button key={tool} type="button" className={`capture-tool-btn ${activeTool === tool ? "is-active" : ""}`}
            onClick={() => setActiveTool(tool)} title={`${label} (${ANNOTATION_KEYS[tool]})`} aria-label={label} aria-keyshortcuts={ANNOTATION_KEYS[tool]} aria-pressed={activeTool === tool}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
          </button>
        ))}
      </div>
      <div className="capture-pill-divider" />
      <div className="capture-toolbar-subgroup" aria-label="Formas">
        {([
          ["arrow", "Flecha indicadora"], ["rect", "Marco rectangular (Mayús: cuadrado)"], ["ellipse", "Círculo / elipse (Mayús: círculo)"],
        ] as const).map(([tool, label]) => (
          <button key={tool} type="button" className={`capture-tool-btn ${activeTool === tool ? "is-active" : ""}`}
            onClick={() => setActiveTool(tool)} title={`${label} · ${ANNOTATION_KEYS[tool]}`} aria-label={label} aria-keyshortcuts={ANNOTATION_KEYS[tool]} aria-pressed={activeTool === tool}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {tool === "arrow" ? <path d="M4 20 20 4M9 4h11v11" /> : tool === "rect" ? <rect x="4" y="5" width="16" height="14" rx="1" /> : <circle cx="12" cy="12" r="8" />}
            </svg>
          </button>
        ))}
      </div>

      <div className="capture-pill-divider" />

      {/* Paleta con #00C9B9 en 1er lugar */}
      <div className="capture-toolbar-subgroup">
        {CAPTURE_PALETTE.map(({ color, name }, index) => (
          <button
            key={color}
            type="button"
            className={`capture-color-swatch ${activeColor === color ? "is-active" : ""}`}
            style={{ background: color }}
            onClick={() => setActiveColor(color)}
            title={`${name} (${color}) · ${index + 1}`}
            aria-label={`${name} (${color})`}
            aria-keyshortcuts={String(index + 1)}
            aria-pressed={activeColor === color}
          />
        ))}
      </div>

      <div className="capture-pill-divider" />

      {/* Grosor de trazo */}
      <div className="capture-toolbar-subgroup">
        {CAPTURE_STROKE_WIDTHS.map((w, index) => (
          <button
            key={w}
            type="button"
            className={`capture-tool-btn ${strokeWidth === w ? "is-active" : ""}`}
            onClick={() => setStrokeWidth(w)}
            title={`Grosor: ${w}px (Mayús+${index + 1})`}
            aria-label={`Grosor: ${w}px`}
            aria-keyshortcuts={`Shift+${index + 1}`}
            aria-pressed={strokeWidth === w}
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
          title="Limpiar todas las anotaciones (Supr)"
          aria-label="Limpiar todas las anotaciones"
          aria-keyshortcuts="Delete"
        >
          <Icon name="trash" width={16} height={16} />
        </button>
        <button
          type="button"
          className="capture-tool-btn"
          onClick={onRetrySelection}
          title="Volver a seleccionar área (N)"
          aria-label="Volver a seleccionar área"
          aria-keyshortcuts="N"
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
          title="Guardar captura en disco (Ctrl+S)"
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
