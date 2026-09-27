import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { PlaybackSnapshot } from "../model/types";
import type { MusicQueueItem } from "../model/queue";
import { parseTrackInfo } from "../../music_library/model/trackInfo";
import { mediaTitle } from "../ui/formatters";

export const SILENT_AUDIO_URI = "";

interface UseMediaSessionSyncParams {
  snapshot: PlaybackSnapshot;
  currentItem?: MusicQueueItem | null;
  isVideoActive: boolean;
  silentAudioRef?: RefObject<HTMLAudioElement | null>;
  onPlay: () => Promise<unknown> | void;
  onPause: () => Promise<unknown> | void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => Promise<unknown> | void;
}

/**
 * Hook para sincronizar la reproducción de música con el servicio nativo
 * Windows System Media Transport Controls (SMTC) de Prisma en Rust.
 *
 * Al ejecutarse directamente sobre el HWND de la ventana Win32 de Prisma,
 * Windows atribuye la sesión multimedia a "Prisma" (reemplazando a "Microsoft Edge WebView2"),
 * muestra el icono oficial de la aplicación y carga la carátula real del álbum en el flyout de volumen.
 */
export function useMediaSessionSync({
  snapshot,
  currentItem,
  isVideoActive,
  onPlay,
  onPause,
  onPrevious,
  onNext,
  onSeek,
}: UseMediaSessionSyncParams) {
  const effectivePath = snapshot.path;
  const isAudioActive = Boolean(effectivePath) && !isVideoActive;
  const isAudioPlaying = isAudioActive && !snapshot.paused && !snapshot.eofReached;

  // Mantener referencias estables a las funciones para el listener de eventos de SMTC
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

  // 1. Desactivar y limpiar cualquier sesión multimedia remanente de Chromium WebView2
  useEffect(() => {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.metadata = null;
      } catch {}
    }
  }, []);

  // 2. Suscripción a eventos de hardware/flyout multimedia de Windows emitidos por Rust ("prisma://smtc-action")
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isMounted = true;

    void listen<string>("prisma://smtc-action", (event) => {
      if (!isMounted) return;
      const action = event.payload;
      switch (action) {
        case "play":
          void onPlayRef.current();
          break;
        case "pause":
          void onPauseRef.current();
          break;
        case "next":
          onNextRef.current();
          break;
        case "previous":
          onPreviousRef.current();
          break;
      }
    }).then((fn) => {
      if (isMounted) {
        unlisten = fn;
      } else {
        fn();
      }
    });

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  // 3. Sincronización de metadatos y carátula del álbum con el SMTC nativo de Rust
  useEffect(() => {
    if (isVideoActive || !effectivePath) {
      void invoke("smtc_clear").catch(() => {});
      return;
    }

    const rawTitle = mediaTitle(effectivePath);
    const parsed = parseTrackInfo(rawTitle);
    const title = snapshot.trackTitle?.trim() || currentItem?.title || parsed.title || rawTitle;
    const artist = snapshot.trackArtist?.trim() || currentItem?.artist || parsed.artist || "Prisma";
    const album = snapshot.trackAlbum?.trim() || "Música";

    void invoke("smtc_update_metadata", {
      title,
      artist,
      album,
      sourcePath: effectivePath,
    }).catch(() => {});
  }, [
    effectivePath,
    isVideoActive,
    snapshot.trackTitle,
    snapshot.trackArtist,
    snapshot.trackAlbum,
    currentItem?.title,
    currentItem?.artist,
  ]);

  // 4. Sincronización del estado de reproducción (Playing / Paused) con SMTC nativo
  useEffect(() => {
    if (isVideoActive || !effectivePath) {
      return;
    }

    void invoke("smtc_update_playback", {
      isPlaying: isAudioPlaying,
    }).catch(() => {});
  }, [isAudioPlaying, isVideoActive, effectivePath]);

  // 5. Sincronización de la línea de tiempo (Timeline de Windows SMTC)
  const lastReportedPos = useRef<number>(-1);
  useEffect(() => {
    if (isVideoActive || !effectivePath || !snapshot.durationSeconds || snapshot.durationSeconds <= 0) {
      return;
    }

    const pos = Math.floor(snapshot.positionSeconds ?? 0);
    // Limitar la tasa de actualización a 1 llamada por segundo para evitar sobrecarga IPC
    if (pos !== lastReportedPos.current) {
      lastReportedPos.current = pos;
      void invoke("smtc_update_timeline", {
        positionSecs: snapshot.positionSeconds ?? 0,
        durationSecs: snapshot.durationSeconds,
      }).catch(() => {});
    }
  }, [
    snapshot.positionSeconds,
    snapshot.durationSeconds,
    isVideoActive,
    effectivePath,
  ]);

  // 6. Limpieza al desmontar
  useEffect(() => {
    return () => {
      void invoke("smtc_clear").catch(() => {});
    };
  }, []);
}
