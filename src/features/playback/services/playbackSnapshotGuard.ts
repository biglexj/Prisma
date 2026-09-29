import type { PlaybackSnapshot } from "../model/types";

/** Reject reads from a previous load and tolerate libmpv's transient idle/EOF state. */
export function createPlaybackSnapshotGuard(now = Date.now) {
  let generation = 0;
  let pending: { path: string; expires: number } | null = null;
  const matches = (left: string | null, right: string) =>
    left?.replace(/\\/g, "/").toLowerCase() === right.replace(/\\/g, "/").toLowerCase();
  return {
    get generation() { return generation; },
    beginLoad(path: string) {
      pending = { path, expires: now() + 5000 };
      return ++generation;
    },
    cancelLoad(token: number) { if (token === generation) pending = null; },
    accept(snapshot: PlaybackSnapshot, token: number): boolean {
      if (token !== generation) return false;
      if (!pending) return true;
      const ready = matches(snapshot.path, pending.path) && snapshot.eofReached !== true;
      if (!ready && now() < pending.expires) return false;
      pending = null;
      return true;
    },
  };
}

export function hasPlaybackEnded(snapshot: PlaybackSnapshot): boolean {
  if (!snapshot.path) return false;
  // A known false EOF must not advance early; a manual pause near the end is not completion.
  if (typeof snapshot.eofReached === "boolean") return snapshot.eofReached;
  const duration = snapshot.durationSeconds ?? 0;
  return !snapshot.paused && duration > 1 && (snapshot.positionSeconds ?? 0) >= duration;
}
