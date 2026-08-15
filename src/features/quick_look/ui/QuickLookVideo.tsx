import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { formatTime } from "../../playback/ui/formatters";
import type { QuickLookPayload } from "../model/types";

interface QuickLookVideoProps {
  payload: QuickLookPayload;
}

export function QuickLookVideo({ payload }: QuickLookVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.src = convertFileSrc(payload.path);
    video.volume = volume;
    video.currentTime = 0;
    setPosition(0);

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }

    return () => {
      video.pause();
      video.src = "";
    };
  }, [payload.path]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    setPosition(seconds);
  };

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current;
    setVolume(newVolume);
    if (video) {
      video.volume = newVolume;
    }
  };

  return (
    <div className="quicklook-video-content">
      <video
        ref={videoRef}
        className="quicklook-video-element"
        onClick={togglePlay}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
      />

      <div className="quicklook-video-overlay-bar">
        <button
          className="quicklook-icon-btn"
          onClick={togglePlay}
          title={isPlaying ? "Pausar" : "Reproducir"}
        >
          <Icon name={isPlaying ? "pause" : "play"} />
        </button>

        <span className="quicklook-time-text">{formatTime(position)}</span>

        <input
          aria-label="Posición de vídeo"
          className="quicklook-seek-bar"
          max={Math.max(duration, 1)}
          min={0}
          step={0.1}
          type="range"
          value={position}
          onChange={(e) => handleSeek(Number(e.target.value))}
        />

        <span className="quicklook-time-text">{formatTime(duration)}</span>

        <div className="quicklook-volume-group">
          <Icon name="volume" />
          <input
            aria-label="Volumen de vídeo"
            className="quicklook-volume-slider"
            max={1}
            min={0}
            step={0.02}
            type="range"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
