import React, { useState } from "react";
import type { ClipColor, TakeStatus, VideoTakeMarker } from "../../model/types";
import {
  DAVINCI_CLIP_COLORS,
  TAKE_STATUS_DEFS,
  getClipColorHex,
} from "../../model/davinciColors";
import { Icon } from "../../../../shared/ui/Icon";
import "./video-technical-hud.css";

interface VideoTakeClassificationBarProps {
  marker?: VideoTakeMarker;
  onSelectStatus: (status: TakeStatus) => void;
  onSelectColor: (color: ClipColor) => void;
  onToggleHud?: () => void;
  hudVisible?: boolean;
}

export const VideoTakeClassificationBar: React.FC<VideoTakeClassificationBarProps> = ({
  marker,
  onSelectStatus,
  onSelectColor,
  onToggleHud,
  hudVisible,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const currentStatus = marker?.status || "pending";
  const currentColor = marker?.clip_color;
  const colorHex = getClipColorHex(currentColor);

  return (
    <div className="video-take-bar" onClick={(e) => e.stopPropagation()}>
      {/* Botón 1: Buena Toma */}
      <button
        type="button"
        className={`take-pill-btn ${currentStatus === "good_take" ? "active-good" : ""}`}
        onClick={() => onSelectStatus(currentStatus === "good_take" ? "pending" : "good_take")}
        title="Marcar como Buena Toma (Tecla 1)"
      >
        <Icon name="check" width={13} height={13} />
        <span>Buena Toma</span>
        <span className="take-pill-kbd">1</span>
      </button>

      {/* Botón 2: Descarte */}
      <button
        type="button"
        className={`take-pill-btn ${currentStatus === "reject" ? "active-reject" : ""}`}
        onClick={() => onSelectStatus(currentStatus === "reject" ? "pending" : "reject")}
        title="Marcar como Descarte (Tecla 2)"
      >
        <Icon name="close" width={13} height={13} />
        <span>Descarte</span>
        <span className="take-pill-kbd">2</span>
      </button>

      {/* Botón 3: B-Roll */}
      <button
        type="button"
        className={`take-pill-btn ${currentStatus === "b_roll" ? "active-broll" : ""}`}
        onClick={() => onSelectStatus(currentStatus === "b_roll" ? "pending" : "b_roll")}
        title="Marcar como B-Roll (Tecla 3)"
      >
        <Icon name="film" width={13} height={13} />
        <span>B-Roll</span>
        <span className="take-pill-kbd">3</span>
      </button>

      {/* Botón 0: Limpiar (visible solo si está marcado) */}
      {currentStatus !== "pending" && (
        <button
          type="button"
          className="take-pill-btn"
          style={{ padding: "4px 8px" }}
          onClick={() => onSelectStatus("pending")}
          title="Quitar marca de toma (Tecla 0)"
        >
          <Icon name="rotate-ccw" width={12} height={12} />
          <span className="take-pill-kbd">0</span>
        </button>
      )}

      {/* Separador vertical sutil */}
      <div style={{ width: 1, height: 18, background: "rgba(255, 255, 255, 0.15)", margin: "0 2px" }} />

      {/* Selector de Color DaVinci Resolve */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="davinci-color-trigger"
          style={{
            backgroundColor: colorHex || "transparent",
            backgroundImage: !colorHex
              ? "conic-gradient(#f97316, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ec4899, #f97316)"
              : undefined,
          }}
          onClick={() => setShowColorPicker(!showColorPicker)}
          title={`Color de Clip DaVinci (${currentColor || "Sin color"})`}
        />

        {showColorPicker && (
          <div className="davinci-color-picker-popover">
            {DAVINCI_CLIP_COLORS.map((col) => (
              <div
                key={col.id}
                className={`davinci-swatch-item ${currentColor === col.id ? "selected" : ""}`}
                style={{ backgroundColor: col.hex }}
                onClick={() => {
                  onSelectColor(currentColor === col.id ? "none" : col.id);
                  setShowColorPicker(false);
                }}
                title={col.label}
              />
            ))}
          </div>
        )}
      </div>

      {/* Botón para alternar Ficha Técnica HUD */}
      {onToggleHud && (
        <button
          type="button"
          className={`take-pill-btn ${hudVisible ? "active-good" : ""}`}
          style={{ padding: "4px 8px" }}
          onClick={onToggleHud}
          title="Alternar Ficha Técnica HUD (Tecla I)"
        >
          <Icon name="info" width={13} height={13} />
          <span className="take-pill-kbd">I</span>
        </button>
      )}
    </div>
  );
};
