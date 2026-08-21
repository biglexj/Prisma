import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "../formatters";
import { Icon } from "../../../../shared/ui/Icon";
import { useTrackLyrics } from "../../useTrackLyrics";
import { LyricsEditorModal } from "./LyricsEditorModal";
import "./lyrics-preview.css";

interface LyricsPreviewProps {
  path: string | null;
  title: string;
  artist?: string;
  album?: string;
  positionSeconds: number;
  durationSeconds: number;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onSeek: (seconds: number) => void;
  onBackToCover?: () => void;
  onOpenFullscreen?: () => void;
}

export function LyricsPreview({
  path,
  title,
  artist,
  album,
  positionSeconds,
  durationSeconds,
  isPlaying,
  onTogglePlay,
  onSeek,
  onBackToCover,
  onOpenFullscreen,
}: LyricsPreviewProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { lyrics, loading, updateLyrics, refetch } = useTrackLyrics(path);

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
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {onOpenFullscreen ? (
            <button
              className="lyrics-view-album-btn lyrics-fullscreen-trigger-btn"
              onClick={onOpenFullscreen}
              title="Modo pantalla completa inmersivo para cantar (Karaoke)"
              type="button"
            >
              <Icon name="fullscreen" />
              <span>Pantalla completa</span>
            </button>
          ) : null}
          {path ? (
            <button
              className="lyrics-view-album-btn"
              onClick={() => setIsEditorOpen(true)}
              title="Buscar online o editar letras (.lrc)"
              type="button"
            >
              <Icon name="edit" />
              <span>Editar letras</span>
            </button>
          ) : null}
        </div>
      </header>

      {path ? (
        <LyricsEditorModal
          path={path}
          title={title}
          artist={artist}
          album={album}
          durationSeconds={durationSeconds}
          currentPlaybackPosition={positionSeconds}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onSeek={onSeek}
          initialLyrics={lyrics?.raw || ""}
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          onSaved={(savedLrc) => {
            if (savedLrc) {
              updateLyrics(savedLrc);
            } else {
              refetch();
            }
          }}
        />
      ) : null}

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
