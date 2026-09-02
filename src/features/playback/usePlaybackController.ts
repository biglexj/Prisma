import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { PlaybackCapabilities, PlaybackSnapshot } from "./model/types";
import type { MusicQueueItem } from "./model/queue";
import { playbackClient } from "./tauri/client";
import { usePlaybackQueue } from "./usePlaybackQueue";

const EMPTY_SNAPSHOT: PlaybackSnapshot = {
  path: null,
  paused: true,
  positionSeconds: null,
  durationSeconds: null,
  volume: 70,
  speed: 1.0,
  session: null,
  eofReached: false,
};

export function usePlaybackController() {
  const [capabilities, setCapabilities] = useState<PlaybackCapabilities | null>(null);
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(EMPTY_SNAPSHOT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queue = usePlaybackQueue();
  const lastCompletedPathRef = useRef<string | null>(null);

  const run = useCallback(async (action: () => Promise<PlaybackSnapshot>) => {
    setBusy(true);
    setError(null);
    try {
      const snap = await action();
      setSnapshot(snap);
      return snap;
    } catch (reason) {
      setError(String(reason));
      throw reason;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    playbackClient
      .capabilities()
      .then(setCapabilities)
      .catch((reason) => {
        setError(String(reason));
      });
  }, []);

  const loadPath = useCallback(
    async (path: string) => {
      lastCompletedPathRef.current = null;
      return run(() => playbackClient.load(path));
    },
    [run],
  );

  const playQueue = useCallback(
    (items: MusicQueueItem[], startIndex = 0, name?: string, queueId?: string) => {
      const target = queue.playQueue(items, startIndex, name, queueId);
      if (target) {
        void loadPath(target.path);
      }
    },
    [queue, loadPath],
  );

  const playFolder = useCallback(
    (folderName: string, folderItems: MusicQueueItem[], startIndex = 0) => {
      const target = queue.playFolder(folderName, folderItems, startIndex);
      if (target) {
        void loadPath(target.path);
      }
    },
    [queue, loadPath],
  );

  const playQueueAt = useCallback(
    (index: number) => {
      const target = queue.playQueueAt(index);
      if (target) {
        void loadPath(target.path);
      }
    },
    [queue, loadPath],
  );

  const switchQueueAndPlay = useCallback(
    (queueId: string, startIndex?: number) => {
      const target = queue.switchQueue(queueId, startIndex);
      if (target) {
        void loadPath(target.path);
      }
    },
    [queue, loadPath],
  );

  const next = useCallback(() => {
    if (queue.activeQueue.items.length > 0) {
      const res = queue.advanceNext();
      if (res) {
        if (res.replay) {
          void run(() => playbackClient.seek(0));
        } else {
          void loadPath(res.item.path);
        }
        return;
      }
    }
    void run(playbackClient.next);
  }, [queue, run, loadPath]);

  const previous = useCallback(() => {
    if (queue.activeQueue.items.length > 0) {
      const res = queue.advancePrevious(snapshot.positionSeconds ?? 0);
      if (res) {
        if (res.replay) {
          void run(() => playbackClient.seek(0));
        } else {
          void loadPath(res.item.path);
        }
        return;
      }
    }
    void run(playbackClient.previous);
  }, [queue, snapshot.positionSeconds, run, loadPath]);

  // Polling con detección precisa de fin de pista y auto-avance
  useEffect(() => {
    if (!capabilities?.available || !snapshot.path) return;

    const interval = snapshot.paused ? 1200 : 400;
    const timer = window.setInterval(() => {
      playbackClient
        .snapshot()
        .then((snap) => {
          setSnapshot(snap);

          const duration = snap.durationSeconds ?? 0;
          const pos = snap.positionSeconds ?? 0;
          const isEof = snap.eofReached === true;
          const isNearEnd = duration > 1 && pos >= duration - 0.35;

          if (
            (isEof || isNearEnd) &&
            snap.path &&
            lastCompletedPathRef.current !== snap.path
          ) {
            lastCompletedPathRef.current = snap.path;
            next();
          }
        })
        .catch(() => undefined);
    }, interval);

    return () => window.clearInterval(timer);
  }, [capabilities?.available, snapshot.path, snapshot.paused, next]);

  const chooseFile = useCallback(async () => {
    const selection = await open({
      multiple: false,
      directory: false,
      title: "Seleccionar archivo para Prisma",
    });

    if (typeof selection === "string") {
      await loadPath(selection);
    }
  }, [loadPath]);

  return {
    capabilities,
    snapshot,
    error,
    busy,
    enabled: capabilities?.available === true,
    queue,
    chooseFile,
    loadPath,
    playQueue,
    playFolder,
    playQueueAt,
    switchQueueAndPlay,
    previous,
    toggle: () => {
      if (!snapshot.path && queue.activeQueue.items.length > 0) {
        const currentItem = queue.activeQueue.items[queue.queue.currentIndex] || queue.activeQueue.items[0];
        if (currentItem) {
          return loadPath(currentItem.path);
        }
      }
      return run(playbackClient.togglePause);
    },
    pause: () => run(playbackClient.pause),
    resume: () => run(playbackClient.resume),
    next,
    seek: (seconds: number) => run(() => playbackClient.seek(seconds)),
    setVolume: (volume: number) => run(() => playbackClient.setVolume(volume)),
    setSpeed: (speed: number) => run(() => playbackClient.setSpeed(speed)),
  };
}
