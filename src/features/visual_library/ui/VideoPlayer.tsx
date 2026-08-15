import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { formatTime, mediaTitle } from "../../playback/ui/formatters";
import { Icon } from "../../../shared/ui/Icon";
import type { VisualLibraryItem } from "../model/types";
import { VideoThumbnail } from "./VideoThumbnail";
import "./video-player.css";

interface VideoPlayerProps {
  path: string | null;
  videoItems?: VisualLibraryItem[];
  onBack: () => void;
  onSelectVideo?: (path: string) => void;
}

export function VideoPlayer({
  path,
  videoItems = [],
  onBack,
  onSelectVideo,
}: VideoPlayerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [shuffleMode, setShuffleMode] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const hasMedia = Boolean(path);
  const title = mediaTitle(path);
  const videoSrc = path ? convertFileSrc(path) : "";

  // Reset state when path changes
  useEffect(() => {
    setVideoError(false);
    setPaused(false);
    setPosition(0);
    setDuration(0);
  }, [path]);

  // Current index in active video items
  const currentIndex = videoItems.findIndex((item) => item.path === path);
  const canGoPrevious = currentIndex > 0 || (repeatMode === "all" && videoItems.length > 1);
  const canGoNext =
    (currentIndex >= 0 && currentIndex < videoItems.length - 1) ||
    (repeatMode === "all" && videoItems.length > 1);

  const handlePrevious = () => {
    if (!onSelectVideo || videoItems.length === 0) return;
    if (position > 3) {
      if (videoRef.current) videoRef.current.currentTime = 0;
      setPosition(0);
      return;
    }
    if (currentIndex > 0) {
      onSelectVideo(videoItems[currentIndex - 1].path);
    } else if (repeatMode === "all" && videoItems.length > 1) {
      onSelectVideo(videoItems[videoItems.length - 1].path);
    }
  };

  const handleNext = () => {
    if (!onSelectVideo || videoItems.length === 0) return;
    if (repeatMode === "one") {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        void videoRef.current.play();
      }
      return;
    }
    if (shuffleMode && videoItems.length > 1) {
      const remaining = videoItems.filter((_, idx) => idx !== currentIndex);
      const randomItem = remaining[Math.floor(Math.random() * remaining.length)];
      if (randomItem) onSelectVideo(randomItem.path);
      return;
    }
    if (currentIndex >= 0 && currentIndex < videoItems.length - 1) {
      onSelectVideo(videoItems[currentIndex + 1].path);
    } else if (repeatMode === "all" && videoItems.length > 0) {
      onSelectVideo(videoItems[0].path);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else {
      video.pause();
      setPaused(true);
    }
  };

  const handleSeek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    setPosition(seconds);
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, vol / 100));
    }
  };

  const handleSkip = (secondsOffset: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, Math.min(duration, video.currentTime + secondsOffset));
    video.currentTime = target;
    setPosition(target);
  };

  const startFastForward = () => {
    if (!hasMedia || isFastForwarding) return;
    setIsFastForwarding(true);
    if (videoRef.current) videoRef.current.playbackRate = 2.0;
  };

  const stopFastForward = () => {
    if (!isFastForwarding) return;
    setIsFastForwarding(false);
    if (videoRef.current) videoRef.current.playbackRate = 1.0;
  };

  const toggleFullscreen = () => {
    const stage = document.getElementById("video-cinema-container");
    if (!stage) return;

    if (!document.fullscreenElement) {
      void stage.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      void document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => (prev === "off" ? "all" : prev === "all" ? "one" : "off"));
  };

  // Global keyboard shortcuts for video player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "j":
        case "arrowleft":
          e.preventDefault();
          handleSkip(-10);
          break;
        case "l":
        case "arrowright":
          e.preventDefault();
          handleSkip(10);
          break;
        case "arrowup":
          e.preventDefault();
          handleVolumeChange(Math.min(100, volume + 5));
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 5));
          break;
        case "n":
          e.preventDefault();
          handleNext();
          break;
        case "p":
          e.preventDefault();
          handlePrevious();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "escape":
          if (showPlaylist) {
            e.preventDefault();
            setShowPlaylist(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasMedia, paused, duration, volume, showPlaylist, handleNext, handlePrevious]);

  return (
    <section
      className={`video-player-screen ${isFullscreen ? "is-fullscreen-mode" : ""}`}
      id="video-cinema-container"
    >
      <header className="video-player-header">
        <button className="video-back-button" onClick={onBack} title="Volver a la biblioteca de vídeos">
          <Icon name="chevron-left" />
          <span>Volver a Vídeos</span>
        </button>

        <div className="video-header-info">
          <span className="video-kicker">
            CINE LOCAL · {videoItems.length > 0 ? `VÍDEO ${currentIndex + 1} DE ${videoItems.length}` : "REPRODUCTOR DE VÍDEO"}
          </span>
          <h1 title={title}>{title}</h1>
        </div>

        <div className="video-header-actions">
          {videoItems.length > 0 ? (
            <button
              className={`video-playlist-toggle-btn ${showPlaylist ? "is-active" : ""}`}
              onClick={() => setShowPlaylist(!showPlaylist)}
              title="Cola / Lista de vídeos"
            >
              <Icon name="queue" />
              <span>Lista ({videoItems.length})</span>
            </button>
          ) : null}
          <span className="connection-pill is-ready">
            <i /> Reproductor nativo
          </span>
        </div>
      </header>

      <div className="video-stage-wrapper">
        <div
          className={`video-stage ${isFastForwarding ? "is-fast-forwarding" : ""}`}
          onMouseDown={startFastForward}
          onMouseLeave={stopFastForward}
          onMouseUp={stopFastForward}
          onTouchEnd={stopFastForward}
          onTouchStart={startFastForward}
        >
          {hasMedia && !videoError ? (
            <video
              autoPlay
              className="video-stage-surface video-element-surface"
              onClick={togglePlay}
              onEnded={() => {
                setPaused(true);
                handleNext();
              }}
              onError={() => setVideoError(true)}
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                setDuration(video.duration || 0);
                setPaused(video.paused);
              }}
              onTimeUpdate={(e) => {
                setPosition(e.currentTarget.currentTime || 0);
              }}
              playsInline
              ref={videoRef}
              src={videoSrc}
            />
          ) : hasMedia ? (
            <VideoThumbnail
              className="video-stage-surface"
              eager
              path={path!}
              title={title}
            />
          ) : (
            <div className="video-empty-stage">
              <Icon name="video" />
              <p>Selecciona un vídeo para reproducir</p>
            </div>
          )}

          {isFastForwarding ? (
            <div aria-label="Reproduciendo a 2x de velocidad" className="video-speed-overlay">
              <span className="speed-icon-group">
                <Icon name="play" />
                <Icon name="play" />
              </span>
              <strong>2.0x Velocidad</strong>
            </div>
          ) : null}

          <button
            aria-label={paused ? "Reproducir vídeo" : "Pausar vídeo"}
            className="video-center-overlay-play"
            disabled={!hasMedia}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
          >
            <Icon name={paused ? "play" : "pause"} />
          </button>
        </div>

        {/* Panel lateral de Lista de Vídeos / Cola */}
        {showPlaylist ? (
          <aside className="video-playlist-sidebar">
            <header className="video-playlist-header">
              <div className="video-playlist-title-group">
                <h3>Cola de Vídeos</h3>
                <span>{videoItems.length} vídeos</span>
              </div>
              <button
                className="video-playlist-close-btn"
                onClick={() => setShowPlaylist(false)}
                title="Cerrar lista"
              >
                ✕
              </button>
            </header>
            <div className="video-playlist-list">
              {videoItems.map((item, idx) => {
                const isPlaying = item.path === path;
                return (
                  <div
                    key={item.path}
                    className={`video-playlist-item ${isPlaying ? "is-active" : ""}`}
                    onClick={() => {
                      if (onSelectVideo) onSelectVideo(item.path);
                    }}
                  >
                    <span className="video-playlist-thumb">
                      <VideoThumbnail path={item.path} title={item.title} />
                      {isPlaying ? <i className="video-playlist-play-icon">▶</i> : null}
                    </span>
                    <div className="video-playlist-item-info">
                      <strong title={item.title}>{item.title}</strong>
                      <small title={item.relativeFolder}>{item.relativeFolder}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        ) : null}
      </div>

      <div className="video-vlc-controls">
        <label className="video-progress-bar">
          <input
            aria-label="Posición de reproducción"
            disabled={!hasMedia || duration <= 0}
            max={Math.max(duration, 1)}
            min={0}
            onChange={(event) => handleSeek(Number(event.target.value))}
            step={0.1}
            type="range"
            value={position}
          />
          <div className="video-time-labels">
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </label>

        <div className="video-controls-toolbar">
          <div className="video-toolbar-left">
            <button
              aria-label="Vídeo anterior"
              disabled={!canGoPrevious}
              onClick={handlePrevious}
              title="Anterior (P)"
            >
              <Icon name="chevron-left" />
            </button>
            <button
              aria-label="Retroceder 10 segundos"
              disabled={!hasMedia}
              onClick={() => handleSkip(-10)}
              title="-10s (J)"
            >
              <small>-10s</small>
            </button>
            <button
              className={`video-control-toggle ${shuffleMode ? "is-active" : ""}`}
              onClick={() => setShuffleMode(!shuffleMode)}
              title={shuffleMode ? "Desactivar aleatorio" : "Activar aleatorio"}
            >
              <Icon name="shuffle" />
            </button>
          </div>

          <div className="video-toolbar-center">
            <button
              aria-label={paused ? "Reproducir" : "Pausar"}
              className="video-main-play-btn"
              disabled={!hasMedia}
              onClick={togglePlay}
            >
              <Icon name={paused ? "play" : "pause"} />
              <span>{paused ? "Reproducir" : "Pausar"}</span>
            </button>

            <button
              aria-label="Mantener presionado para 2x velocidad"
              className={`video-speed-btn ${isFastForwarding ? "is-active" : ""}`}
              disabled={!hasMedia}
              onMouseDown={startFastForward}
              onMouseLeave={stopFastForward}
              onMouseUp={stopFastForward}
              onTouchEnd={stopFastForward}
              onTouchStart={startFastForward}
              title="Mantén presionado para velocidad 2.0x"
            >
              <strong>2x</strong>
            </button>
          </div>

          <div className="video-toolbar-right">
            <button
              className={`video-control-toggle ${repeatMode !== "off" ? "is-active" : ""}`}
              onClick={toggleRepeat}
              title={`Repetición: ${repeatMode}`}
            >
              <Icon name="repeat" />
              {repeatMode === "one" ? <span className="repeat-indicator">1</span> : null}
            </button>
            <button
              aria-label="Adelantar 10 segundos"
              disabled={!hasMedia}
              onClick={() => handleSkip(10)}
              title="+10s (L)"
            >
              <small>+10s</small>
            </button>
            <button
              aria-label="Siguiente vídeo"
              disabled={!canGoNext}
              onClick={handleNext}
              title="Siguiente (N)"
            >
              <Icon name="chevron-right" />
            </button>

            <div className="video-volume-group">
              <Icon name="volume" />
              <input
                aria-label="Volumen"
                disabled={!hasMedia}
                max={100}
                min={0}
                onChange={(event) => handleVolumeChange(Number(event.target.value))}
                type="range"
                value={volume}
              />
              <span>{Math.round(volume)}%</span>
            </div>

            <button
              aria-label="Pantalla completa"
              className="video-fullscreen-btn"
              onClick={toggleFullscreen}
              title="Pantalla completa (F)"
            >
              <Icon name="layout" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
