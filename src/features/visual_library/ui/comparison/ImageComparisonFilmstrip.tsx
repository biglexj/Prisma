import React from "react";
import { Icon } from "../../../../shared/ui/Icon";
import { VisualThumbnail } from "../VisualThumbnail";
import type { ComparisonImageSlot, ComparisonMode } from "./types";

interface ImageComparisonFilmstripProps {
  slots: ComparisonImageSlot[];
  slotA?: ComparisonImageSlot;
  slotB?: ComparisonImageSlot;
  mode: ComparisonMode;
  activeFlickIndex: number;
  showFilmstrip: boolean;
  setShowFilmstrip: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveSlotAId: (id: string) => void;
  setActiveSlotBId: (id: string) => void;
  setActiveFlickIndex: React.Dispatch<React.SetStateAction<number>>;
  handleSwapPrimary: () => void;
  setSelectorTargetSlotId: (id: string | null) => void;
  handleRemoveSlot: (id: string) => void;
  setIsAddingNewSlot: (val: boolean) => void;
}

export const ImageComparisonFilmstrip: React.FC<ImageComparisonFilmstripProps> = ({
  slots,
  slotA,
  slotB,
  mode,
  activeFlickIndex,
  showFilmstrip,
  setShowFilmstrip,
  setActiveSlotAId,
  setActiveSlotBId,
  setActiveFlickIndex,
  handleSwapPrimary,
  setSelectorTargetSlotId,
  handleRemoveSlot,
  setIsAddingNewSlot,
}) => {
  if (slots.length === 0) return null;

  return (
    <div className="img-compare-filmstrip-bar">
      <div className="img-compare-filmstrip">
        <div className="img-compare-filmstrip-header">
          <span className="img-compare-filmstrip-label">
            <Icon name="compare" />
            <span>Fotos en comparativa ({slots.length}/6)</span>
          </span>
          <button
            type="button"
            className="img-compare-filmstrip-toggle"
            onClick={() => setShowFilmstrip((prev) => !prev)}
            title={showFilmstrip ? "Ocultar barra de fotos" : "Mostrar barra de fotos"}
          >
            <Icon name={showFilmstrip ? "chevron-down" : "chevron-up"} />
          </button>
        </div>

        {showFilmstrip && (
          <div className="img-compare-filmstrip-items">
            {slots.map((slot, index) => {
              const isA = slot.id === slotA?.id;
              const isB = slot.id === slotB?.id;
              const isFlickActive = mode === "flick" && activeFlickIndex === index;

              return (
                <div
                  key={slot.id}
                  className={`img-compare-filmstrip-card ${isA ? "is-slot-a" : ""} ${isB ? "is-slot-b" : ""} ${isFlickActive ? "is-flick" : ""}`}
                  onClick={() => {
                    if (mode === "split" || mode === "curtain") {
                      if (!isA && !isB) {
                        setActiveSlotBId(slot.id);
                      } else if (isB) {
                        handleSwapPrimary();
                      }
                    } else if (mode === "flick") {
                      setActiveFlickIndex(index);
                    }
                  }}
                  title={`${slot.item.title}\n(Clic para activar en comparativa)`}
                >
                  <div className="img-compare-filmstrip-thumb">
                    <VisualThumbnail
                      path={slot.item.path}
                      alt={slot.item.title}
                      className="img-compare-thumbnail-media"
                      fit="cover"
                    />
                    {(mode === "split" || mode === "curtain") && (
                      <>
                        {isA && <span className="img-compare-slot-pill is-a">Slot A</span>}
                        {isB && <span className="img-compare-slot-pill is-b">Slot B</span>}
                        {!isA && !isB && (
                          <span className="img-compare-slot-pill is-alt">#{index + 1}</span>
                        )}
                      </>
                    )}
                    {mode === "grid" && (
                      <span className="img-compare-slot-pill is-grid">#{index + 1}</span>
                    )}
                    {mode === "flick" && (
                      <span className={`img-compare-slot-pill ${isFlickActive ? "is-a" : "is-alt"}`}>
                        #{index + 1}
                      </span>
                    )}
                  </div>

                  <div className="img-compare-filmstrip-meta">
                    <span className="img-compare-filmstrip-name">{slot.item.title}</span>
                    <div className="img-compare-filmstrip-btns" onClick={(e) => e.stopPropagation()}>
                      {(mode === "split" || mode === "curtain") && !isA && (
                        <button
                          type="button"
                          className="img-compare-mini-btn"
                          onClick={() => setActiveSlotAId(slot.id)}
                          title="Fijar en Slot A"
                        >
                          A
                        </button>
                      )}
                      {(mode === "split" || mode === "curtain") && !isB && (
                        <button
                          type="button"
                          className="img-compare-mini-btn"
                          onClick={() => setActiveSlotBId(slot.id)}
                          title="Fijar en Slot B"
                        >
                          B
                        </button>
                      )}
                      <button
                        type="button"
                        className="img-compare-mini-btn"
                        onClick={() => setSelectorTargetSlotId(slot.id)}
                        title="Cambiar esta foto..."
                      >
                        <Icon name="edit" />
                      </button>
                      {slots.length > 2 && (
                        <button
                          type="button"
                          className="img-compare-mini-btn is-danger"
                          onClick={() => handleRemoveSlot(slot.id)}
                          title="Quitar de la comparativa"
                        >
                          <Icon name="close" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {slots.length < 6 && (
              <button
                type="button"
                className="img-compare-filmstrip-add-btn"
                onClick={() => setIsAddingNewSlot(true)}
                title="Añadir otra foto a la comparativa"
              >
                <Icon name="plus" />
                <span>Añadir</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
