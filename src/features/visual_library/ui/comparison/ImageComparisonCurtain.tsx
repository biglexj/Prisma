import React from "react";
import { Icon } from "../../../../shared/ui/Icon";
import { toSafeAssetUrl } from "../../../../shared/mediaTree";
import type { ComparisonImageSlot } from "./types";

interface ImageComparisonCurtainProps {
  slotA?: ComparisonImageSlot;
  slotB?: ComparisonImageSlot;
  curtainRef: React.RefObject<HTMLDivElement | null>;
  curtainPosition: number;
  draggingSlotId: string | null;
  handleSlotWheel: (e: React.WheelEvent, slotId: string) => void;
  handlePanStart: (e: React.PointerEvent, slotId: string) => void;
  handleCurtainPointerDown: (e: React.PointerEvent) => void;
  onBackToSplit: () => void;
}

export const ImageComparisonCurtain: React.FC<ImageComparisonCurtainProps> = ({
  slotA,
  slotB,
  curtainRef,
  curtainPosition,
  draggingSlotId,
  handleSlotWheel,
  handlePanStart,
  handleCurtainPointerDown,
  onBackToSplit,
}) => {
  if (!slotA || !slotB) {
    return (
      <div className="img-compare-empty-curtain-notice">
        <Icon name="split" />
        <h3>Se requieren 2 imágenes para la Cortinilla interactiva</h3>
        <p>Carga una foto en el Slot A y otra en el Slot B para deslizar el antes y después.</p>
        <button
          type="button"
          className="img-compare-btn is-accent"
          onClick={onBackToSplit}
        >
          <Icon name="columns" />
          <span>Volver a Lado a lado</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={curtainRef}
      className="img-compare-curtain-view"
      onWheel={(e) => handleSlotWheel(e, slotA.id)}
      onPointerDown={(e) => handlePanStart(e, slotA.id)}
      style={{ cursor: slotA.zoom > 1 ? (draggingSlotId ? "grabbing" : "grab") : "default" }}
    >
      {/* Layer A (Underneath) */}
      <div
        className="img-compare-curtain-layer is-underneath"
        style={{
          transform: `translate(${slotA.pan.x}px, ${slotA.pan.y}px) scale(${slotA.zoom})`,
          transition: draggingSlotId ? "none" : "transform 0.1s ease-out",
        }}
      >
        <img
          src={toSafeAssetUrl(slotA.item.path)}
          alt={slotA.item.title}
          draggable={false}
        />
      </div>

      {/* Layer B (Clipped Over Top) */}
      <div
        className="img-compare-curtain-layer is-clipped"
        style={{
          clipPath: `polygon(${curtainPosition}% 0, 100% 0, 100% 100%, ${curtainPosition}% 100%)`,
          transform: `translate(${slotA.pan.x}px, ${slotA.pan.y}px) scale(${slotA.zoom})`,
          transition: draggingSlotId ? "none" : "transform 0.1s ease-out",
        }}
      >
        <img
          src={toSafeAssetUrl(slotB.item.path)}
          alt={slotB.item.title}
          draggable={false}
        />
      </div>

      {/* Draggable Divider Handle */}
      <div
        className="img-compare-curtain-divider"
        style={{ left: `${curtainPosition}%` }}
        onPointerDown={handleCurtainPointerDown}
      >
        <div className="img-compare-curtain-handle" title="Arrastra hacia los lados para comparar">
          <Icon name="split" />
        </div>
      </div>

      {/* Labels */}
      <div className="img-compare-curtain-label is-left">
        <span className="img-compare-slot-tag is-a">A</span>
        <span>{slotA.item.title}</span>
      </div>
      <div className="img-compare-curtain-label is-right">
        <span>{slotB.item.title}</span>
        <span className="img-compare-slot-tag is-b">B</span>
      </div>
    </div>
  );
};
