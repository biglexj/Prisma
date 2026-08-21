import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { formatTime } from "../formatters";
import { Icon } from "../../../../shared/ui/Icon";
import { useTrackLyrics } from "../../useTrackLyrics";
import { LyricsEditorModal } from "./LyricsEditorModal";
import { MediaProgressBar } from "../../../../shared/ui/MediaProgressBar";
import "./fullscreen-lyrics.css";

interface FullscreenLyricsProps {
  path: string | null;
  title: string;
  artist?: string;
  album?: string;
  positionSeconds: number;
  durationSeconds: number;
  isPlaying?: boolean;
  volume?: number;
  artwork?: string | null;
  palette?: {
    accent: string;
    accentSoft: string;
    accentDeep: string;
    onAccent: string;
  } | null;
  queueCount?: number;
  currentIndex?: number;
  shuffleMode?: boolean;
  repeatMode?: "off" | "all" | "one";
  onTogglePlay?: () => void;
  onSeek: (seconds: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onVolume?: (volume: number) => void;
  onToggleShuffle?: () => void;
  onToggleRepeat?: () => void;
  onClose: () => void;
}

export function FullscreenLyrics({
  path,
  title,
  artist,
  album,
  positionSeconds,
  durationSeconds,
  isPlaying = false,
  volume = 70,
  artwork,
  palette,
  queueCount = 0,
  currentIndex = 0,
  shuffleMode = false,
  repeatMode = "off",
  onTogglePlay,
  onSeek,
  onPrevious,
  onNext,
  onVolume,
  onToggleShuffle,
  onToggleRepeat,
  onClose,
}: FullscreenLyricsProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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

  // Autoscroll suave para centrar la línea activa en el visor completo
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  // Atajos de teclado en modo pantalla completa
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditorOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        onTogglePlay?.();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onSeek(Math.min(durationSeconds, positionSeconds + 5));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onSeek(Math.max(0, positionSeconds - 5));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onVolume?.(Math.min(100, volume + 5));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onVolume?.(Math.max(0, volume - 5));
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNext?.();
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        onPrevious?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [durationSeconds, isEditorOpen, onClose, onNext, onPrevious, onSeek, onTogglePlay, onVolume, positionSeconds, volume]);

  const hasLyrics = lyrics && lyrics.lines.length > 0;

  const dynamicStyle = palette
    ? ({
        "--album-accent": palette.accent,
        "--album-accent-soft": palette.accentSoft,
        "--album-accent-deep": palette.accentDeep,
        "--album-on-accent": palette.onAccent,
      } as CSSProperties)
    : undefined;

  return (
    <div className="fullscreen-lyrics-overlay" style={dynamicStyle}>
      {/* Fondo ambiental dinámico desenfocado */}
      <div className="fullscreen-lyrics-backdrop-glow">
        {artwork ? (
          <img src={artwork} alt="" className="fullscreen-lyrics-bg-img" aria-hidden="true" />
        ) : (
          <div className="fullscreen-lyrics-bg-fallback" aria-hidden="true" />
        )}
        <div className="fullscreen-lyrics-scrim" />
      </div>

      {/* Cabecera superior flotante */}
      <header className="fullscreen-lyrics-topbar">
        <div className="fullscreen-lyrics-track-info">
          <div className="fullscreen-lyrics-badge">
            <Icon name="mic" />
            <span>
              {hasLyrics
                ? lyrics.isSynced
                  ? "KARAOKE · LETRAS EN VIVO (.LRC)"
                  : "LETRAS DE CANCIÓN"
                : "MODO INMERSIVO"}
            </span>
          </div>
          <h1 className="fullscreen-lyrics-title">{title}</h1>
          {artist ? <p className="fullscreen-lyrics-artist">{artist}{album ? ` — ${album}` : ""}</p> : null}
        </div>

        <div className="fullscreen-lyrics-actions">
          {path ? (
            <button
              className="fullscreen-lyrics-action-btn"
              onClick={() => setIsEditorOpen(true)}
              title="Buscar online o editar letras (.lrc)"
              type="button"
            >
              <Icon name="edit" />
              <span>Editar letras</span>
            </button>
          ) : null}

          <button
            className="fullscreen-lyrics-close-btn"
            onClick={onClose}
            title="Salir de pantalla completa (Esc)"
            type="button"
            aria-label="Cerrar pantalla completa"
          >
            <Icon name="fullscreen-exit" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Escenario central de letras */}
      <main className="fullscreen-lyrics-stage" ref={scrollContainerRef}>
        {loading ? (
          <div className="fullscreen-lyrics-loading">
            <Icon name="music" />
            <p>Buscando letras sincronizadas...</p>
          </div>
        ) : hasLyrics ? (
          <div className="fullscreen-lyrics-lines-container">
            {lyrics.lines.map((line, index) => {
              const isActive = lyrics.isSynced && index === activeIndex;
              const isPast = lyrics.isSynced && index < activeIndex;
              const isFuture = lyrics.isSynced && index > activeIndex;

              return (
                <div
                  key={line.id}
                  ref={isActive ? activeLineRef : null}
                  className={`fullscreen-lyric-line ${isActive ? "is-active" : ""} ${isPast ? "is-past" : ""} ${isFuture ? "is-future" : ""}`}
                  onClick={lyrics.isSynced ? () => onSeek(line.time) : undefined}
                  role={lyrics.isSynced ? "button" : undefined}
                  tabIndex={lyrics.isSynced ? 0 : undefined}
                  title={lyrics.isSynced ? `Saltar a ${formatTime(line.time)}` : undefined}
                >
                  <p className="fullscreen-lyric-text">{line.text}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fullscreen-lyrics-empty">
            <Icon name="music" />
            <h2>No se encontraron letras para esta canción</h2>
            <p>
              Coloca un archivo <strong>.lrc</strong> con el mismo nombre en la carpeta de la pista o usa el botón &quot;Editar letras&quot; para buscarlas online.
            </p>
            {path ? (
              <button
                className="fullscreen-lyrics-empty-btn"
                onClick={() => setIsEditorOpen(true)}
                type="button"
              >
                <Icon name="edit" />
                <span>Añadir o Buscar Letras Online</span>
              </button>
            ) : null}
          </div>
        )}
      </main>

      {/* Barra de control inferior flotante */}
      <footer className="fullscreen-lyrics-bottombar">
        <div className="fullscreen-lyrics-progress-row">
          <span className="fullscreen-lyrics-time">{formatTime(positionSeconds)}</span>
          <div className="fullscreen-lyrics-progress-bar">
            <MediaProgressBar
              position={positionSeconds}
              duration={durationSeconds}
              isPlaying={isPlaying}
              disabled={durationSeconds <= 0}
              onSeek={onSeek}
              ariaLabel="Posición de reproducción"
            />
          </div>
          <span className="fullscreen-lyrics-time">{formatTime(durationSeconds)}</span>
        </div>

        <div className="fullscreen-lyrics-controls-row">
          <div className="fullscreen-lyrics-meta-pill">
            {queueCount > 0 ? (
              <span>Pista {currentIndex + 1} de {queueCount}</span>
            ) : (
              <span>Prisma Media</span>
            )}
          </div>

          <div className="fullscreen-lyrics-transport">
            <button
              className="fullscreen-transport-btn"
              onClick={onPrevious}
              aria-label="Pista anterior"
              title="Anterior (P)"
            >
              <Icon name="chevron-left" />
            </button>

            <button
              className="fullscreen-transport-play-btn"
              onClick={onTogglePlay}
              aria-label={isPlaying ? "Pausar" : "Reproducir"}
              title={isPlaying ? "Pausar (Espacio)" : "Reproducir (Espacio)"}
            >
              <Icon name={isPlaying ? "pause" : "play"} />
            </button>

            <button
              className="fullscreen-transport-btn"
              onClick={onNext}
              aria-label="Siguiente pista"
              title="Siguiente (N)"
            >
              <Icon name="chevron-right" />
            </button>
          </div>

          <div className="fullscreen-lyrics-aux-controls">
            {onToggleShuffle ? (
              <button
                className={`fullscreen-aux-btn ${shuffleMode ? "is-active" : ""}`}
                onClick={onToggleShuffle}
                title={shuffleMode ? "Desactivar aleatorio" : "Activar aleatorio"}
                aria-label="Aleatorio"
              >
                <Icon name="shuffle" />
              </button>
            ) : null}

            {onToggleRepeat ? (
              <button
                className={`fullscreen-aux-btn ${repeatMode !== "off" ? "is-active" : ""}`}
                onClick={onToggleRepeat}
                title={`Repetición: ${repeatMode}`}
                aria-label="Repetición"
              >
                <Icon name="repeat" />
                {repeatMode === "one" ? <span className="repeat-dot">1</span> : null}
              </button>
            ) : null}

            <div className="fullscreen-volume-control">
              <button
                className="fullscreen-aux-btn"
                onClick={() => onVolume?.(volume > 0 ? 0 : 70)}
                title={volume > 0 ? "Silenciar" : "Restaurar volumen"}
                aria-label="Volumen"
              >
                <Icon name={volume === 0 ? "volume-mute" : "volume"} />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => onVolume?.(Number(e.target.value))}
                className="fullscreen-volume-slider"
                aria-label="Control de volumen"
              />
            </div>
          </div>
        </div>
      </footer>

      {/* Modal de edición de letras */}
      {path && isEditorOpen ? (
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
    </div>
  );
}
