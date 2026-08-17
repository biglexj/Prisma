import { useEffect, useState, type CSSProperties } from "react";
import type { PlaybackCapabilities, PlaybackSnapshot } from "../../model/types";
import type { PlaybackQueueState } from "../../usePlaybackQueue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../../shared/ui/Icon";
import { useMusicArtwork, prefetchArtwork } from "../../../music_library/useMusicArtwork";
import { VisualThumbnail } from "../../../visual_library/ui/VisualThumbnail";
import { VideoThumbnail } from "../../../visual_library/ui/VideoThumbnail";
import { useFavorites } from "../../../../shared/useFavorites";
import { useAlbumPalette } from "../useAlbumPalette";
import { LyricsPreview } from "./LyricsPreview";
import { PlaybackQueuePanel } from "./PlaybackQueuePanel";
import { parseTrackInfo } from "../../../music_library/model/trackInfo";
import { useScrollRestoration } from "../../../../shared/useScrollRestoration";
import { MediaProgressBar } from "../../../../shared/ui/MediaProgressBar";
import "./album-adaptive.css";
import "./playback-queue.css";
import { cleanPath, formatSession, formatTime, mediaTitle } from "../formatters";

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
  onSwitchQueue?: (queueId: string) => void;
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
  onSwitchQueue,
}: PlaybackPreviewProps) {
  const [viewMode, setViewMode] = useState<"cover" | "lyrics" | "queue">("cover");
  useScrollRestoration(`view:player:${viewMode}`);
  const currentQueueItem = queueState?.queue.items[queueState.queue.currentIndex];
  const effectivePath = snapshot.path || currentQueueItem?.path || null;
  const hasMedia = Boolean(snapshot.path);
  const hasEffectiveMedia = Boolean(effectivePath);
  const duration = snapshot.durationSeconds ?? 0;
  const position = Math.min(snapshot.positionSeconds ?? 0, Math.max(duration, 1));
  const rawTitle = mediaTitle(snapshot.path);
  const parsed = parseTrackInfo(rawTitle);
  const tagTitle = snapshot.trackTitle?.trim();
  const tagArtist = snapshot.trackArtist?.trim();
  const trackTitle = tagTitle || currentQueueItem?.title || parsed.title || (hasEffectiveMedia ? rawTitle : "Nada reproduciéndose");
  const trackArtist = tagArtist || currentQueueItem?.artist || parsed.artist || "";
  const isAudio = snapshot.session?.family === "audio" || (!snapshot.session && hasEffectiveMedia);
  const isImage = snapshot.session?.family === "image";
  const isVideo = snapshot.session?.family === "video";
  const artwork = useMusicArtwork(isAudio ? effectivePath : null, isAudio && hasEffectiveMedia);
  const palette = useAlbumPalette(artwork);
  const favorites = useFavorites();
  const isFav = favorites.isFavorite(effectivePath);
  const adaptiveStyle = palette ? ({
    "--album-accent": palette.accent,
    "--album-accent-soft": palette.accentSoft,
    "--album-accent-deep": palette.accentDeep,
    "--album-on-accent": palette.onAccent,
  } as CSSProperties) : undefined;

  const queueCount = queueState?.queue.items.length ?? 0;

  // Precarga fluida de carátulas para pistas siguientes y anteriores en la cola
  useEffect(() => {
    if (!queueState || queueState.queue.items.length === 0) return;
    const items = queueState.queue.items;
    const currentIdx = queueState.queue.currentIndex;
    if (currentIdx + 1 < items.length) {
      prefetchArtwork(items[currentIdx + 1].path);
    }
    if (currentIdx + 2 < items.length) {
      prefetchArtwork(items[currentIdx + 2].path);
    }
    if (currentIdx > 0) {
      prefetchArtwork(items[currentIdx - 1].path);
    }
  }, [queueState?.queue.currentIndex, queueState?.queue.items]);

  // Escucha remota de pestañas desde Aurora Synapse (Super Gallery)
  useEffect(() => {
    const handleSetTab = (e: CustomEvent<{ tab: "cover" | "lyrics" | "queue" }>) => {
      if (e.detail?.tab) {
        setViewMode(e.detail.tab);
      }
    };
    const handleToggleLyrics = () => {
      setViewMode((prev) => (prev === "lyrics" ? "cover" : "lyrics"));
    };
    const handleToggleQueue = () => {
      setViewMode((prev) => (prev === "queue" ? "cover" : "queue"));
    };
    window.addEventListener("prisma-music-tab", handleSetTab as EventListener);
    window.addEventListener("prisma-music-toggle-lyrics", handleToggleLyrics);
    window.addEventListener("prisma-music-toggle-queue", handleToggleQueue);
    return () => {
      window.removeEventListener("prisma-music-tab", handleSetTab as EventListener);
      window.removeEventListener("prisma-music-toggle-lyrics", handleToggleLyrics);
      window.removeEventListener("prisma-music-toggle-queue", handleToggleQueue);
    };
  }, []);

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
          >
            <Icon name="queue" /> <span>Cola</span>
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
            onSwitchQueue={onSwitchQueue}
          />
        ) : viewMode === "lyrics" ? (
          <LyricsPreview
            path={effectivePath}
            title={trackTitle}
            positionSeconds={position}
            durationSeconds={duration}
            onSeek={onSeek}
            onBackToCover={() => setViewMode("cover")}
          />
        ) : (
          <div
            className={`preview-artwork ${hasEffectiveMedia ? "has-media" : "is-empty"} ${isVideo ? "is-video-surface" : ""} ${isAudio ? "is-interactive" : ""}`}
            onClick={isAudio && hasEffectiveMedia ? () => setViewMode("lyrics") : undefined}
            title={isAudio && hasEffectiveMedia ? "Haz clic en la carátula para ver las letras" : undefined}
            role={isAudio && hasEffectiveMedia ? "button" : undefined}
            tabIndex={isAudio && hasEffectiveMedia ? 0 : undefined}
          >
            {artwork ? <span className="preview-cover-artwork"><img alt={`Carátula de ${trackTitle}`} src={artwork} /></span> : null}
            {isImage && effectivePath ? <VisualThumbnail key={effectivePath} className="preview-cover-artwork" path={effectivePath} alt={trackTitle} eager fit="contain" /> : null}
            {isVideo && effectivePath ? <VideoThumbnail key={effectivePath} className="preview-cover-artwork" path={effectivePath} title={trackTitle} /> : null}
            {isAudio ? <div className="artwork-record" aria-hidden="true"><i /></div> : null}
            {isAudio ? <div className="artwork-wave" aria-hidden="true">{WAVE_BARS}</div> : null}
            {!isVideo && !artwork && !isImage ? <span className="artwork-monogram">{hasEffectiveMedia ? trackTitle.slice(0, 1).toUpperCase() : "P"}</span> : null}

            {isAudio && hasEffectiveMedia ? (
              <span className="preview-artwork-lyrics-hint" aria-hidden="true">
                <Icon name="music" />
                <span>Ver letras</span>
              </span>
            ) : null}
          </div>
        )}

        <div className="preview-controls">
          <div className="preview-track-title">
            <div>
              <span>{hasMedia ? "REPRODUCIENDO" : "LISTO PARA REPRODUCIR"}</span>
              <h2>{trackTitle}</h2>
              {trackArtist ? (
                <p className="preview-track-artist">{trackArtist}</p>
              ) : !hasEffectiveMedia ? (
                <p>Selecciona un archivo compatible para comenzar</p>
              ) : null}
            </div>
            <div className="preview-title-actions">
              <button
                aria-label={isFav ? "Quitar de favoritos" : "Marcar como favorito"}
                className={`preview-fav-btn ${isFav ? "is-favorite" : ""}`}
                disabled={!hasEffectiveMedia}
                onClick={() => {
                  if (effectivePath) {
                    favorites.toggleFavorite(
                      effectivePath,
                      isVideo ? "video" : isImage ? "image" : "music"
                    );
                  }
                }}
                title={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
              >
                <Icon name="heart" />
              </button>
            </div>
          </div>

          <div className="preview-progress">
            <MediaProgressBar
              position={position}
              duration={duration}
              isPlaying={!snapshot.paused && hasMedia}
              disabled={!enabled || !hasEffectiveMedia || duration <= 0}
              onSeek={onSeek}
              ariaLabel="Posición de reproducción"
            />
            <span>{formatTime(snapshot.positionSeconds)}</span>
            <span>{formatTime(snapshot.durationSeconds)}</span>
          </div>

          <div className="preview-transport">
            <button
              aria-label="Anterior"
              disabled={busy || (!snapshot.session?.canGoPrevious && !queueState?.canGoPrevious)}
              onClick={onPrevious}
            ><Icon name="chevron-left" /></button>
            <button
              className="preview-play"
              disabled={!enabled || !hasEffectiveMedia || busy}
              onClick={hasMedia ? onToggle : currentQueueItem ? () => onSelectQueueIndex?.(queueState?.queue.currentIndex ?? 0) : onToggle}
            >
              <Icon name={snapshot.paused || !hasMedia ? "play" : "pause"} />
              <span>{snapshot.paused || !hasMedia ? "Reproducir" : "Pausar"}</span>
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
            <button
              disabled={!hasMedia}
              onClick={() => {
                if (snapshot.path) {
                  void invoke("show_in_file_manager", { path: snapshot.path }).catch(() => {});
                }
              }}
              title="Abrir ubicación de la canción en el explorador"
              aria-label="Abrir ubicación en el explorador"
            ><Icon name="folder-open" /></button>
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

          {snapshot.path ? <p className="preview-path" title={cleanPath(snapshot.path)}>{cleanPath(snapshot.path)}</p> : null}
        </div>
      </div>
    </section>
  );
}
