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

  // Find index in videoItems for prev/next
  const currentIndex = videoItems.findIndex((item) => item.path === path);
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < videoItems.length - 1;

  const handlePrevious = () => {
    if (canGoPrevious && onSelectVideo) {
      onSelectVideo(videoItems[currentIndex - 1].path);
    }
  };

  const handleNext = () => {
    if (canGoNext && onSelectVideo) {
      onSelectVideo(videoItems[currentIndex + 1].path);
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
          <span className="video-kicker">CINE LOCAL · REPRODUCTOR DE VÍDEO</span>
          <h1 title={title}>{title}</h1>
        </div>

        <span className="connection-pill is-ready">
          <i /> Reproductor nativo HTML5
        </span>
      </header>

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
              if (canGoNext) handleNext();
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
              title="Anterior"
            >
              <Icon name="chevron-left" />
            </button>
            <button
              aria-label="Retroceder 10 segundos"
              disabled={!hasMedia}
              onClick={() => handleSkip(-10)}
              title="-10s"
            >
              <small>-10s</small>
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
              aria-label="Adelantar 10 segundos"
              disabled={!hasMedia}
              onClick={() => handleSkip(10)}
              title="+10s"
            >
              <small>+10s</small>
            </button>
            <button
              aria-label="Siguiente vídeo"
              disabled={!canGoNext}
              onClick={handleNext}
              title="Siguiente"
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
              title="Pantalla completa"
            >
              <Icon name="layout" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
