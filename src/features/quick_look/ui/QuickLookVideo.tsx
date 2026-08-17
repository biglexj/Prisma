import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { formatTime } from "../../playback/ui/formatters";
import { MediaProgressBar } from "../../../shared/ui/MediaProgressBar";
import type { QuickLookPayload } from "../model/types";

interface QuickLookVideoProps {
  payload: QuickLookPayload;
  onDimensionsLoad?: (dims: { width: number; height: number }) => void;
  onTimeUpdate?: (seconds: number) => void;
}

export function QuickLookVideo({ payload, onDimensionsLoad, onTimeUpdate }: QuickLookVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoop, setIsLoop] = useState<boolean>(() => {
    try {
      return localStorage.getItem("prisma:quicklook_loop") === "true";
    } catch {
      return false;
    }
  });
  const [isMuted, setIsMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [prevVolume, setPrevVolume] = useState(0.85);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.src = convertFileSrc(payload.path);
    video.volume = isMuted ? 0 : volume;
    video.muted = isMuted;
    video.loop = isLoop;
    video.currentTime = 0;
    setPosition(0);

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }

    // Detener vídeo al cerrar/ocultar la ventana Quick Look (X o click fuera)
    const unlistenHide = listen("quicklook://hide", () => {
      video.pause();
      video.currentTime = 0;
      setIsPlaying(false);
      setPosition(0);
    });

    return () => {
      video.pause();
      video.src = "";
      unlistenHide.then((u) => u());
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

  const toggleLoop = () => {
    const nextLoop = !isLoop;
    setIsLoop(nextLoop);
    try {
      localStorage.setItem("prisma:quicklook_loop", String(nextLoop));
    } catch {}
    if (videoRef.current) {
      videoRef.current.loop = nextLoop;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted || volume === 0) {
      const restored = prevVolume > 0 ? prevVolume : 0.85;
      setVolume(restored);
      setIsMuted(false);
      video.volume = restored;
      video.muted = false;
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
      video.volume = 0;
      video.muted = true;
    }
  };

  const handleSeek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    setPosition(seconds);
    onTimeUpdate?.(seconds);
  };

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current;
    setVolume(newVolume);
    if (newVolume > 0) {
      setIsMuted(false);
      setPrevVolume(newVolume);
    }
    if (video) {
      video.volume = newVolume;
      video.muted = newVolume === 0;
    }
  };

  const handleLoadedMetadata = async (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setDuration(video.duration || 0);

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw > 0 && vh > 0) {
      onDimensionsLoad?.({ width: vw, height: vh });

      try {
        const isMax = await invoke<boolean>("quick_look_is_maximized");
        if (isMax) return;
        if (payload.width === vw && payload.height === vh) return;

        const screenW = window.screen.availWidth || 1920;
        const screenH = window.screen.availHeight || 1080;
        const maxAvailW = Math.min(screenW * 0.85, 1280);
        const maxAvailH = Math.min(screenH * 0.85, 820);

        const headerH = 48;
        const maxContentH = maxAvailH - headerH;

        const aspect = vw / vh;
        const scale = Math.min(1, maxAvailW / vw, maxContentH / vh);
        let fittedW = Math.round(vw * scale);
        let fittedH = Math.round(vh * scale);

        // Garantizar ancho mínimo respetando la proporción exacta de aspecto
        const minW = 440;
        if (fittedW < minW) {
          fittedW = minW;
          fittedH = Math.round(fittedW / aspect);
        }

        // Si sobrepasa el alto disponible, recalcular desde la altura máxima
        if (fittedH > maxContentH) {
          fittedH = maxContentH;
          fittedW = Math.round(fittedH * aspect);
        }

        const targetW = fittedW;
        const targetH = fittedH + headerH;

        void invoke("quick_look_set_size", { width: targetW, height: targetH }).catch(() => {});
      } catch {}
    }
  };

  return (
    <div className="quicklook-video-content">
      <video
        ref={videoRef}
        className="quicklook-video-element"
        loop={isLoop}
        playsInline
        onClick={togglePlay}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          if (isLoop) {
            const video = videoRef.current;
            if (video) {
              video.currentTime = 0;
              void video.play();
              setIsPlaying(true);
            }
          } else {
            setIsPlaying(false);
          }
        }}
        onLoadedMetadata={handleLoadedMetadata}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setPosition(t);
          onTimeUpdate?.(t);
        }}
      />

      <div className="quicklook-video-overlay-bar">
        <button
          type="button"
          className="quicklook-icon-btn"
          onClick={togglePlay}
          title={isPlaying ? "Pausar" : "Reproducir"}
        >
          <Icon name={isPlaying ? "pause" : "play"} />
        </button>

        <button
          type="button"
          className={`quicklook-icon-btn ${isLoop ? "is-active" : ""}`}
          onClick={toggleLoop}
          title={isLoop ? "Desactivar bucle" : "Activar bucle (Repetir)"}
        >
          <Icon name="repeat" />
        </button>

        <span className="quicklook-time-text">{formatTime(position)}</span>

        <MediaProgressBar
          position={position}
          duration={duration}
          isPlaying={isPlaying}
          disabled={duration <= 0}
          onSeek={handleSeek}
          className="quicklook-seek-bar"
          ariaLabel="Posición de vídeo"
          activeColor="var(--primary, #e06b9b)"
          inactiveColor="rgba(255, 255, 255, 0.32)"
          thumbColor="#ffffff"
        />

        <span className="quicklook-time-text">{formatTime(duration)}</span>

        <div className="quicklook-volume-group">
          <button
            type="button"
            className="quicklook-mute-btn"
            onClick={toggleMute}
            title={volume === 0 || isMuted ? "Activar sonido" : "Silenciar"}
          >
            <Icon name={volume === 0 || isMuted ? "volume-mute" : volume < 0.5 ? "volume-1" : "volume"} />
          </button>
          <input
            aria-label="Volumen de vídeo"
            className="quicklook-volume-slider"
            max={1}
            min={0}
            step={0.02}
            type="range"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
