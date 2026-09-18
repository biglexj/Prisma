import React from "react";
import { Icon } from "../../../shared/ui/Icon";
import type { ComparisonMode } from "../model/types";

interface ImageComparisonTopBarProps {
  mode: ComparisonMode;
  setMode: (mode: ComparisonMode) => void;
  splitOrientation: "horizontal" | "vertical";
  setSplitOrientation: React.Dispatch<React.SetStateAction<"horizontal" | "vertical">>;
  syncZoom: boolean;
  setSyncZoom: React.Dispatch<React.SetStateAction<boolean>>;
  slotsCount: number;
  hasVideos: boolean;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  handleSwapPrimary: () => void;
  handleResetZoom: () => void;
  setIsAddingNewSlot: (adding: boolean) => void;
  onClose: () => void;
  embedded?: boolean;
}

export const ImageComparisonTopBar: React.FC<ImageComparisonTopBarProps> = ({
  mode,
  setMode,
  splitOrientation,
  setSplitOrientation,
  syncZoom,
  setSyncZoom,
  slotsCount,
  hasVideos,
  isFullscreen,
  toggleFullscreen,
  handleSwapPrimary,
  handleResetZoom,
  setIsAddingNewSlot,
  onClose,
  embedded = false,
}) => {
  return (
    <header className="img-compare-top-bar" onClick={(e) => e.stopPropagation()}>
      <div className="img-compare-top-left">
        <button
          type="button"
          className="img-compare-btn is-icon"
          onClick={onClose}
          title={embedded ? "Volver al Inicio" : "Volver al visor (Esc)"}
        >
          <Icon name="arrow-left" />
        </button>
        <div className="img-compare-badge-title">
          <Icon name={hasVideos ? "video" : "compare"} />
          <span>
            {hasVideos ? "Comparador Multimedia" : "Comparador"} ({slotsCount} elemento{slotsCount === 1 ? "" : "s"})
          </span>
        </div>

        {/* Mode Switcher */}
        <div className="img-compare-mode-pills">
          <button
            type="button"
            className={`img-compare-pill ${mode === "split" ? "is-active" : ""}`}
            onClick={() => setMode("split")}
            title="Lado a lado (1)"
          >
            <Icon name="columns" />
            <span>Lado a lado</span>
          </button>
          <button
            type="button"
            className={`img-compare-pill ${mode === "curtain" ? "is-active" : ""}`}
            onClick={() => {
              if (slotsCount < 2) {
                setIsAddingNewSlot(true);
                return;
              }
              setMode("curtain");
            }}
            title={slotsCount < 2 ? "Añade un segundo elemento para usar cortinilla (2)" : "Cortinilla interactiva antes/después (2)"}
          >
            <Icon name="split" />
            <span>Cortinilla</span>
          </button>
          <button
            type="button"
            className={`img-compare-pill ${mode === "grid" ? "is-active" : ""}`}
            onClick={() => setMode("grid")}
            title="Cuadrícula multi-elemento (3)"
          >
            <Icon name="grid" />
            <span>Cuadrícula</span>
          </button>
          <button
            type="button"
            className={`img-compare-pill ${mode === "flick" ? "is-active" : ""}`}
            onClick={() => {
              if (slotsCount < 2) {
                setIsAddingNewSlot(true);
                return;
              }
              setMode("flick");
            }}
            title={slotsCount < 2 ? "Añade un segundo elemento para alternar A/B (4)" : "Alternar rápido A/B (4)"}
          >
            <Icon name="sparkles" />
            <span>Alternar A/B</span>
          </button>
        </div>
      </div>

      <div className="img-compare-top-right">
        {mode === "split" && (
          <button
            type="button"
            className="img-compare-btn"
            onClick={() =>
              setSplitOrientation((prev) =>
                prev === "horizontal" ? "vertical" : "horizontal",
              )
            }
            title="Alternar orientación vertical / horizontal"
          >
            <Icon name="aspect-ratio" />
            <span>{splitOrientation === "horizontal" ? "Vertical" : "Horizontal"}</span>
          </button>
        )}

        <button
          type="button"
          className={`img-compare-btn ${syncZoom ? "is-active" : ""}`}
          onClick={() => setSyncZoom((prev) => !prev)}
          title={syncZoom ? "Zoom y desplazamiento sincronizado activo" : "Activar zoom sincronizado"}
        >
          <Icon name="link" />
          <span>Sincronizar Zoom</span>
        </button>

        <button
          type="button"
          className="img-compare-btn"
          onClick={handleSwapPrimary}
          title="Intercambiar elementos A ↔ B (S)"
        >
          <Icon name="shuffle" />
          <span>Intercambiar</span>
        </button>

        <button
          type="button"
          className="img-compare-btn"
          onClick={handleResetZoom}
          title="Restablecer zoom normal (R)"
        >
          <Icon name="fit-screen" />
          <span>100%</span>
        </button>

        {slotsCount < 6 && (
          <button
            type="button"
            className="img-compare-btn is-accent"
            onClick={() => setIsAddingNewSlot(true)}
            title="Añadir otro elemento a la comparativa (hasta 6 elementos)"
          >
            <Icon name="plus" />
            <span>Añadir archivo</span>
          </button>
        )}

        <button
          type="button"
          className="img-compare-btn is-icon"
          onClick={toggleFullscreen}
          title="Pantalla completa (F)"
        >
          <Icon name={isFullscreen ? "fullscreen-exit" : "fullscreen"} />
        </button>

        <button
          type="button"
          className="img-compare-btn is-icon"
          onClick={onClose}
          title="Cerrar comparativa (Esc)"
        >
          <Icon name="close" />
        </button>
      </div>
    </header>
  );
};
