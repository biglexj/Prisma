import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { PlaybackCapabilities, PlaybackSnapshot } from "./model/types";
import type { MusicQueueItem } from "./model/queue";
import { playbackClient } from "./tauri/client";
import { usePlaybackQueue } from "./usePlaybackQueue";
import { createPlaybackSnapshotGuard, hasPlaybackEnded } from "./services/playbackSnapshotGuard";

const STORAGE_KEY_PLAYBACK_VOLUME = "prisma_playback_volume";

function getInitialVolume(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PLAYBACK_VOLUME);
    if (saved !== null) {
      const parsed = Number(saved);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        return parsed;
      }
    }
  } catch {}
  return 100;
}

const EMPTY_SNAPSHOT: PlaybackSnapshot = {
  path: null,
  paused: true,
  positionSeconds: null,
  durationSeconds: null,
  volume: getInitialVolume(),
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
  const snapshotGuardRef = useRef(createPlaybackSnapshotGuard());
  const loadInFlightRef = useRef(false);

  const run = useCallback(async (action: () => Promise<PlaybackSnapshot>) => {
    const generation = snapshotGuardRef.current.generation;
    setBusy(true);
    setError(null);
    try {
      const snap = await action();
      if (generation === snapshotGuardRef.current.generation) setSnapshot(snap);
      return snap;
    } catch (reason) {
      if (generation === snapshotGuardRef.current.generation) setError(String(reason));
      throw reason;
    } finally {
      if (generation === snapshotGuardRef.current.generation) setBusy(false);
    }
  }, []);

  useEffect(() => {
    playbackClient
      .capabilities()
      .then((caps) => {
        setCapabilities(caps);
        if (caps.available) {
          const initialVol = getInitialVolume();
          const generation = snapshotGuardRef.current.generation;
          void playbackClient.setVolume(initialVol).then((snap) => {
            if (!loadInFlightRef.current && generation === snapshotGuardRef.current.generation) setSnapshot(snap);
          }).catch(() => {});
        }
      })
      .catch((reason) => {
        setError(String(reason));
      });
  }, []);

  const loadPath = useCallback(
    async (path: string) => {
      const guard = snapshotGuardRef.current;
      const generation = guard.beginLoad(path);
      loadInFlightRef.current = true;
      lastCompletedPathRef.current = null;
      try {
        return await run(async () => {
          const loaded = await playbackClient.load(path);
          // loadfile acknowledges the command before the new media is necessarily ready.
          // Keep polling this requested path while idle or old EOF snapshots settle.
          return {
            ...loaded, path, paused: false, eofReached: false,
            positionSeconds: 0,
            durationSeconds: null,
            trackTitle: null, trackArtist: null, trackAlbum: null,
          };
        });
      } catch (reason) {
        guard.cancelLoad(generation);
        throw reason;
      } finally {
        if (generation === guard.generation) loadInFlightRef.current = false;
      }
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
        // Repeat-one uses the same guarded load lifecycle, clearing EOF and the completion marker.
        void loadPath(res.item.path);
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
    if (!capabilities?.available) return;

    const interval = snapshot.paused ? 1200 : 400;
    let disposed = false;
    let polling = false;
    const timer = window.setInterval(() => {
      if (polling || loadInFlightRef.current) return;
      polling = true;
      const generation = snapshotGuardRef.current.generation;
      playbackClient
        .snapshot()
        .then((snap) => {
          if (disposed || loadInFlightRef.current || !snapshotGuardRef.current.accept(snap, generation)) return;
          setSnapshot(snap);

          if (
            hasPlaybackEnded(snap) &&
            snap.path &&
            lastCompletedPathRef.current !== snap.path
          ) {
            lastCompletedPathRef.current = snap.path;

            // Modo: Detener el reproductor al finalizar la canción
            if (queue.stopOnSongEnd) {
              void run(() => playbackClient.pause());
              return;
            }

            // Modo: Cargar siguiente canción y pausar
            if (queue.pauseOnSongEnd) {
              if (queue.activeQueue.items.length > 0) {
                const res = queue.advanceNext();
                if (res) {
                  if (res.replay) {
                    void run(async () => {
                      await playbackClient.seek(0);
                      return playbackClient.pause();
                    });
                  } else {
                    void run(async () => {
                      await loadPath(res.item.path);
                      return playbackClient.pause();
                    });
                  }
                  return;
                }
              }
              void run(() => playbackClient.pause());
              return;
            }

            // Modo predeterminado: Reproducir siguiente canción
            next();
          }
        })
        .catch(() => undefined)
        .finally(() => { polling = false; });
    }, interval);

    return () => { disposed = true; window.clearInterval(timer); };
  }, [
    capabilities?.available,
    snapshot.path,
    snapshot.paused,
    next,
    queue,
    run,
    loadPath,
  ]);

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
    toggle: async () => {
      if (!snapshot.path && queue.activeQueue.items.length > 0) {
        const currentItem = queue.activeQueue.items[queue.queue.currentIndex] || queue.activeQueue.items[0];
        if (currentItem) {
          return loadPath(currentItem.path);
        }
      }
      setSnapshot((prev) => ({ ...prev, paused: !prev.paused }));
      try {
        const snap = await playbackClient.togglePause();
        setSnapshot(snap);
        return snap;
      } catch (reason) {
        setError(String(reason));
        throw reason;
      }
    },
    pause: async () => {
      setSnapshot((prev) => ({ ...prev, paused: true }));
      try {
        const snap = await playbackClient.pause();
        setSnapshot(snap);
        return snap;
      } catch (reason) {
        setError(String(reason));
        throw reason;
      }
    },
    resume: async () => {
      setSnapshot((prev) => ({ ...prev, paused: false }));
      try {
        const snap = await playbackClient.resume();
        setSnapshot(snap);
        return snap;
      } catch (reason) {
        setError(String(reason));
        throw reason;
      }
    },
    next,
    seek: (seconds: number) => run(() => playbackClient.seek(seconds)),
    setVolume: async (volume: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(volume)));
      try {
        localStorage.setItem(STORAGE_KEY_PLAYBACK_VOLUME, String(clamped));
      } catch {}
      setSnapshot((prev) => ({ ...prev, volume: clamped }));
      try {
        const snap = await playbackClient.setVolume(clamped);
        setSnapshot(snap);
        return snap;
      } catch (reason) {
        setError(String(reason));
        throw reason;
      }
    },
    setSpeed: (speed: number) => run(() => playbackClient.setSpeed(speed)),
  };
}
