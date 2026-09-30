import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { parseTrackInfo } from "../../music_library/model/trackInfo";
import { mediaTitle } from "../ui/formatters";
import { FLYOUT_SETTINGS_EVENT, getFlyoutSettings, type FlyoutSettings } from "./flyoutSettings";
import type { usePlaybackController } from "../usePlaybackController";
import { isFlyoutMediaShortcut } from "./flyoutTriggers";

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
  const lastStateRef = useRef<Record<string, unknown> | null>(null);

  // Manual transport commands present the panel; metadata updates only sync it.
  useEffect(() => {
    let disposed = false;
    const show = () => {
      if (disposed) return;
      const settings = getFlyoutSettings();
      if (settings.enabled) void invoke("flyout_show", { zone: settings.zone }).catch(() => {});
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isFlyoutMediaShortcut(event)) return;
      // Wait for the music/video handler to confirm it accepted the shortcut.
      window.setTimeout(() => { if (event.defaultPrevented) show(); }, 0);
    };
    window.addEventListener("keydown", onKeyDown);
    const subscription = listen<string>("prisma://smtc-action", ({ payload }) => {
      if (["play", "pause", "next", "previous"].includes(payload)) show();
    });
    return () => {
      disposed = true;
      window.removeEventListener("keydown", onKeyDown);
      void subscription.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const subscription = listen("prisma://flyout-request-state", () => {
      if (lastStateRef.current) void emit("prisma://flyout-state-sync", lastStateRef.current);
    });
    return () => { void subscription.then((unlisten) => unlisten()); };
  }, []);

  useEffect(() => {
    const configure = (settings = getFlyoutSettings()) => {
      void invoke("flyout_configure", { enabled: settings.enabled, zone: settings.zone }).catch(console.error);
    };
    const changed = () => configure();
    configure();
    window.addEventListener(FLYOUT_SETTINGS_EVENT, changed);
    const unlisten = listen<FlyoutSettings>(FLYOUT_SETTINGS_EVENT, (event) => configure(event.payload));
    return () => {
      window.removeEventListener(FLYOUT_SETTINGS_EVENT, changed);
      void unlisten.then((fn) => fn());
    };
  }, []);

  // 1. Escuchar acciones despachadas desde el Flyout (Play/Pause, Next, Prev, Volume)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isMounted = true;

    void listen<{ action: string; value?: unknown }>("prisma://flyout-action", (event) => {
      if (!isMounted) return;
      const { action } = event.payload;

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

      }
    }).then((fn) => {
      if (isMounted) unlisten = fn;
      else fn();
    });

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [isVideoActive, onToggleVideoPlay, onNextVideo, onPrevVideo, playback]);

  // 2. Transmitir estado y metadatos hacia el Flyout
  useEffect(() => {
    const settings = getFlyoutSettings();

    let title = "Prisma";
    let artist = "Listo para reproducir";
    let artworkUrl: string | null = null;
    let isPlaying = false;
    let mediaType: "audio" | "video" = "audio";

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

    const state = {
      isPlaying,
      title,
      artist,
      artworkUrl,
      mediaType,
      zone: settings.zone,
    };
    lastStateRef.current = state;
    void emit("prisma://flyout-state-sync", state);

  }, [
    isVideoActive,
    activeVideoPath,
    isVideoPlaying,
    currentAudioPath,
    isAudioPlaying,
    currentArtwork,
    playback.snapshot.trackTitle,
    playback.snapshot.trackArtist,
    playback.queue.currentItem?.title,
    playback.queue.currentItem?.artist,
  ]);

}
