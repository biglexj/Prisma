import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { parseTrackInfo } from "../../music_library/model/trackInfo";
import { mediaTitle } from "../ui/formatters";
import { getFlyoutSettings } from "./flyoutSettings";
import type { usePlaybackController } from "../usePlaybackController";

interface UseFlyoutSyncParams {
  playback: ReturnType<typeof usePlaybackController>;
  isAudioPlaying: boolean;
  isVideoPlaying: boolean;
  isVideoActive: boolean;
  currentAudioPath: string | null;
  activeVideoPath: string | null;
  currentArtwork: string | null;
  onToggleVideoPlay?: () => void;
  onNextVideo?: () => void;
  onPrevVideo?: () => void;
}

export function useFlyoutSync({
  playback,
  isAudioPlaying,
  isVideoPlaying,
  isVideoActive,
  currentAudioPath,
  activeVideoPath,
  currentArtwork,
  onToggleVideoPlay,
  onNextVideo,
  onPrevVideo,
}: UseFlyoutSyncParams) {
  const previousVolumeRef = useRef<number>(playback.snapshot.volume);
  const lastActiveMediaRef = useRef<string | null>(null);

  // 1. Escuchar acciones despachadas desde el Flyout (Play/Pause, Next, Prev, Volume)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isMounted = true;

    void listen<{ action: string; value?: unknown }>("prisma://flyout-action", (event) => {
      if (!isMounted) return;
      const { action, value } = event.payload;

      switch (action) {
        case "play-pause":
          if (isVideoActive) {
            onToggleVideoPlay?.();
          } else {
            void playback.toggle();
          }
          break;

        case "next":
          if (isVideoActive) {
            onNextVideo?.();
          } else {
            playback.next();
          }
          break;

        case "previous":
          if (isVideoActive) {
            onPrevVideo?.();
          } else {
            playback.previous();
          }
          break;

        case "set-volume":
          if (typeof value === "number") {
            void playback.setVolume(value);
          }
          break;

        case "toggle-mute":
          if (playback.snapshot.volume === 0) {
            const restored = previousVolumeRef.current > 0 ? previousVolumeRef.current : 50;
            void playback.setVolume(restored);
          } else {
            previousVolumeRef.current = playback.snapshot.volume;
            void playback.setVolume(0);
          }
          break;
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [isVideoActive, onToggleVideoPlay, onNextVideo, onPrevVideo, playback]);

  // 2. Transmitir estado y metadatos hacia el Flyout
  useEffect(() => {
    const settings = getFlyoutSettings();
    if (!settings.enabled) return;

    let title = "Prisma";
    let artist = "Listo para reproducir";
    let artworkUrl: string | null = null;
    let isPlaying = false;
    let mediaType: "audio" | "video" = "audio";
    const currentMediaId = isVideoActive ? activeVideoPath : currentAudioPath;

    if (isVideoActive && activeVideoPath) {
      mediaType = "video";
      isPlaying = isVideoPlaying;
      title = mediaTitle(activeVideoPath);
      artist = "Vídeo · Prisma";
      artworkUrl = null;
    } else if (currentAudioPath) {
      mediaType = "audio";
      isPlaying = isAudioPlaying;
      const rawTitle = mediaTitle(currentAudioPath);
      const parsed = parseTrackInfo(rawTitle);
      title = playback.snapshot.trackTitle?.trim() || playback.queue.currentItem?.title || parsed.title || rawTitle;
      artist = playback.snapshot.trackArtist?.trim() || playback.queue.currentItem?.artist || parsed.artist || "Prisma";
      artworkUrl = currentArtwork || null;
    }

    void emit("prisma://flyout-state-sync", {
      isPlaying,
      title,
      artist,
      artworkUrl,
      mediaType,
      volume: playback.snapshot.volume,
      isMuted: playback.snapshot.volume === 0,
      duration: playback.snapshot.durationSeconds,
      currentTime: playback.snapshot.positionSeconds,
      zone: settings.zone,
    });

    // Desplegar automáticamente si cambió la pista activa
    if (currentMediaId && currentMediaId !== lastActiveMediaRef.current) {
      lastActiveMediaRef.current = currentMediaId;
      void invoke("flyout_show", {
        zone: settings.zone,
      }).catch(() => {});
    }
  }, [
    isVideoActive,
    activeVideoPath,
    isVideoPlaying,
    currentAudioPath,
    isAudioPlaying,
    currentArtwork,
    playback.snapshot.trackTitle,
    playback.snapshot.trackArtist,
    playback.snapshot.volume,
    playback.snapshot.durationSeconds,
    playback.snapshot.positionSeconds,
    playback.queue.currentItem?.title,
    playback.queue.currentItem?.artist,
  ]);

  // 3. Notificar cambios de volumen al flyout y mostrarlo si está habilitado
  const lastVolRef = useRef<number>(playback.snapshot.volume);
  useEffect(() => {
    const currentVol = playback.snapshot.volume;
    if (currentVol !== lastVolRef.current) {
      lastVolRef.current = currentVol;
      void emit("prisma://flyout-volume-change", currentVol);

      const settings = getFlyoutSettings();
      if (settings.enabled) {
        void invoke("flyout_show", {
          zone: settings.zone,
        }).catch(() => {});
      }
    }
  }, [playback.snapshot.volume]);
}
