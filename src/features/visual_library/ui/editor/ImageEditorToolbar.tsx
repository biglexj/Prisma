import React from "react";
import { Icon } from "../../../../shared/ui/Icon";
import { FILTER_DEFINITIONS } from "./filterPresets";
import type {
  AspectRatioOption,
  DoodleStroke,
  EditorAdjustments,
  EditorTab,
  PhotoFilter,
} from "./editorTypes";

interface ImageEditorToolbarProps {
  activeTab: EditorTab;
  onSelectTab: (tab: EditorTab) => void;
  // Transform
  isCropActive: boolean;
  onToggleCrop: () => void;
  aspectRatio: AspectRatioOption;
  onSelectAspectRatio: (ratio: AspectRatioOption) => void;
  onRotateCw: () => void;
  onRotateCcw: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onResetTransform: () => void;
  // Filters
  activeFilter: PhotoFilter;
  filterIntensity: number;
  onSelectFilter: (filter: PhotoFilter) => void;
  onChangeFilterIntensity: (intensity: number) => void;
  // Adjustments
  adjustments: EditorAdjustments;
  onChangeAdjustments: (adjustments: EditorAdjustments) => void;
  onResetAdjustments: () => void;
  // Draw / Doodle
  isDrawing: boolean;
  onToggleDrawing: (active: boolean) => void;
  brushColor: string;
  onSelectBrushColor: (color: string) => void;
  brushWidth: number;
  onChangeBrushWidth: (width: number) => void;
  doodleStrokes: DoodleStroke[];
  onUndoStroke: () => void;
  onClearStrokes: () => void;
}

const PRESET_COLORS = [
  "#ff2a4b", // Rojo
  "#ff8400", // Naranja
  "#ffd600", // Amarillo
  "#00e676", // Verde
  "#00b0ff", // Azul
  "#d500f9", // Morado
  "#ffffff", // Blanco
  "#111111", // Negro
];

export function ImageEditorToolbar({
  activeTab,
  onSelectTab,
  // Transform
  isCropActive,
  onToggleCrop,
  aspectRatio,
  onSelectAspectRatio,
  onRotateCw,
  onRotateCcw,
  onFlipH,
  onFlipV,
  onResetTransform,
  // Filters
  activeFilter,
  filterIntensity,
  onSelectFilter,
  onChangeFilterIntensity,
  // Adjustments
  adjustments,
  onChangeAdjustments,
  onResetAdjustments,
  // Draw
  isDrawing,
  onToggleDrawing,
  brushColor,
  onSelectBrushColor,
  brushWidth,
  onChangeBrushWidth,
  doodleStrokes,
  onUndoStroke,
  onClearStrokes,
}: ImageEditorToolbarProps) {
  return (
    <div className="image-editor-toolbar-container">
      {/* Sub-panel de controles según la pestaña activa */}
      <div className="image-editor-subpanel">
        {activeTab === "transform" && (
          <div className="editor-subpanel-content transform-subpanel">
            <div className="editor-control-group">
              <button
                className={`editor-chip-btn ${isCropActive ? "is-active" : ""}`}
                onClick={onToggleCrop}
                title="Activar/Desactivar recorte"
              >
                <Icon name="crop" />
                <span>Recortar</span>
              </button>

              {isCropActive && (
                <div className="editor-ratio-chips">
                  {(["free", "1:1", "4:3", "3:4", "16:9", "9:16"] as AspectRatioOption[]).map(
                    (ratio) => (
                      <button
                        key={ratio}
                        className={`editor-mini-chip ${aspectRatio === ratio ? "is-active" : ""}`}
                        onClick={() => onSelectAspectRatio(ratio)}
                      >
                        {ratio === "free" ? "Libre" : ratio}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="editor-divider-v" />

            <div className="editor-control-group">
              <button
                className="editor-icon-btn"
                onClick={onRotateCcw}
                title="Girar 90° a la izquierda"
              >
                <Icon name="rotate-ccw" />
              </button>
              <button
                className="editor-icon-btn"
                onClick={onRotateCw}
                title="Girar 90° a la derecha"
              >
                <Icon name="rotate-cw" />
              </button>
              <button
                className="editor-icon-btn"
                onClick={onFlipH}
                title="Voltear horizontalmente"
              >
                <Icon name="flip-h" />
              </button>
              <button
                className="editor-icon-btn"
                onClick={onFlipV}
                title="Voltear verticalmente"
              >
                <Icon name="flip-v" />
              </button>
              <button
                className="editor-text-btn"
                onClick={onResetTransform}
                title="Restablecer recorte y giros"
              >
                Restablecer
              </button>
            </div>
          </div>
        )}

        {activeTab === "filters" && (
          <div className="editor-subpanel-content filters-subpanel">
            <div className="editor-filters-carousel">
              {FILTER_DEFINITIONS.map((def) => (
                <button
                  key={def.id}
                  className={`editor-filter-card ${activeFilter === def.id ? "is-active" : ""}`}
                  onClick={() => onSelectFilter(def.id)}
                >
                  <span className="filter-card-preview" data-filter={def.id} />
                  <span className="filter-card-label">{def.label}</span>
                </button>
              ))}
            </div>

            {activeFilter !== "none" && (
              <div className="editor-slider-row">
                <span className="editor-slider-label">Intensidad</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={filterIntensity}
                  onChange={(e) => onChangeFilterIntensity(parseFloat(e.target.value))}
                  className="editor-slider"
                />
                <span className="editor-slider-value">{Math.round(filterIntensity * 100)}%</span>
              </div>
            )}
          </div>
        )}

        {activeTab === "adjust" && (
          <div className="editor-subpanel-content adjust-subpanel">
            <div className="editor-adjust-grid">
              <div className="editor-slider-row">
                <span className="editor-slider-label">Brillo</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.brightness}
                  onChange={(e) =>
                    onChangeAdjustments({
                      ...adjustments,
                      brightness: parseInt(e.target.value, 10),
                    })
                  }
                  className="editor-slider"
                />
                <span className="editor-slider-value">{adjustments.brightness}</span>
              </div>

              <div className="editor-slider-row">
                <span className="editor-slider-label">Contraste</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.contrast}
                  onChange={(e) =>
                    onChangeAdjustments({
                      ...adjustments,
                      contrast: parseInt(e.target.value, 10),
                    })
                  }
                  className="editor-slider"
                />
                <span className="editor-slider-value">{adjustments.contrast}</span>
              </div>

              <div className="editor-slider-row">
                <span className="editor-slider-label">Saturación</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.saturation}
                  onChange={(e) =>
                    onChangeAdjustments({
                      ...adjustments,
                      saturation: parseInt(e.target.value, 10),
                    })
                  }
                  className="editor-slider"
                />
                <span className="editor-slider-value">{adjustments.saturation}</span>
              </div>

              <div className="editor-slider-row">
                <span className="editor-slider-label">Desenfoque</span>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={adjustments.blur}
                  onChange={(e) =>
                    onChangeAdjustments({
                      ...adjustments,
                      blur: parseInt(e.target.value, 10),
                    })
                  }
                  className="editor-slider"
                />
                <span className="editor-slider-value">{adjustments.blur}px</span>
              </div>
            </div>

            <button className="editor-text-btn" onClick={onResetAdjustments}>
              Restablecer ajustes
            </button>
          </div>
        )}

        {activeTab === "draw" && (
          <div className="editor-subpanel-content draw-subpanel">
            <div className="editor-control-group">
              <button
                className={`editor-chip-btn ${isDrawing ? "is-active" : ""}`}
                onClick={() => onToggleDrawing(!isDrawing)}
                title="Pincel libre"
              >
                <Icon name="brush" />
                <span>Pincel</span>
              </button>

              <div className="editor-palette-swatches">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`editor-color-swatch ${brushColor === color ? "is-selected" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => onSelectBrushColor(color)}
                    title={`Color ${color}`}
                  />
                ))}
                <label className="editor-color-picker-label" title="Color personalizado">
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => onSelectBrushColor(e.target.value)}
                    className="editor-color-native-input"
                  />
                  <Icon name="palette" />
                </label>
              </div>

              <div className="editor-slider-row brush-size-row">
                <span className="editor-slider-label">Grosor</span>
                <input
                  type="range"
                  min="2"
                  max="36"
                  value={brushWidth}
                  onChange={(e) => onChangeBrushWidth(parseInt(e.target.value, 10))}
                  className="editor-slider"
                />
                <span className="editor-slider-value">{brushWidth}px</span>
              </div>

              <div className="editor-divider-v" />

              <button
                className="editor-icon-btn"
                onClick={onUndoStroke}
                disabled={doodleStrokes.length === 0}
                title="Deshacer último trazo (Ctrl+Z)"
              >
                <Icon name="undo" />
              </button>
              <button
                className="editor-icon-btn is-danger"
                onClick={onClearStrokes}
                disabled={doodleStrokes.length === 0}
                title="Limpiar todos los trazos"
              >
                <Icon name="trash" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pestañas principales de navegación */}
      <div className="image-editor-main-tabs">
        <button
          className={`editor-tab-btn ${activeTab === "transform" ? "is-active" : ""}`}
          onClick={() => onSelectTab("transform")}
        >
          <Icon name="crop" />
          <span>Transformar</span>
        </button>

        <button
          className={`editor-tab-btn ${activeTab === "filters" ? "is-active" : ""}`}
          onClick={() => onSelectTab("filters")}
        >
          <Icon name="sparkles" />
          <span>Filtros</span>
        </button>

        <button
          className={`editor-tab-btn ${activeTab === "adjust" ? "is-active" : ""}`}
          onClick={() => onSelectTab("adjust")}
        >
          <Icon name="sliders" />
          <span>Ajustes</span>
        </button>

        <button
          className={`editor-tab-btn ${activeTab === "draw" ? "is-active" : ""}`}
          onClick={() => onSelectTab("draw")}
        >
          <Icon name="brush" />
          <span>Dibujar</span>
        </button>
      </div>
    </div>
  );
}
