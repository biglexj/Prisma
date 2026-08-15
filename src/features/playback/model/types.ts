export interface PlaybackCapabilities {
  backend: string;
  available: boolean;
  audio: boolean;
  videoOutput: boolean;
  reason: string | null;
}

export interface PlaybackSnapshot {
  path: string | null;
  paused: boolean;
  positionSeconds: number | null;
  durationSeconds: number | null;
  volume: number;
  speed: number;
  session: FolderSessionSnapshot | null;
}

export interface FolderSessionSnapshot {
  family: "audio" | "image" | "video";
  currentIndex: number;
  totalItems: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
}
