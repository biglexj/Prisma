import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { parseTrackInfo } from "../../music_library/model/trackInfo";
import { useMusicArtwork } from "../../music_library/useMusicArtwork";
import { formatTime, mediaTitle } from "../../playback/ui/formatters";
import { useAlbumPalette } from "../../playback/ui/useAlbumPalette";
import type { QuickLookPayload } from "../model/types";

interface QuickLookMusicProps {
  payload: QuickLookPayload;
  onPaletteChange?: (style?: CSSProperties) => void;
}

export function QuickLookMusic({ payload, onPaletteChange }: QuickLookMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(payload.durationSeconds ?? 0);
  const [volume, setVolume] = useState(0.85);

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
    audio.volume = volume;
    audio.currentTime = 0;
    setPosition(0);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
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

  const handleSeek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setPosition(seconds);
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setPosition(0);
    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    const audio = audioRef.current;
    setVolume(newVolume);
    if (audio) {
      audio.volume = newVolume;
    }
  };

  return (
    <div className="quicklook-music-content">
      <audio
        ref={audioRef}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
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
          <input
            aria-label="Progreso de audio"
            className="quicklook-seek-bar"
            max={Math.max(duration, 1)}
            min={0}
            step={0.1}
            type="range"
            value={position}
            onChange={(e) => handleSeek(Number(e.target.value))}
          />
          <span className="quicklook-time-text">{formatTime(duration)}</span>
        </div>

        <div className="quicklook-transport-row">
          <div className="quicklook-transport-buttons">
            <button
              className="quicklook-play-btn"
              onClick={togglePlay}
              title={isPlaying ? "Pausar (Espacio)" : "Reproducir (Espacio)"}
            >
              <Icon name={isPlaying ? "pause" : "play"} />
            </button>

            <button
              className="quicklook-icon-btn"
              onClick={handleRestart}
              title="Reiniciar reproducción"
            >
              <Icon name="refresh" />
            </button>
          </div>

          <div className="quicklook-volume-group">
            <Icon name="volume" />
            <input
              aria-label="Volumen"
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
    </div>
  );
}
