import { describe, expect, test } from "bun:test";
import { createPlaybackSnapshotGuard, hasPlaybackEnded } from "../src/features/playback/services/playbackSnapshotGuard";
import type { PlaybackSnapshot } from "../src/features/playback/model/types";

const state = (path: string | null, patch: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot => ({
  path, paused: false, positionSeconds: 0, durationSeconds: 180,
  volume: 58, speed: 1, session: null, eofReached: false, ...patch,
});

describe("playback load transitions", () => {
  test("last queue to first rejects old EOF and idle responses until the first track is ready", () => {
    const guard = createPlaybackSnapshotGuard();
    const previousRead = guard.generation;
    const token = guard.beginLoad("D:\\Music\\first.flac");
    expect(guard.accept(state("last.flac", { eofReached: true, paused: true }), previousRead)).toBe(false);
    expect(guard.accept(state(null, { paused: true }), token)).toBe(false);
    expect(guard.accept(state("D:\\Music\\first.flac", { eofReached: true }), token)).toBe(false);
    expect(guard.accept(state("D:/Music/first.flac"), token)).toBe(true);
    expect(guard.accept(state("D:/Music/first.flac", { positionSeconds: 1 }), token)).toBe(true);
  });

  test("a second selection rejects the first load's late result", () => {
    const guard = createPlaybackSnapshotGuard();
    const old = guard.beginLoad("a.flac");
    const latest = guard.beginLoad("b.flac");
    expect(guard.accept(state("a.flac"), old)).toBe(false);
    expect(guard.accept(state("b.flac"), latest)).toBe(true);
  });

  test("manual pause on the new track is respected", () => {
    const guard = createPlaybackSnapshotGuard();
    const token = guard.beginLoad("first.flac");
    expect(guard.accept(state("first.flac", { paused: true }), token)).toBe(true);
  });

  test("failed loads stop waiting after five seconds instead of claiming playback forever", () => {
    let now = 0;
    const guard = createPlaybackSnapshotGuard(() => now);
    const token = guard.beginLoad("missing.flac");
    now = 4999;
    expect(guard.accept(state(null, { paused: true }), token)).toBe(false);
    now = 5000;
    expect(guard.accept(state(null, { paused: true }), token)).toBe(true);
  });

  test("canceling an older failed load does not cancel the latest selection", () => {
    const guard = createPlaybackSnapshotGuard();
    const old = guard.beginLoad("a.flac");
    const current = guard.beginLoad("b.flac");
    guard.cancelLoad(old);
    expect(guard.accept(state(null), current)).toBe(false);
  });
});

describe("song completion", () => {
  test("does not advance 350 ms early or on a manual pause near the end", () => {
    expect(hasPlaybackEnded(state("a", { positionSeconds: 179.8 }))).toBe(false);
    expect(hasPlaybackEnded(state("a", { paused: true, positionSeconds: 180, eofReached: null }))).toBe(false);
  });

  test("recognizes libmpv's paused EOF and only uses the end fallback when EOF is unavailable", () => {
    expect(hasPlaybackEnded(state("a", { paused: true, eofReached: true }))).toBe(true);
    expect(hasPlaybackEnded(state("a", { positionSeconds: 180, eofReached: false }))).toBe(false);
    expect(hasPlaybackEnded(state("a", { positionSeconds: 180, eofReached: null }))).toBe(true);
    expect(hasPlaybackEnded(state(null, { eofReached: true }))).toBe(false);
  });
});
