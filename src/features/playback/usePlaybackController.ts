import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { PlaybackCapabilities, PlaybackSnapshot } from "./model/types";
import { playbackClient } from "./tauri/client";

const EMPTY_SNAPSHOT: PlaybackSnapshot = {
  path: null,
  paused: true,
  positionSeconds: null,
  durationSeconds: null,
  volume: 70,
  speed: 1.0,
  session: null,
};

export function usePlaybackController() {
  const [capabilities, setCapabilities] = useState<PlaybackCapabilities | null>(null);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (action: () => Promise<PlaybackSnapshot>) => {
    setBusy(true);
    setError(null);
    try {
      setSnapshot(await action());
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    playbackClient.capabilities().then(setCapabilities).catch((reason) => {
      setError(String(reason));
    });
  }, []);

  useEffect(() => {
    if (!capabilities?.available || !snapshot.path) return;

    const timer = window.setInterval(() => {
      playbackClient.snapshot().then(setSnapshot).catch(() => undefined);
    }, 500);

    return () => window.clearInterval(timer);
  }, [capabilities?.available, snapshot.path]);

  const loadPath = useCallback(
    async (path: string) => run(() => playbackClient.load(path)),
    [run],
  );

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
    chooseFile,
    loadPath,
    previous: () => run(playbackClient.previous),
    toggle: () => run(playbackClient.togglePause),
    next: () => run(playbackClient.next),
    seek: (seconds: number) => run(() => playbackClient.seek(seconds)),
    setVolume: (volume: number) => run(() => playbackClient.setVolume(volume)),
    setSpeed: (speed: number) => run(() => playbackClient.setSpeed(speed)),
  };
}
