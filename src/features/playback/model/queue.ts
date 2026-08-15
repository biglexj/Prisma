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
