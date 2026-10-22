import { Icon } from "../../../shared/ui/Icon";
import type { CaptureIntent } from "../model/types";

interface CaptureKindSwitchProps {
  value: CaptureIntent;
  onChange: (value: CaptureIntent) => void;
  disabled?: boolean;
}

/**
 * Selector de intención al estilo de las tarjetas de Configuración:
 * dos opciones, la activa resaltada, sin adornos ni desplazamientos.
 */
export function CaptureKindSwitch({ value, onChange, disabled }: CaptureKindSwitchProps) {
  return (
    <div className="capture-kind-cards" role="radiogroup" aria-label="Tipo de captura">
      <button
        type="button"
        role="radio"
        aria-checked={value === "image"}
        className={`snapshot-format-chip ${value === "image" ? "is-selected" : ""}`}
        onClick={() => onChange("image")}
        disabled={disabled}
        title="Captura instantánea de imagen con anotaciones"
      >
        <Icon name="camera" width={18} height={18} />
        <span className="snapshot-format-info">
          <strong>Imagen</strong>
        </span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={value === "video"}
        className={`snapshot-format-chip ${value === "video" ? "is-selected" : ""}`}
        onClick={() => onChange("video")}
        disabled={disabled}
        title="Grabación de vídeo de la región seleccionada"
      >
        <Icon name="video" width={18} height={18} />
        <span className="snapshot-format-info">
          <strong>Vídeo</strong>
        </span>
      </button>
    </div>
  );
}
