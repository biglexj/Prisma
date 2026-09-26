import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { PlaybackSnapshot } from "../model/types";
import type { MusicQueueItem } from "../model/queue";
import { parseTrackInfo } from "../../music_library/model/trackInfo";
import { mediaTitle } from "../ui/formatters";
import { useMusicArtwork } from "../../music_library/useMusicArtwork";

export const SILENT_AUDIO_URI =
  "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==";

interface UseMediaSessionSyncParams {
  snapshot: PlaybackSnapshot;
  currentItem?: MusicQueueItem | null;
  isVideoActive: boolean;
  silentAudioRef: RefObject<HTMLAudioElement | null>;
  onPlay: () => Promise<unknown> | void;
  onPause: () => Promise<unknown> | void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => Promise<unknown> | void;
}

/**
 * Hook para sincronizar la reproducción de música por libmpv con el servicio
 * MediaSession de Chromium y el control de transporte multimedia del sistema operativo (Windows SMTC).
 */
export function useMediaSessionSync({
  snapshot,
  currentItem,
  isVideoActive,
  silentAudioRef,
  onPlay,
  onPause,
  onPrevious,
  onNext,
  onSeek,
}: UseMediaSessionSyncParams) {
  const effectivePath = snapshot.path || currentItem?.path || null;
  const isAudioActive = Boolean(effectivePath) && !isVideoActive;
  const isAudioPlaying = isAudioActive && !snapshot.paused;

  // Obtener carátula si la música está activa
  const artwork = useMusicArtwork(isAudioActive ? effectivePath : null, isAudioActive);

  // Mantener referencias actualizadas a las funciones para evitar re-binds innecesarios de handlers
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  const onPreviousRef = useRef(onPrevious);
  onPreviousRef.current = onPrevious;
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  // 1. Control del elemento de audio silencioso para mantener vivo el SMTC de Chromium
  useEffect(() => {
    const audio = silentAudioRef.current;
    if (!audio) return;

    if (isAudioPlaying) {
      audio.volume = 0.001;
      audio.muted = false;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } else {
      audio.pause();
    }
  }, [isAudioPlaying, silentAudioRef]);

  // 2. Registro de handlers y sincronización de metadatos cuando la música tiene el control
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    // Si hay un vídeo activo, delegar la MediaSession por completo a VideoPlayer
    if (isVideoActive) return;

    if (!effectivePath) {
      navigator.mediaSession.playbackState = "none";
      navigator.mediaSession.metadata = null;
      return;
    }

    const rawTitle = mediaTitle(effectivePath);
    const parsed = parseTrackInfo(rawTitle);
    const title = snapshot.trackTitle?.trim() || currentItem?.title || parsed.title || rawTitle;
    const artist = snapshot.trackArtist?.trim() || currentItem?.artist || parsed.artist || "Prisma";
    const album = snapshot.trackAlbum?.trim() || "Música";

    const artworkList: MediaImage[] = [];
    if (artwork) {
      artworkList.push({ src: artwork, sizes: "512x512" });
    }
    artworkList.push(
      { src: "/icon/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/favicon.ico", sizes: "256x256", type: "image/x-icon" },
    );

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork: artworkList,
    });

    navigator.mediaSession.playbackState = snapshot.paused ? "paused" : "playing";

    // Registrar Action Handlers para teclas multimedia globales (F6, F7, F8, headset, etc.)
    const actions: Array<{ action: MediaSessionAction; handler: MediaSessionActionHandler }> = [
      { action: "play", handler: () => void onPlayRef.current() },
      { action: "pause", handler: () => void onPauseRef.current() },
      { action: "stop", handler: () => void onPauseRef.current() },
      { action: "previoustrack", handler: () => onPreviousRef.current() },
      { action: "nexttrack", handler: () => onNextRef.current() },
      {
        action: "seekto",
        handler: (details) => {
          if (details.seekTime != null) {
            void onSeekRef.current(details.seekTime);
          }
        },
      },
    ];

    for (const { action, handler } of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {}
    }

    return () => {
      // Limpiar handlers solo si este hook sigue a cargo
      if (!isVideoActive) {
        for (const { action } of actions) {
          try {
            navigator.mediaSession.setActionHandler(action, null);
          } catch {}
        }
      }
    };
  }, [
    effectivePath,
    isVideoActive,
    snapshot.trackTitle,
    snapshot.trackArtist,
    snapshot.trackAlbum,
    snapshot.paused,
    currentItem?.title,
    currentItem?.artist,
    artwork,
  ]);

  // 3. Sincronización continua de la barra de posición y duración (Timeline en Windows SMTC)
  useEffect(() => {
    if (!("mediaSession" in navigator) || isVideoActive) return;

    if (
      "setPositionState" in navigator.mediaSession &&
      snapshot.durationSeconds &&
      snapshot.durationSeconds > 0
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, snapshot.durationSeconds),
          playbackRate: snapshot.speed ?? 1.0,
          position: Math.min(
            snapshot.durationSeconds,
            Math.max(0, snapshot.positionSeconds ?? 0),
          ),
        });
      } catch {}
    }
  }, [
    snapshot.durationSeconds,
    snapshot.positionSeconds,
    snapshot.speed,
    isVideoActive,
  ]);
}
