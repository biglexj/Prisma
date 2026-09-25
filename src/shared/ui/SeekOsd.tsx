import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import "./seek-osd.css";

export type SeekDirection = "forward" | "backward";

export interface SeekOsdProps {
  direction: SeekDirection;
  seconds?: number;
  visible: boolean;
  className?: string;
  style?: CSSProperties;
  revision?: number;
}

/**
 * Hook para controlar la aparición y micro-rebote reactivo del OSD de avance / retroceso
 */
export function useSeekOsd() {
  const [osdState, setOsdState] = useState<{
    visible: boolean;
    direction: SeekDirection;
    seconds: number;
    revision: number;
  }>({
    visible: false,
    direction: "forward",
    seconds: 10,
    revision: 0,
  });

  const timerRef = useRef<number | null>(null);

  const triggerSeekOsd = useCallback((direction: SeekDirection, seconds = 10) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    setOsdState((prev) => ({
      visible: true,
      direction,
      seconds,
      revision: prev.revision + 1,
    }));
    timerRef.current = window.setTimeout(() => {
      setOsdState((prev) => ({ ...prev, visible: false }));
    }, 700);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { osdState, triggerSeekOsd };
}

/**
 * HUD / OSD de Avance y Retroceso — Material 3 Expressive
 * Despliega el icono translúcido (40% opacidad) con micro-animación de rebote:
 * a la derecha para avanzar (+10s) y a la izquierda para retroceder (-10s).
 */
export function SeekOsd({
  direction,
  seconds = 10,
  visible,
  className = "",
  style,
  revision = 0,
}: SeekOsdProps) {
  if (!visible) return null;

  const isForward = direction === "forward";

  return (
    <div
      key={revision}
      aria-live="polite"
      className={`prisma-seek-osd ${isForward ? "is-forward" : "is-backward"} ${className}`}
      role="status"
      style={style}
    >
      <div className="prisma-seek-osd-container">
        <div className="prisma-seek-osd-icon-wrap" aria-hidden="true">
          {isForward ? (
            <svg
              className="prisma-seek-osd-svg"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              {/* Doble chevron hacia adelante (>>) */}
              <path d="m6 5 7 7-7 7" />
              <path d="m13 5 7 7-7 7" />
            </svg>
          ) : (
            <svg
              className="prisma-seek-osd-svg"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              {/* Doble chevron hacia atrás (<<) */}
              <path d="m11 19-7-7 7-7" />
              <path d="m18 19-7-7 7-7" />
            </svg>
          )}
        </div>
        {seconds > 0 && (
          <span className="prisma-seek-osd-label">
            {isForward ? `+${seconds}s` : `-${seconds}s`}
          </span>
        )}
      </div>
    </div>
  );
}
