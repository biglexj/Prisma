import { useState, type CSSProperties } from "react";
import type { PlaybackCapabilities, PlaybackSnapshot } from "../../model/types";
import type { PlaybackQueueState } from "../../usePlaybackQueue";
import { Icon } from "../../../../shared/ui/Icon";
import { useMusicArtwork } from "../../../music_library/useMusicArtwork";
import { VisualThumbnail } from "../../../visual_library/ui/VisualThumbnail";
import { VideoThumbnail } from "../../../visual_library/ui/VideoThumbnail";
import { useAlbumPalette } from "../useAlbumPalette";
import { LyricsPreview } from "./LyricsPreview";
import { PlaybackQueuePanel } from "./PlaybackQueuePanel";
import "./album-adaptive.css";
import "./playback-queue.css";
import {
  familyLabel,
  folderName,
  formatSession,
  formatTime,
  mediaTitle,
} from "../formatters";

const WAVE_BARS = Array.from({ length: 18 }, (_, index) => <i key={index} />);

interface PlaybackPreviewProps {
  capabilities: PlaybackCapabilities | null;
  snapshot: PlaybackSnapshot;
  busy: boolean;
  enabled: boolean;
  queueState?: PlaybackQueueState;
  onOpen: () => void;
  onPrevious: () => void;
  onToggle: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolume: (volume: number) => void;
  onSelectQueueIndex?: (index: number) => void;
}

export function PlaybackPreview({
  capabilities,
  snapshot,
  busy,
  enabled,
  queueState,
  onOpen,
  onPrevious,
  onToggle,
  onNext,
  onSeek,
  onVolume,
  onSelectQueueIndex,
}: PlaybackPreviewProps) {
  const [viewMode, setViewMode] = useState<"cover" | "lyrics" | "queue">("cover");
  const hasMedia = Boolean(snapshot.path);
  const duration = snapshot.durationSeconds ?? 0;
  const position = Math.min(snapshot.positionSeconds ?? 0, Math.max(duration, 1));
  const title = mediaTitle(snapshot.path);
  const family = familyLabel(snapshot.session?.family);
  const isAudio = snapshot.session?.family === "audio" || (!snapshot.session && hasMedia);
  const isImage = snapshot.session?.family === "image";
  const isVideo = snapshot.session?.family === "video";
  const artwork = useMusicArtwork(isAudio ? snapshot.path : null, isAudio && hasMedia);
  const palette = useAlbumPalette(artwork);
  const adaptiveStyle = palette ? ({
    "--album-accent": palette.accent,
    "--album-accent-soft": palette.accentSoft,
    "--album-accent-deep": palette.accentDeep,
    "--album-on-accent": palette.onAccent,
  } as CSSProperties) : undefined;

  const queueCount = queueState?.queue.items.length ?? 0;

  return (
    <section className={`preview-screen ${palette ? "has-album-palette" : ""}`} id="studio-home" style={adaptiveStyle}>
      <header className="preview-heading">
        <div>
          <span className="preview-kicker">REPRODUCTOR LOCAL</span>
          <h1>{isVideo ? "Vídeo" : isImage ? "Imagen" : "Música"}</h1>
        </div>

        <div className="preview-modes" aria-label="Modo de visualización">
          <button
            className={viewMode === "cover" ? "is-active" : ""}
            onClick={() => setViewMode("cover")}
          >
            <Icon name="disc" /> <span>Previa</span>
          </button>
          <button
            className={viewMode === "lyrics" ? "is-active" : ""}
            onClick={() => setViewMode("lyrics")}
          >
            <Icon name="music" /> <span>Letras</span>
          </button>
          <button
            className={viewMode === "queue" ? "is-active" : ""}
            onClick={() => setViewMode("queue")}
            title="Cola de reproducción"
          >
            <Icon name="queue" />
            <span>Cola</span>
            {queueCount > 0 ? <span className="badge">{queueCount}</span> : null}
          </button>
        </div>
      </header>

      <div className="preview-player">
        {viewMode === "queue" && queueState ? (
          <PlaybackQueuePanel
            queueState={queueState}
            onSelectTrack={(idx) => {
              if (onSelectQueueIndex) onSelectQueueIndex(idx);
            }}
          />
        ) : viewMode === "lyrics" ? (
          <LyricsPreview
            title={title}
            positionSeconds={position}
            durationSeconds={duration}
            onSeek={onSeek}
          />
        ) : (
          <div className={`preview-artwork ${hasMedia ? "has-media" : "is-empty"} ${isVideo ? "is-video-surface" : ""}`}>
            {artwork ? <span className="preview-cover-artwork"><img alt={`Carátula de ${title}`} src={artwork} /></span> : null}
            {isImage && snapshot.path ? <VisualThumbnail key={snapshot.path} className="preview-cover-artwork" path={snapshot.path} alt={title} eager fit="contain" /> : null}
            {isVideo && snapshot.path ? <VideoThumbnail key={snapshot.path} className="preview-cover-artwork" path={snapshot.path} title={title} /> : null}
            {isAudio ? <div className="artwork-record" aria-hidden="true"><i /></div> : null}
            {isAudio ? <div className="artwork-wave" aria-hidden="true">{WAVE_BARS}</div> : null}
            {!isVideo && !artwork && !isImage ? <span className="artwork-monogram">{hasMedia ? title.slice(0, 1).toUpperCase() : "P"}</span> : null}
            <div className="artwork-caption">
              <span>PRISMA</span>
              <strong>{hasMedia ? family : "TU BIBLIOTECA LOCAL"}</strong>
            </div>
          </div>
        )}

        <div className="preview-controls">
          <div className="preview-track-title">
            <div>
              <span>{hasMedia ? "REPRODUCIENDO DESDE TU EQUIPO" : "LISTO PARA REPRODUCIR"}</span>
              <h2>{title}</h2>
              <p>{snapshot.path ? folderName(snapshot.path) : "Selecciona un archivo compatible para comenzar"}</p>
            </div>
            <button aria-label="Favorito" disabled title="Favoritos · Próximamente"><Icon name="heart" /></button>
          </div>

          <label className="preview-progress">
            <input
              aria-label="Posición"
              type="range"
              min={0}
              max={Math.max(duration, 1)}
              step={0.1}
              value={position}
              disabled={!enabled || !hasMedia || duration <= 0}
              onChange={(event) => onSeek(Number(event.target.value))}
            />
            <span>{formatTime(snapshot.positionSeconds)}</span>
            <span>{formatTime(snapshot.durationSeconds)}</span>
          </label>

          <div className="preview-transport">
            <button
              aria-label="Anterior"
              disabled={busy || (!snapshot.session?.canGoPrevious && !queueState?.canGoPrevious)}
              onClick={onPrevious}
            ><Icon name="chevron-left" /></button>
            <button
              className="preview-play"
              disabled={!enabled || !hasMedia || busy}
              onClick={hasMedia ? onToggle : onOpen}
            >
              <Icon name={snapshot.paused ? "play" : "pause"} />
              <span>{snapshot.paused ? "Reproducir" : "Pausar"}</span>
            </button>
            <button
              aria-label="Siguiente"
              disabled={busy || (!snapshot.session?.canGoNext && !queueState?.canGoNext)}
              onClick={onNext}
            ><Icon name="chevron-right" /></button>
          </div>

          <div className="preview-actions">
            <button
              className={queueState?.shuffleMode ? "is-active" : ""}
              onClick={queueState?.toggleShuffle}
              title={queueState?.shuffleMode ? "Aleatorio activo (Pulsar para desactivar)" : "Activar modo aleatorio"}
              aria-label="Aleatorio"
            >
              <Icon name="shuffle" />
            </button>
            <div className="session-indicator">
              <span>{queueCount > 0 ? "COLA" : "SESIÓN"}</span>
              <strong>{queueCount > 0 ? `${(queueState?.queue.currentIndex ?? 0) + 1} de ${queueCount}` : formatSession(snapshot.session)}</strong>
            </div>
            <label className="preview-volume">
              <Icon name="volume" />
              <input
                aria-label="Volumen"
                type="range"
                min={0}
                max={100}
                value={snapshot.volume}
                disabled={!enabled}
                onChange={(event) => onVolume(Number(event.target.value))}
              />
              <span>{Math.round(snapshot.volume)}%</span>
            </label>
            <button
              className={queueState?.repeatMode !== "off" ? "is-active" : ""}
              onClick={queueState?.toggleRepeat}
              title={`Repetición: ${queueState?.repeatMode ?? "off"}`}
              aria-label="Repetición"
            >
              <Icon name="repeat" />
              {queueState?.repeatMode === "one" ? <span className="repeat-indicator">1</span> : null}
            </button>
            <button onClick={onOpen} title="Abrir otro archivo" aria-label="Abrir otro archivo"><Icon name="folder" /></button>
            <button
              className={viewMode === "queue" ? "is-active" : ""}
              onClick={() => setViewMode(viewMode === "queue" ? "cover" : "queue")}
              title="Ver cola de reproducción"
              aria-label="Cola"
            >
              <Icon name="queue" />
            </button>
          </div>

          <div className="preview-runtime">
            <span><i className={enabled ? "is-ready" : ""} /> {capabilities?.backend ?? "Conectando…"}</span>
            <span>{capabilities?.videoOutput ? "Salida de vídeo disponible" : "Salida de vídeo pendiente"}</span>
          </div>

          {snapshot.path ? <p className="preview-path" title={snapshot.path}>{snapshot.path}</p> : null}
        </div>
      </div>
    </section>
  );
}
