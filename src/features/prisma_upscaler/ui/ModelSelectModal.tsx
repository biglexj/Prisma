import { useEffect } from "react";
import { Icon } from "../../../shared/ui/Icon";

export interface AIModel {
  id: string;
  name: string;
  description: string;
  scales: number[];
  category?: "photo" | "anime" | "restore" | "sharp" | "compact";
}

const MODEL_COMPARISON_IMAGES: Record<string, string> = {
  "realesrgan-x4plus-anime": "/models/realesrgan-x4plus-anime.webp",
  "realesrgan-x4plus": "/models/realesrgan-x4plus.webp",
  "ultrasharp": "/models/ultrasharp.webp",
  "remacri": "/models/remacri.webp",
  "ultramix_balanced": "/models/ultramix_balanced.webp",
};

interface ModelSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: AIModel[];
  selectedModel: string;
  onSelectModel: (id: string) => void;
}

export function ModelSelectModal({
  isOpen,
  onClose,
  models,
  selectedModel,
  onSelectModel,
}: ModelSelectModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getModelIcon = (id: string): import("../../../shared/ui/Icon").IconName => {
    if (id.includes("anime") || id.includes("art")) return "brush";
    if (id.includes("sharp")) return "sparkles";
    if (id.includes("remacri") || id.includes("restore") || id.includes("ultramix")) return "sliders";
    if (id.includes("compact")) return "clock";
    return "image";
  };

  const getCategoryBadge = (category?: string) => {
    switch (category) {
      case "anime":
        return { text: "Anime y Dibujos 2D", color: "#ec4899" };
      case "photo":
        return { text: "Fotografía y Realismo", color: "#3b82f6" };
      case "sharp":
        return { text: "Nitidez Extrema", color: "#f59e0b" };
      case "restore":
        return { text: "Restauración Fiel", color: "#10b981" };
      case "compact":
        return { text: "Ultra Rápido / Baja VRAM", color: "#06b6d4" };
      default:
        return { text: "Propósito General", color: "#8b5cf6" };
    }
  };

  const handleSelect = (id: string) => {
    onSelectModel(id);
    onClose();
  };

  return (
    <div className="modal-backdrop animate-fade-in upscaler-modal-backdrop" onClick={onClose}>
      <div
        className="modal-card upscaler-model-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-select-title"
      >
        {/* Header */}
        <div className="modal-header upscaler-modal-header">
          <div className="modal-title-row">
            <div className="upscaler-modal-icon-wrap">
              <Icon name="sparkles" />
            </div>
            <h2 id="model-select-title">Seleccionar modelo de IA</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title="Cerrar (Esc)"
          >
            <Icon name="x" />
          </button>
        </div>

        {/* Body */}
        <div className="upscaler-model-modal-body">
          <p className="upscaler-modal-hint">
            Elige el modelo neuronal optimizado para el tipo de imagen que deseas escalar.
          </p>

          <div className="upscaler-model-cards-grid">
            {models.map((model) => {
              const isSelected = model.id === selectedModel;
              const categoryBadge = getCategoryBadge(model.category);
              const maxScale = model.scales[model.scales.length - 1];

              return (
                <div
                  key={model.id}
                  className={`upscaler-model-item-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => handleSelect(model.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(model.id);
                    }
                  }}
                >
                  <div className="upscaler-model-card-top">
                    <div className="upscaler-model-card-icon-title">
                      <span className="upscaler-model-card-icon">
                        <Icon name={getModelIcon(model.id)} />
                      </span>
                      <div>
                        <h3 className="upscaler-model-card-title">{model.name}</h3>
                        <span
                          className="upscaler-model-cat-badge"
                          style={{
                            backgroundColor: `${categoryBadge.color}18`,
                            color: categoryBadge.color,
                            borderColor: `${categoryBadge.color}40`,
                          }}
                        >
                          {categoryBadge.text}
                        </span>
                      </div>
                    </div>

                    <div className="upscaler-model-card-status">
                      {isSelected ? (
                        <span className="upscaler-selected-tag">
                          <Icon name="check" /> Seleccionado
                        </span>
                      ) : (
                        <span className="upscaler-scale-tag">
                          {model.scales.map((s) => `${s}x`).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="upscaler-model-card-desc">{model.description}</p>

                  {/* Comparativa visual real Antes / Después */}
                  {MODEL_COMPARISON_IMAGES[model.id] ? (
                    <div className="upscaler-model-comparativa-wrapper">
                      <img
                        src={MODEL_COMPARISON_IMAGES[model.id]}
                        alt={`Comparativa ${model.name}`}
                        className="upscaler-model-comparativa-img"
                        loading="lazy"
                      />
                      <div className="upscaler-comparativa-tag before">Antes (Original)</div>
                      <div className="upscaler-comparativa-divider-badge">⚡</div>
                      <div className="upscaler-comparativa-tag after">
                        Después (Super-Resolución {maxScale}x)
                      </div>
                    </div>
                  ) : (
                    <div className="upscaler-model-preview-bar">
                      <div className="preview-split-half before">
                        <span>Antes (Original)</span>
                      </div>
                      <div className="preview-split-divider">
                        <span>⚡</span>
                      </div>
                      <div className="preview-split-half after">
                        <span>Después (Super-Resolución {maxScale}x)</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer upscaler-modal-footer">
          <div className="upscaler-modal-footer-tip">
            <span className="tip-bulb">💡</span>
            <span>Modelos acelerados con NCNN Vulkan en GPU dedicada.</span>
          </div>
          <button
            type="button"
            className="upscaler-btn primary"
            onClick={onClose}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
