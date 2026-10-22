import { Icon } from "../../../shared/ui/Icon";
import type { CaptureIntent } from "../model/types";

interface CaptureKindSwitchProps {
  value: CaptureIntent;
  onChange: (value: CaptureIntent) => void;
  disabled?: boolean;
}

/**
 * Selector de intención al estilo de Recortes: una sola fila con dos
 * segmentos (Imagen / Vídeo) y un indicador que se desliza entre ellos.
 */
export function CaptureKindSwitch({ value, onChange, disabled }: CaptureKindSwitchProps) {
  const isVideo = value === "video";

  return (
    <div
      className={`capture-kind-switch ${isVideo ? "is-video" : "is-image"}`}
      role="radiogroup"
      aria-label="Tipo de captura"
    >
      <span className="capture-kind-switch-thumb" aria-hidden="true" />
      <button
        type="button"
        role="radio"
        aria-checked={!isVideo}
        className={`capture-kind-option ${!isVideo ? "is-active" : ""}`}
        onClick={() => onChange("image")}
        disabled={disabled}
        title="Captura instantánea de imagen con anotaciones"
      >
        <Icon name="camera" width={16} height={16} />
        <span>Imagen</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={isVideo}
        className={`capture-kind-option ${isVideo ? "is-active" : ""}`}
        onClick={() => onChange("video")}
        disabled={disabled}
        title="Grabación de vídeo de la región seleccionada"
      >
        <Icon name="video" width={16} height={16} />
        <span>Vídeo</span>
      </button>
    </div>
  );
}
