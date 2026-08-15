import { useCallback, useEffect, useRef, useState } from "react";
import type { MusicQueue, MusicQueueItem, RepeatMode } from "./model/queue";
import {
  moveItemKeepingCurrent,
  removeItemFromQueue,
  resolveRestoredItemIndex,
  shuffleQueueKeepingCurrentFirst,
} from "./model/queueOperations";

const STORAGE_KEY = "prisma_playback_queue_v1";
const SETTINGS_KEY = "prisma_playback_settings_v1";

const DEFAULT_QUEUE: MusicQueue = {
  id: "default_queue",
  name: "Cola Principal",
  items: [],
  currentIndex: 0,
};

export interface PlaybackQueueState {
  queue: MusicQueue;
  currentItem: MusicQueueItem | null;
  repeatMode: RepeatMode;
  shuffleMode: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
  playQueue: (items: MusicQueueItem[], startIndex?: number, name?: string) => MusicQueueItem | null;
  playNext: (item: MusicQueueItem) => void;
  addToQueue: (itemOrItems: MusicQueueItem | MusicQueueItem[]) => void;
  playQueueAt: (index: number) => MusicQueueItem | null;
  advanceNext: () => { item: MusicQueueItem; replay: boolean } | null;
  advancePrevious: (currentPositionSeconds?: number) => { item: MusicQueueItem; replay: boolean } | null;
  reorder: (fromIndex: number, toIndex: number) => void;
  remove: (index: number) => void;
  clear: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
}

export function usePlaybackQueue(): PlaybackQueueState {
  const [queue, setQueue] = useState<MusicQueue>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as MusicQueue;
        if (parsed && Array.isArray(parsed.items)) {
          const safeIndex = resolveRestoredItemIndex(parsed, null, parsed.currentIndex ?? 0);
          return { ...parsed, currentIndex: safeIndex };
        }
      }
    } catch {}
    return DEFAULT_QUEUE;
  });

  const [repeatMode, setRepeatMode] = useState<RepeatMode>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.repeatMode === "all" || parsed.repeatMode === "one" || parsed.repeatMode === "off") {
          return parsed.repeatMode;
        }
      }
    } catch {}
    return "off";
  });

  const [shuffleMode, setShuffleMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.shuffleMode === "boolean") return parsed.shuffleMode;
      }
    } catch {}
    return false;
  });

  const originalItemsRef = useRef<MusicQueueItem[]>(queue.items);

  // Persist queue
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {}
  }, [queue]);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ repeatMode, shuffleMode }));
    } catch {}
  }, [repeatMode, shuffleMode]);

  const currentItem = queue.items[queue.currentIndex] ?? null;

  const playQueue = useCallback(
    (items: MusicQueueItem[], startIndex = 0, name = "Cola de Reproducción"): MusicQueueItem | null => {
      if (items.length === 0) return null;
      const safeIndex = Math.max(0, Math.min(startIndex, items.length - 1));
      originalItemsRef.current = [...items];

      let initialItems = items;
      let initialIndex = safeIndex;

      if (shuffleMode) {
        initialItems = shuffleQueueKeepingCurrentFirst(items, safeIndex);
        initialIndex = 0;
      }

      const newQueue: MusicQueue = {
        id: `queue_${Date.now()}`,
        name,
        items: initialItems,
        currentIndex: initialIndex,
      };

      setQueue(newQueue);
      return initialItems[initialIndex] ?? null;
    },
    [shuffleMode],
  );

  const playNext = useCallback((item: MusicQueueItem) => {
    setQueue((prev) => {
      if (prev.items.length === 0) {
        originalItemsRef.current = [item];
        return { ...prev, items: [item], currentIndex: 0 };
      }
      const nextItems = [...prev.items];
      nextItems.splice(prev.currentIndex + 1, 0, item);
      originalItemsRef.current = [...originalItemsRef.current, item];
      return { ...prev, items: nextItems };
    });
  }, []);

  const addToQueue = useCallback((itemOrItems: MusicQueueItem | MusicQueueItem[]) => {
    const toAdd = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    if (toAdd.length === 0) return;

    setQueue((prev) => {
      const nextItems = [...prev.items, ...toAdd];
      originalItemsRef.current = [...originalItemsRef.current, ...toAdd];
      return { ...prev, items: nextItems };
    });
  }, []);

  const playQueueAt = useCallback((index: number): MusicQueueItem | null => {
    let target: MusicQueueItem | null = null;
    setQueue((prev) => {
      if (index < 0 || index >= prev.items.length) return prev;
      target = prev.items[index];
      return { ...prev, currentIndex: index };
    });
    return target;
  }, []);

  const advanceNext = useCallback((): { item: MusicQueueItem; replay: boolean } | null => {
    if (queue.items.length === 0) return null;

    if (repeatMode === "one") {
      const item = queue.items[queue.currentIndex];
      return item ? { item, replay: true } : null;
    }

    const nextIndex = queue.currentIndex + 1;
    if (nextIndex < queue.items.length) {
      const item = queue.items[nextIndex];
      setQueue((prev) => ({ ...prev, currentIndex: nextIndex }));
      return { item, replay: false };
    }

    if (repeatMode === "all") {
      const item = queue.items[0];
      setQueue((prev) => ({ ...prev, currentIndex: 0 }));
      return { item, replay: false };
    }

    return null;
  }, [queue, repeatMode]);

  const advancePrevious = useCallback(
    (currentPositionSeconds = 0): { item: MusicQueueItem; replay: boolean } | null => {
      if (queue.items.length === 0) return null;

      // If played more than 3 seconds, replay current song from beginning
      if (currentPositionSeconds > 3) {
        const item = queue.items[queue.currentIndex];
        return item ? { item, replay: true } : null;
      }

      if (queue.currentIndex > 0) {
        const prevIndex = queue.currentIndex - 1;
        const item = queue.items[prevIndex];
        setQueue((prev) => ({ ...prev, currentIndex: prevIndex }));
        return { item, replay: false };
      }

      if (repeatMode === "all" && queue.items.length > 1) {
        const lastIndex = queue.items.length - 1;
        const item = queue.items[lastIndex];
        setQueue((prev) => ({ ...prev, currentIndex: lastIndex }));
        return { item, replay: false };
      }

      // Replay song 0 from start
      const item = queue.items[0];
      return item ? { item, replay: true } : null;
    },
    [queue, repeatMode],
  );

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const res = moveItemKeepingCurrent(prev.items, prev.currentIndex, fromIndex, toIndex);
      return { ...prev, items: res.items, currentIndex: res.currentIndex };
    });
  }, []);

  const remove = useCallback((index: number) => {
    setQueue((prev) => {
      const res = removeItemFromQueue(prev.items, prev.currentIndex, index);
      return { ...prev, items: res.items, currentIndex: res.currentIndex };
    });
  }, []);

  const clear = useCallback(() => {
    originalItemsRef.current = [];
    setQueue((prev) => ({ ...prev, items: [], currentIndex: 0 }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleMode((prevShuffle) => {
      const nextShuffle = !prevShuffle;
      setQueue((prevQueue) => {
        if (prevQueue.items.length <= 1) return prevQueue;
        if (nextShuffle) {
          // Turn shuffle on: keep current first, shuffle remainder
          const shuffled = shuffleQueueKeepingCurrentFirst(prevQueue.items, prevQueue.currentIndex);
          return { ...prevQueue, items: shuffled, currentIndex: 0 };
        } else {
          // Turn shuffle off: restore original order and find current track index
          const original = originalItemsRef.current;
          const currentItem = prevQueue.items[prevQueue.currentIndex];
          const restoredIndex = currentItem
            ? original.findIndex((it) => it.path === currentItem.path)
            : 0;
          return {
            ...prevQueue,
            items: original,
            currentIndex: Math.max(0, restoredIndex),
          };
        }
      });
      return nextShuffle;
    });
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  }, []);

  const canGoNext =
    queue.items.length > 0 &&
    (repeatMode !== "off" || queue.currentIndex + 1 < queue.items.length);

  const canGoPrevious =
    queue.items.length > 0 &&
    (repeatMode !== "off" || queue.currentIndex > 0);

  return {
    queue,
    currentItem,
    repeatMode,
    shuffleMode,
    canGoNext,
    canGoPrevious,
    playQueue,
    playNext,
    addToQueue,
    playQueueAt,
    advanceNext,
    advancePrevious,
    reorder,
    remove,
    clear,
    toggleShuffle,
    toggleRepeat,
  };
}
