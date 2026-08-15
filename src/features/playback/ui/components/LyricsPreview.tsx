import { useEffect, useMemo, useRef } from "react";
import { formatTime } from "../formatters";
import { Icon } from "../../../../shared/ui/Icon";
import { useTrackLyrics } from "../../useTrackLyrics";
import "./lyrics-preview.css";

interface LyricsPreviewProps {
  path: string | null;
  title: string;
  positionSeconds: number;
  durationSeconds: number;
  onSeek: (seconds: number) => void;
  onBackToCover?: () => void;
}

export function LyricsPreview({
  path,
  title,
  positionSeconds,
  onSeek,
  onBackToCover,
}: LyricsPreviewProps) {
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { lyrics, loading } = useTrackLyrics(path);

  const activeIndex = useMemo(() => {
    if (!lyrics || !lyrics.isSynced || lyrics.lines.length === 0) return 0;
    let current = 0;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (positionSeconds >= lyrics.lines[i].time) {
        current = i;
      } else {
        break;
      }
    }
    return current;
  }, [lyrics, positionSeconds]);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  const hasLyrics = lyrics && lyrics.lines.length > 0;

  return (
    <div className="lyrics-stage-container" ref={containerRef}>
      <header className="lyrics-header-badge">
        <div className="lyrics-header-text">
          <span className="lyrics-kicker">
            {hasLyrics ? (lyrics.isSynced ? "LETRAS SINCRONIZADAS (.LRC)" : "LETRAS DE CANCIÓN") : "LETRAS"}
          </span>
          <h2>{title}</h2>
        </div>
        {onBackToCover ? (
          <button
            className="lyrics-view-album-btn"
            onClick={onBackToCover}
            title="Volver a la carátula del álbum"
          >
            <Icon name="disc" />
            <span>Ver álbum</span>
          </button>
        ) : null}
      </header>

      {loading ? (
        <div className="lyrics-empty-state">
          <Icon name="music" />
          <p>Buscando letras sincronizadas...</p>
        </div>
      ) : hasLyrics ? (
        <div className="lyrics-scroll-viewport">
          {lyrics.lines.map((line, index) => {
            const isActive = lyrics.isSynced && index === activeIndex;
            const isPast = lyrics.isSynced && index < activeIndex;
            const isFuture = lyrics.isSynced && index > activeIndex;

            return (
              <div
                key={line.id}
                ref={isActive ? activeLineRef : null}
                className={`lyric-line-item ${isActive ? "is-active" : ""} ${isPast ? "is-past" : ""} ${isFuture ? "is-future" : ""}`}
                onClick={lyrics.isSynced ? () => onSeek(line.time) : undefined}
                role={lyrics.isSynced ? "button" : undefined}
                tabIndex={lyrics.isSynced ? 0 : undefined}
                title={lyrics.isSynced ? `Saltar a ${formatTime(line.time)}` : undefined}
              >
                {lyrics.isSynced ? (
                  <span className="lyric-timestamp">{formatTime(line.time)}</span>
                ) : null}
                <p className="lyric-text-content">{line.text}</p>
                {isActive ? <i className="lyric-active-glow-bar" /> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="lyrics-empty-state">
          <Icon name="music" />
          <p>No se encontraron letras para esta canción</p>
          <span>
            Para ver letras sincronizadas en vivo, coloca un archivo <strong>.lrc</strong> con el mismo nombre en la carpeta de la pista.
          </span>
        </div>
      )}
    </div>
  );
}
