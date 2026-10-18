import { useEffect, useState } from "react";
import "./image-loading-state.css";

export interface ImageLoadingStateProps {
  /**
   * Tiempo mínimo en milisegundos que debe transcurrir antes de mostrar
   * el indicador de carga (por defecto 1000 ms = 1 segundo).
   */
  delayMs?: number;
  label?: string;
  itemKey?: string;
}

export function ImageLoadingState({
  delayMs = 1000,
  label = "Cargando imagen…",
  itemKey,
}: ImageLoadingStateProps = {}) {
  const [visible, setVisible] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) {
      setVisible(true);
      return;
    }

    setVisible(false);
    const timer = window.setTimeout(() => {
      setVisible(true);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs, itemKey]);

  if (!visible) return null;

  return (
    <div className="image-loading-state" role="status" aria-live="polite">
      <div className="image-loading-state-surface">
        <svg className="image-loading-indicator" viewBox="0 0 48 48" aria-hidden="true">
          <circle className="image-loading-track" cx="24" cy="24" r="20" />
          <circle className="image-loading-arc" cx="24" cy="24" r="20" />
        </svg>
        <span>{label}</span>
      </div>
    </div>
  );
}
