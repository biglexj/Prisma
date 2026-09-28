import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "./Icon";
import "./volume-osd.css";

export interface VolumeOsdProps {
  volume: number;
  isMuted?: boolean;
  visible: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Hook para controlar la aparición y desvanecimiento reactivo del OSD de volumen
 * tras interacción por atajos de teclado o mandos a distancia.
 */
export function useVolumeOsd(initialVolume = 100, initialMuted = false) {
  const [osdState, setOsdState] = useState({
    visible: false,
    volume: initialVolume,
    isMuted: initialMuted,
  });
  const timerRef = useRef<number | null>(null);

  const triggerOsd = useCallback((newVolume: number, isMuted = false) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    setOsdState({
      visible: true,
      volume: Math.round(Math.max(0, Math.min(100, newVolume))),
      isMuted,
    });
    timerRef.current = window.setTimeout(() => {
      setOsdState((prev) => ({ ...prev, visible: false }));
    }, 1400);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { osdState, triggerOsd };
}

/**
 * Despacha un evento global para mostrar el OSD de volumen en cualquier parte de la aplicación.
 */
export function dispatchGlobalVolumeOsd(volume: number, isMuted = false) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("prisma-global-volume-osd", {
        detail: { volume, isMuted },
      })
    );
  }
}

/**
 * HUD / OSD de Volumen con micro-animaciones Material 3 Expressive,
 * ondas concéntricas dinámicas que crecen y disminuyen reactivamente,
 * porcentaje numérico exacto y micro-barra de progreso.
 */
export function VolumeOsd({ volume, isMuted = false, visible, className = "", style }: VolumeOsdProps) {
  if (!visible) return null;

  const effectiveVol = isMuted ? 0 : Math.round(Math.max(0, Math.min(100, volume)));
  const isMuteState = isMuted || effectiveVol === 0;

  return (
    <div
      aria-live="polite"
      className={`prisma-volume-osd ${isMuteState ? "is-muted" : ""} ${className}`}
      role="status"
      style={style}
    >
      <div className="prisma-volume-osd-icon-box" aria-hidden="true">
        {isMuteState ? (
          <Icon name="volume-mute" className="prisma-volume-osd-mute-icon" />
        ) : (
          <svg
            className="prisma-volume-osd-svg"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            {/* Cono del altavoz */}
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            {/* Onda 1: corta (1% - 33%) */}
            <path
              className={`volume-wave-arc arc-1 ${effectiveVol > 0 ? "is-active" : ""}`}
              d="M15 9.5a4 4 0 0 1 0 5"
            />
            {/* Onda 2: mediana (34% - 66%) */}
            <path
              className={`volume-wave-arc arc-2 ${effectiveVol > 33 ? "is-active" : ""}`}
              d="M17.6 7a7.5 7.5 0 0 1 0 10"
            />
            {/* Onda 3: grande (67% - 100%) */}
            <path
              className={`volume-wave-arc arc-3 ${effectiveVol > 66 ? "is-active" : ""}`}
              d="M20.2 4.5a11 11 0 0 1 0 15"
            />
          </svg>
        )}
      </div>

      <div className="prisma-volume-osd-body">
        <div className="prisma-volume-osd-value-row">
          <span className="prisma-volume-osd-value">
            {isMuteState ? "Silenciado" : `${effectiveVol}%`}
          </span>
        </div>
        <div className="prisma-volume-osd-progress-track">
          <div
            className="prisma-volume-osd-progress-fill"
            style={{ width: `${effectiveVol}%` }}
          />
        </div>
      </div>
    </div>
  );
}
