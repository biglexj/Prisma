import { invoke } from "@tauri-apps/api/core";
import type {
  PlaybackCapabilities,
  PlaybackSnapshot,
} from "../model/types";

export const playbackClient = {
  capabilities: () => invoke<PlaybackCapabilities>("playback_capabilities"),
  load: (path: string) => invoke<PlaybackSnapshot>("playback_load", { path }),
  next: () => invoke<PlaybackSnapshot>("playback_next"),
  previous: () => invoke<PlaybackSnapshot>("playback_previous"),
  togglePause: () => invoke<PlaybackSnapshot>("playback_toggle_pause"),
  pause: () => invoke<PlaybackSnapshot>("playback_pause"),
  resume: () => invoke<PlaybackSnapshot>("playback_resume"),
  seek: (seconds: number) =>
    invoke<PlaybackSnapshot>("playback_seek", { seconds }),
  setVolume: (volume: number) =>
    invoke<PlaybackSnapshot>("playback_set_volume", { volume }),
  setSpeed: (speed: number) =>
    invoke<PlaybackSnapshot>("playback_set_speed", { speed }),
  snapshot: () => invoke<PlaybackSnapshot>("playback_snapshot"),
};
