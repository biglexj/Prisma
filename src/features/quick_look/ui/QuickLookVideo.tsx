import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { formatTime } from "../../playback/ui/formatters";
import { MediaProgressBar } from "../../../shared/ui/MediaProgressBar";
import type { QuickLookPayload } from "../model/types";

interface QuickLookVideoProps {
  payload: QuickLookPayload;
  onDimensionsLoad?: (dims: { width: number; height: number }) => void;
  onTimeUpdate?: (seconds: number) => void;
  onOpenInMain?: () => void;
}

export function QuickLookVideo({ payload, onDimensionsLoad, onTimeUpdate, onOpenInMain }: QuickLookVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

    setHasError(false);
    setErrorMessage(null);
    setIsReady(false);

    // Cache-buster con tamaño y fecha de modificación para evitar que Chromium
    // sirva byte-ranges obsoletos cuando el archivo fue sobrescrito (ej. DaVinci Resolve)
    const fileSrc = convertFileSrc(payload.path);
    const cacheKey = payload.fileSizeBytes
      ? `?v=${payload.fileSizeBytes}_${encodeURIComponent(payload.modifiedDate || "")}`
      : `?t=${Date.now()}`;
    video.src = `${fileSrc}${cacheKey}`;

    video.volume = isMuted ? 0 : volume;
    video.muted = isMuted;
    video.loop = isLoop;
    video.currentTime = 0;
    setPosition(0);

    // Detener vídeo al cerrar/ocultar la ventana Quick Look (X o click fuera).
    const isPrimary = getCurrentWebviewWindow().label === "quicklook";
    const unlistenHide = isPrimary
      ? listen("quicklook://hide", () => {
          video.pause();
          video.currentTime = 0;
          setIsPlaying(false);
          setPosition(0);
        })
      : Promise.resolve(() => {});

    return () => {
      video.pause();
      // Liberar completamente el stream de red y los handles de archivo en Chromium/WebView2
      video.removeAttribute("src");
      video.load();
      unlistenHide.then((u) => u());
    };
  }, [payload.path, payload.fileSizeBytes, payload.modifiedDate]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
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

  const handleCanPlay = () => {
    setIsReady(true);
    const video = videoRef.current;
    if (video && video.paused && isPlaying) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    const err = video.error;
    let message = "No se pudo reproducir este archivo de vídeo.";
    if (err) {
      if (err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        message = "El códec o formato no es compatible con el visor ligero (HTML5).";
      } else if (err.code === MediaError.MEDIA_ERR_DECODE) {
        message = "Error al decodificar vídeo. El archivo puede estar siendo renderizado o incompleto.";
      } else if (err.code === MediaError.MEDIA_ERR_NETWORK) {
        message = "Error de acceso al archivo en disco.";
      }
    }
    setHasError(true);
    setErrorMessage(message);
    setIsPlaying(false);
  };

  const handleRetry = () => {
    setHasError(false);
    setErrorMessage(null);
    setIsReady(false);
    const video = videoRef.current;
    if (!video) return;
    const fileSrc = convertFileSrc(payload.path);
    video.src = `${fileSrc}?retry=${Date.now()}`;
    video.load();
    void video.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  return (
    <div className="quicklook-video-content">
      <video
        ref={videoRef}
        className={`quicklook-video-element ${isReady ? "is-ready" : ""}`}
        loop={isLoop}
        playsInline
        poster={payload.videoPosterUrl || undefined}
        onClick={togglePlay}
        onCanPlay={handleCanPlay}
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
        onError={handleVideoError}
        onLoadedData={() => setIsReady(true)}
        onLoadedMetadata={handleLoadedMetadata}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setPosition(t);
          onTimeUpdate?.(t);
        }}
      />

      {hasError && (
        <div className="quicklook-video-error-state">
          <div className="quicklook-video-error-icon">
            <Icon name="info" />
          </div>
          <span className="quicklook-video-error-title">{errorMessage || "Error al reproducir vídeo"}</span>
          <span className="quicklook-video-error-desc">
            Si el archivo está siendo exportado por DaVinci Resolve u otra aplicación, espera a que termine el renderizado y pulsa reintentar.
          </span>
          <div className="quicklook-video-error-actions">
            <button
              type="button"
              className="quicklook-btn-retry"
              onClick={handleRetry}
            >
              <Icon name="rotate-ccw" /> Reintentar
            </button>
            {onOpenInMain && (
              <button
                type="button"
                className="quicklook-btn-retry quicklook-btn-accent"
                onClick={onOpenInMain}
              >
                <Icon name="external-link" /> Abrir en reproductor completo
              </button>
            )}
          </div>
        </div>
      )}

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
