import { convertFileSrc } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { parseTrackInfo } from "../../music_library/model/trackInfo";
import { useMusicArtwork } from "../../music_library/useMusicArtwork";
import { formatTime, mediaTitle } from "../../playback/ui/formatters";
import { useAlbumPalette } from "../../playback/ui/useAlbumPalette";
import { MediaProgressBar } from "../../../shared/ui/MediaProgressBar";
import type { QuickLookPayload } from "../model/types";

interface QuickLookMusicProps {
  payload: QuickLookPayload;
  onPaletteChange?: (style?: CSSProperties) => void;
  onTimeUpdate?: (seconds: number) => void;
}

export function QuickLookMusic({ payload, onPaletteChange, onTimeUpdate }: QuickLookMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
  const [duration, setDuration] = useState(payload.durationSeconds ?? 0);
  const [volume, setVolume] = useState(0.85);
  const [prevVolume, setPrevVolume] = useState(0.85);

  useEffect(() => {
    const adaptMusicSize = async () => {
      try {
        const win = getCurrentWebviewWindow();
        if (!(await win.isMaximized())) {
          await win.setSize(new LogicalSize(640, 390));
          await win.center();
        }
      } catch {}
    };
    void adaptMusicSize();
  }, []);

  const rawTitle = mediaTitle(payload.path);
  const parsed = parseTrackInfo(rawTitle);
  const trackTitle = payload.trackTitle || parsed.title || rawTitle;
  const trackArtist = payload.trackArtist || parsed.artist || "Artista desconocido";

  const artwork = useMusicArtwork(payload.path, true);
  const palette = useAlbumPalette(artwork);

  useEffect(() => {
    if (palette) {
      onPaletteChange?.({
        "--ql-accent": palette.accent,
        "--ql-accent-soft": palette.accentSoft,
        "--ql-accent-deep": palette.accentDeep,
      } as CSSProperties);
    } else {
      onPaletteChange?.(undefined);
    }
  }, [palette, onPaletteChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = convertFileSrc(payload.path);
    audio.volume = isMuted ? 0 : volume;
    audio.muted = isMuted;
    audio.loop = isLoop;
    audio.currentTime = 0;
    setPosition(0);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }

    // Detener audio al cerrar/ocultar la ventana Quick Look
    const unlistenHide = listen("quicklook://hide", () => {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setPosition(0);
    });

    return () => {
      audio.pause();
      audio.src = "";
      unlistenHide.then((u) => u());
    };
  }, [payload.path]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const toggleLoop = () => {
    const nextLoop = !isLoop;
    setIsLoop(nextLoop);
    try {
      localStorage.setItem("prisma:quicklook_loop", String(nextLoop));
    } catch {}
    if (audioRef.current) {
      audioRef.current.loop = nextLoop;
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted || volume === 0) {
      const restored = prevVolume > 0 ? prevVolume : 0.85;
      setVolume(restored);
      setIsMuted(false);
      audio.volume = restored;
      audio.muted = false;
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
      audio.volume = 0;
      audio.muted = true;
    }
  };

  const handleSeek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setPosition(seconds);
    onTimeUpdate?.(seconds);
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setPosition(0);
    onTimeUpdate?.(0);
    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    const audio = audioRef.current;
    setVolume(newVolume);
    if (newVolume > 0) {
      setIsMuted(false);
      setPrevVolume(newVolume);
    }
    if (audio) {
      audio.volume = newVolume;
      audio.muted = newVolume === 0;
    }
  };

  return (
    <div className="quicklook-music-content">
      <audio
        ref={audioRef}
        loop={isLoop}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          if (isLoop) {
            const audio = audioRef.current;
            if (audio) {
              audio.currentTime = 0;
              void audio.play();
              setIsPlaying(true);
            }
          } else {
            setIsPlaying(false);
          }
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setPosition(t);
          onTimeUpdate?.(t);
        }}
      />

      <div className="quicklook-music-main">
        <div className="quicklook-music-cover-wrapper">
          {artwork ? (
            <img alt={trackTitle} src={artwork} />
          ) : (
            <div className="quicklook-music-cover-fallback">
              <Icon name="music" />
            </div>
          )}
        </div>

        <div className="quicklook-music-meta">
          <h2 className="quicklook-music-title" title={trackTitle}>
            {trackTitle}
          </h2>
          <p className="quicklook-music-artist" title={trackArtist}>
            {trackArtist}
          </p>
          <p className="quicklook-music-subtext">
            <span>{formatTime(duration > 0 ? duration : (payload.durationSeconds ?? null))}</span>
            <span>•</span>
            <span>Audio local</span>
          </p>

        </div>
      </div>

      <div className="quicklook-music-controls">
        <div className="quicklook-seek-row">
          <span className="quicklook-time-text">{formatTime(position)}</span>
          <MediaProgressBar
            position={position}
            duration={duration}
            isPlaying={isPlaying}
            disabled={duration <= 0}
            onSeek={handleSeek}
            className="quicklook-seek-bar"
            ariaLabel="Progreso de audio"
            activeColor="var(--primary)"
            inactiveColor="var(--outline-variant)"
            thumbColor="#ffffff"
          />
          <span className="quicklook-time-text">{formatTime(duration)}</span>
        </div>

        <div className="quicklook-transport-row">
          <div className="quicklook-transport-buttons">
            <button
              type="button"
              className="quicklook-play-btn"
              onClick={togglePlay}
              title={isPlaying ? "Pausar (Espacio)" : "Reproducir (Espacio)"}
            >
              <Icon name={isPlaying ? "pause" : "play"} />
            </button>

            <button
              type="button"
              className="quicklook-icon-btn"
              onClick={handleRestart}
              title="Reiniciar reproducción"
            >
              <Icon name="refresh" />
            </button>

            <button
              type="button"
              className={`quicklook-icon-btn ${isLoop ? "is-active" : ""}`}
              onClick={toggleLoop}
              title={isLoop ? "Desactivar bucle" : "Activar bucle (Repetir)"}
            >
              <Icon name="repeat" />
            </button>
          </div>

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
              aria-label="Volumen"
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
    </div>
  );
}
