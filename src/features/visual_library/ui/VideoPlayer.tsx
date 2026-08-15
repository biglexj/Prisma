import { useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
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
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const fastForwardIntervalRef = useRef<number | null>(null);

  const hasMedia = Boolean(path);
  const title = path ? mediaTitle(path) : "Sin vídeo seleccionado";
  const videoSrc = path ? convertFileSrc(path) : "";

  // Auto-detect current index in video list
  const currentIndex = videoItems.findIndex((item) => item.path === path);
  const hasNext = currentIndex >= 0 && currentIndex < videoItems.length - 1;
  const hasPrevious = currentIndex > 0;

  const handleNext = () => {
    if (repeatMode === "one" && videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play();
      return;
    }
    if (hasNext && onSelectVideo) {
      onSelectVideo(videoItems[currentIndex + 1].path);
    } else if (repeatMode === "all" && videoItems.length > 0 && onSelectVideo) {
      onSelectVideo(videoItems[0].path);
    }
  };

  const handlePrevious = () => {
    if (position > 3 && videoRef.current) {
      videoRef.current.currentTime = 0;
      return;
    }
    if (hasPrevious && onSelectVideo) {
      onSelectVideo(videoItems[currentIndex - 1].path);
    } else if (repeatMode === "all" && videoItems.length > 0 && onSelectVideo) {
      onSelectVideo(videoItems[videoItems.length - 1].path);
    }
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => (prev === "off" ? "all" : prev === "all" ? "one" : "off"));
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      void videoRef.current.play();
      setPaused(false);
    } else {
      videoRef.current.pause();
      setPaused(true);
    }
  };

  const handleSeek = (newTime: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = newTime;
    setPosition(newTime);
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
    }
  };

  const cyclePlaybackSpeed = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2, 0.5, 0.75];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleFullscreen = () => {
    const container = document.getElementById("video-cinema-container");
    if (!container) return;

    if (!document.fullscreenElement) {
      void container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const startFastForward = () => {
    if (!videoRef.current) return;
    setIsFastForwarding(true);
    videoRef.current.playbackRate = 3.0;
  };

  const stopFastForward = () => {
    if (!videoRef.current) return;
    setIsFastForwarding(false);
    videoRef.current.playbackRate = playbackSpeed;
  };

  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (!paused) {
        setShowControls(false);
      }
    }, 3500);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
      if (fastForwardIntervalRef.current) window.clearInterval(fastForwardIntervalRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          if (videoRef.current) {
            const nextPos = Math.max(0, videoRef.current.currentTime - 10);
            videoRef.current.currentTime = nextPos;
            setPosition(nextPos);
          }
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          if (videoRef.current) {
            const nextPos = Math.min(duration, videoRef.current.currentTime + 10);
            videoRef.current.currentTime = nextPos;
            setPosition(nextPos);
          }
          break;
        case "arrowup":
          e.preventDefault();
          handleVolumeChange(Math.min(100, volume + 5));
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 5));
          break;
        case "m":
          e.preventDefault();
          handleVolumeChange(volume > 0 ? 0 : 80);
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
      className={`video-player-screen ${isFullscreen ? "is-fullscreen-mode" : ""} ${!showControls && !paused ? "controls-hidden" : ""}`}
      id="video-cinema-container"
      onMouseMove={handleUserActivity}
    >
      <header className="video-player-header">
        <button className="video-back-button" onClick={onBack} title="Volver a la biblioteca de vídeos">
          <Icon name="chevron-left" />
          <span>Volver</span>
        </button>

        <div className="video-header-info">
          <div className="video-header-meta">
            <span className="video-kicker">
              CINE LOCAL · {videoItems.length > 0 ? `VÍDEO ${currentIndex + 1} DE ${videoItems.length}` : "REPRODUCTOR DE VÍDEO"}
            </span>
            {path ? (
              <button
                className="video-path-explorer-btn"
                onClick={() => {
                  invoke("show_in_file_manager", { path }).catch(() => {});
                }}
                title="Abrir ubicación en el Explorador de Windows"
              >
                <Icon name="folder" />
                <span>{path}</span>
              </button>
            ) : null}
          </div>
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
          ) : (
            <div className="video-empty-stage">
              <Icon name="video" />
              <p>{videoError ? "No se pudo cargar el formato del archivo de vídeo." : "Selecciona un vídeo para iniciar la proyección."}</p>
            </div>
          )}

          {isFastForwarding ? (
            <div className="video-ffw-indicator">
              <span>⏩ 3.0x Velocidad Rápida</span>
            </div>
          ) : null}

          {/* Central floating play/pause overlay trigger */}
          {hasMedia ? (
            <button
              aria-label={paused ? "Reproducir vídeo" : "Pausar vídeo"}
              className={`video-center-trigger ${paused ? "is-paused" : ""}`}
              onClick={togglePlay}
            >
              <Icon name={paused ? "play" : "pause"} />
            </button>
          ) : null}
        </div>

        {/* Playlist Lateral Desplegable */}
        {showPlaylist && videoItems.length > 0 ? (
          <aside className="video-playlist-sidebar">
            <div className="video-playlist-header">
              <h3>Cola de Proyección ({videoItems.length})</h3>
              <button
                aria-label="Cerrar lista"
                className="video-playlist-close"
                onClick={() => setShowPlaylist(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="video-playlist-items">
              {videoItems.map((item, idx) => {
                const isSelected = item.path === path;
                return (
                  <div
                    className={`video-playlist-item ${isSelected ? "is-active" : ""}`}
                    key={item.path}
                    onClick={() => onSelectVideo && onSelectVideo(item.path)}
                  >
                    <span className="video-playlist-item-idx">{idx + 1}</span>
                    <div className="video-playlist-thumb-wrap">
                      <VideoThumbnail className="video-playlist-thumb" path={item.path} title={item.title} />
                      {isSelected ? (
                        <div className="video-playlist-playing-badge">
                          <Icon name="play" />
                        </div>
                      ) : null}
                    </div>
                    <div className="video-playlist-item-info">
                      <strong title={item.title}>{item.title}</strong>
                      <small>{item.relativeFolder}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        ) : null}
      </div>

      <footer className="video-player-footer">
        <label className="preview-progress video-seek-bar">
          <input
            max={Math.max(duration, 1)}
            min={0}
            onChange={(e) => handleSeek(Number(e.target.value))}
            step={0.1}
            type="range"
            value={position}
          />
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </label>

        <div className="video-controls-row">
          <div className="video-controls-left">
            <button
              aria-label="Anterior"
              className="video-icon-btn"
              disabled={!hasPrevious && repeatMode !== "all"}
              onClick={handlePrevious}
              title="Vídeo anterior (P)"
            >
              <Icon name="chevron-left" />
            </button>
            <button
              aria-label="Retroceder 10s"
              className="video-icon-btn"
              onClick={() => {
                if (videoRef.current) {
                  const nextPos = Math.max(0, videoRef.current.currentTime - 10);
                  videoRef.current.currentTime = nextPos;
                  setPosition(nextPos);
                }
              }}
              title="Retroceder 10 segundos (←)"
            >
              <span className="btn-label-icon">-10s</span>
            </button>
            <button
              aria-label="Alternar pantalla completa"
              className="video-icon-btn"
              onClick={toggleFullscreen}
              title="Pantalla completa (F)"
            >
              <Icon name="layout" />
            </button>
          </div>

          <div className="video-controls-center">
            <button
              className="video-play-btn"
              disabled={!hasMedia}
              onClick={togglePlay}
            >
              <Icon name={paused ? "play" : "pause"} />
              <span>{paused ? "Reproducir" : "Pausar"}</span>
            </button>
            <button
              className="video-speed-pill"
              onClick={cyclePlaybackSpeed}
              title="Velocidad de reproducción"
            >
              <span>{playbackSpeed}x</span>
            </button>
          </div>

          <div className="video-controls-right">
            <button
              className={`video-icon-btn ${repeatMode !== "off" ? "is-active" : ""}`}
              onClick={toggleRepeat}
              title={`Repetición: ${repeatMode === "off" ? "Desactivada" : repeatMode === "all" ? "Toda la lista" : "Este vídeo"}`}
            >
              <Icon name="repeat" />
              {repeatMode === "one" ? <span className="repeat-badge">1</span> : null}
            </button>

            <button
              aria-label="Avanzar 10s"
              className="video-icon-btn"
              onClick={() => {
                if (videoRef.current) {
                  const nextPos = Math.min(duration, videoRef.current.currentTime + 10);
                  videoRef.current.currentTime = nextPos;
                  setPosition(nextPos);
                }
              }}
              title="Avanzar 10 segundos (→)"
            >
              <span className="btn-label-icon">+10s</span>
            </button>

            <button
              aria-label="Siguiente"
              className="video-icon-btn"
              disabled={!hasNext && repeatMode !== "all"}
              onClick={handleNext}
              title="Vídeo siguiente (N)"
            >
              <Icon name="chevron-right" />
            </button>

            <div className="video-volume-group">
              <button
                aria-label="Silenciar"
                className="video-icon-btn"
                onClick={() => handleVolumeChange(volume > 0 ? 0 : 80)}
              >
                <Icon name="volume" />
              </button>
              <input
                className="video-volume-slider"
                max={100}
                min={0}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                type="range"
                value={volume}
              />
              <span className="video-volume-value">{volume}%</span>
            </div>

            {videoItems.length > 0 ? (
              <button
                className={`video-icon-btn ${showPlaylist ? "is-active" : ""}`}
                onClick={() => setShowPlaylist(!showPlaylist)}
                title="Lista de reproducción"
              >
                <Icon name="queue" />
              </button>
            ) : null}
          </div>
        </div>
      </footer>
    </section>
  );
}
