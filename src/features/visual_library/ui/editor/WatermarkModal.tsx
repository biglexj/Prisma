import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../../shared/ui/Icon";
import { toSafeAssetUrl } from "../../../../shared/mediaTree";
import type { WatermarkConfig, WatermarkPosition } from "../../model/watermark";

interface WatermarkModalProps {
  config: WatermarkConfig;
  isOpen: boolean;
  onClose: () => void;
  onApply: (newConfig: WatermarkConfig) => void;
}

export function WatermarkModal({
  config,
  isOpen,
  onClose,
  onApply,
}: WatermarkModalProps) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [text, setText] = useState(config.text);
  const [includeDate, setIncludeDate] = useState(config.includeDate);
  const [logoPath, setLogoPath] = useState<string | null>(config.logoPath ?? null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(config.logoDataUrl ?? null);
  const [position, setPosition] = useState<WatermarkPosition>(config.position);
  const [scale, setScale] = useState(config.scale);
  const [opacity, setOpacity] = useState(config.opacity);
  const [withShadow, setWithShadow] = useState(config.withShadow);

  if (!isOpen) return null;

  const handlePickLogo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Logotipos e Imágenes", extensions: ["png", "webp", "jpg", "jpeg", "svg"] }],
      });
      if (selected && typeof selected === "string") {
        setLogoPath(selected);
        setLogoDataUrl(toSafeAssetUrl(selected));
        setEnabled(true);
      }
    } catch (err) {
      console.warn("[WatermarkModal] Error seleccionando archivo de logo:", err);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPath(null);
    setLogoDataUrl(null);
  };

  const handleConfirm = () => {
    onApply({
      ...config,
      enabled,
      text: text.trim(),
      includeDate,
      logoPath,
      logoDataUrl,
      position,
      scale,
      opacity,
      withShadow,
    });
    onClose();
  };

  const handleDisable = () => {
    onApply({
      ...config,
      enabled: false,
    });
    onClose();
  };

  return (
    <div className="media-dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="media-dialog-card watermark-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="watermark-modal-header">
          <div className="watermark-modal-title">
            <span className="media-dialog-icon">
              <Icon name="crop" />
            </span>
            <div>
              <h3>Marca de agua</h3>
              <p>Estampa logotipo y firma de autoría en tu imagen</p>
            </div>
          </div>
          <button className="watermark-modal-close" onClick={onClose} title="Cerrar">
            <Icon name="close" />
          </button>
        </header>

        <div className="watermark-modal-body">
          {/* 1. Conmutador principal */}
          <label className="watermark-toggle-row">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <div className="watermark-toggle-label">
              <strong>Activar marca de agua</strong>
              <small>Muestra el sello visible al previsualizar y exportar</small>
            </div>
          </label>

          {/* 2. Campo de texto y autor */}
          <div className="watermark-field-group">
            <label className="watermark-label">Texto o Autoría</label>
            <input
              type="text"
              className="watermark-text-input"
              placeholder="Ej. © biglexj / Fotografía"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value.trim()) setEnabled(true);
              }}
            />
          </div>

          {/* 3. Fecha automática */}
          <label className="watermark-checkbox-row">
            <input
              type="checkbox"
              checked={includeDate}
              onChange={(e) => {
                setIncludeDate(e.target.checked);
                if (e.target.checked) setEnabled(true);
              }}
            />
            <span>Incluir fecha actual (año-mes-día)</span>
          </label>

          {/* 4. Logotipo */}
          <div className="watermark-field-group">
            <label className="watermark-label">Logotipo (PNG / WebP transparente)</label>
            <div className="watermark-logo-box">
              {logoDataUrl ? (
                <div className="watermark-logo-preview">
                  <img src={logoDataUrl} alt="Logo" />
                  <button
                    type="button"
                    className="watermark-logo-remove-btn"
                    onClick={handleRemoveLogo}
                    title="Quitar logo"
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                className="watermark-logo-pick-btn"
                onClick={() => void handlePickLogo()}
              >
                <Icon name="folder-open" />
                <span>{logoPath ? "Cambiar logotipo..." : "Elegir logotipo..."}</span>
              </button>
            </div>
          </div>

          {/* 5. Selector de Posición (Matriz visual de cuadrícula) */}
          <div className="watermark-field-group">
            <label className="watermark-label">Ubicación</label>
            <div className="watermark-position-grid">
              {(
                [
                  { id: "top-left", label: "Sup. Izq." },
                  { id: "top-right", label: "Sup. Der." },
                  { id: "center", label: "Centro" },
                  { id: "bottom-left", label: "Inf. Izq." },
                  { id: "bottom-right", label: "Inf. Der." },
                ] as const
              ).map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  className={`watermark-pos-btn ${position === pos.id ? "is-selected" : ""}`}
                  onClick={() => setPosition(pos.id)}
                >
                  {pos.label}
                </button>
              ))}
            </div>
            <small className="watermark-position-help">
              Los bordes mantienen un margen del 5 % de la imagen. Al aplicar, puedes arrastrar la marca a una ubicación libre.
              {position === "custom" ? " Ubicación libre seleccionada." : ""}
            </small>
          </div>

          {/* 6. Deslizadores de Escala y Opacidad */}
          <div className="watermark-sliders-grid">
            <div className="watermark-field-group">
              <div className="watermark-slider-header">
                <label className="watermark-label">Escala</label>
                <span>{Math.round(scale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.5"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="watermark-slider"
              />
            </div>

            <div className="watermark-field-group">
              <div className="watermark-slider-header">
                <label className="watermark-label">Opacidad</label>
                <span>{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="watermark-slider"
              />
            </div>
          </div>

          {/* 7. Sombra de contraste */}
          <label className="watermark-checkbox-row">
            <input
              type="checkbox"
              checked={withShadow}
              onChange={(e) => setWithShadow(e.target.checked)}
            />
            <span>Sombra de contraste (mejora legibilidad sobre fondos claros/oscuros)</span>
          </label>
        </div>

        <footer className="watermark-modal-footer">
          {enabled ? (
            <button
              type="button"
              className="text-button watermark-disable-btn"
              onClick={handleDisable}
            >
              Desactivar marca
            </button>
          ) : null}
          <div className="watermark-footer-actions">
            <button type="button" className="text-button" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="watermark-apply-btn"
              onClick={handleConfirm}
            >
              Aplicar cambios
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
