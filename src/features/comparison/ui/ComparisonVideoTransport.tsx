import React from "react";
import { Icon } from "../../../shared/ui/Icon";

interface ComparisonVideoTransportProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onRestart: () => void;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  audioFocusTitle?: string;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const RATES = [0.5, 1, 1.5, 2];

export const ComparisonVideoTransport: React.FC<ComparisonVideoTransportProps> = ({
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  onSeek,
  onRestart,
  playbackRate,
  onChangePlaybackRate,
  audioFocusTitle,
}) => {
  const safeDuration = duration > 0 ? duration : 100;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSeek(parseFloat(e.target.value));
  };

  const handleCycleRate = () => {
    const currentIdx = RATES.indexOf(playbackRate);
    const nextIdx = (currentIdx + 1) % RATES.length;
    onChangePlaybackRate(RATES[nextIdx]);
  };

  return (
    <div className="img-compare-video-transport" onClick={(e) => e.stopPropagation()}>
      <div className="img-compare-transport-inner">
        {/* Play/Pause y Reinicio */}
        <div className="img-compare-transport-buttons">
          <button
            type="button"
            className="img-compare-transport-btn is-restart"
            onClick={onRestart}
            title="Reiniciar reproducción (al segundo 0)"
          >
            <Icon name="refresh" />
          </button>

          <button
            type="button"
            className={`img-compare-transport-btn is-play ${isPlaying ? "is-playing" : ""}`}
            onClick={onTogglePlay}
            title={isPlaying ? "Pausar ambos vídeos (Espacio)" : "Reproducir ambos vídeos (Espacio)"}
          >
            <Icon name={isPlaying ? "pause" : "play"} />
          </button>
        </div>

        {/* Tiempo y Línea de tiempo sincronizada */}
        <div className="img-compare-transport-timeline">
          <span className="img-compare-transport-time">{formatTime(currentTime)}</span>

          <div className="img-compare-transport-slider-wrap">
            <input
              type="range"
              min={0}
              max={safeDuration}
              step={0.05}
              value={currentTime}
              onChange={handleSliderChange}
              className="img-compare-transport-slider"
              style={{
                background: `linear-gradient(to right, var(--color-primary, #d0bcff) ${progressPercent}%, rgba(255, 255, 255, 0.15) ${progressPercent}%)`,
              }}
              title="Mover barra temporal sincronizada"
            />
          </div>

          <span className="img-compare-transport-time is-dim">{formatTime(duration)}</span>
        </div>

        {/* Velocidad y Foco de Audio */}
        <div className="img-compare-transport-extra">
          <button
            type="button"
            className="img-compare-transport-rate-btn"
            onClick={handleCycleRate}
            title="Velocidad de reproducción"
          >
            <span>{playbackRate}x</span>
          </button>

          {audioFocusTitle && (
            <div
              className="img-compare-transport-audio-pill"
              title="El audio conmuta al vídeo sobre el que pasas el cursor para evitar cacofonía"
            >
              <Icon name="volume" />
              <span className="img-compare-audio-title">{audioFocusTitle}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
