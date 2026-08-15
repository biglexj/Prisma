export interface MusicQueueItem {
  id: string;
  path: string;
  title: string;
  artist?: string | null;
  folder?: string | null;
  durationSeconds?: number | null;
  sizeBytes?: number | null;
}

export interface MusicQueue {
  id: string;
  name: string;
  items: MusicQueueItem[];
  currentIndex: number;
}

export type RepeatMode = "off" | "all" | "one";

export interface QueueMoveResult {
  items: MusicQueueItem[];
  currentIndex: number;
}

export interface QueueRemovalResult {
  items: MusicQueueItem[];
  currentIndex: number;
}

export interface MusicPlaybackSettings {
  repeatMode: RepeatMode;
  shuffleMode: boolean;
  jumpToNextQueue: boolean;
  loopQueues: boolean;
  pauseOnSongEnd: boolean;
  stopOnSongEnd: boolean;
}

export const DEFAULT_QUEUE_ID = "default_queue";
export const DEFAULT_QUEUE_NAME = "Árbol de Música";

/** Identidad persistente unificada para coincidencia fiable de pistas */
export function stableMediaId(item: { path: string }): string {
  return item.path.trim().replace(/\\/g, "/").toLowerCase();
}
