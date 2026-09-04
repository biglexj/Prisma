import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_QUEUE_ID,
  DEFAULT_QUEUE_NAME,
  type MusicPlaybackSettings,
  type MusicQueue,
  type MusicQueueItem,
  type RepeatMode,
} from "./model/queue";
import {
  moveItemKeepingCurrent,
  moveQueueInList,
  removeItemFromQueue,
  resolveRestoredItemIndex,
  rewindQueue,
  shuffleQueueKeepingCurrentFirst,
} from "./model/queueOperations";

const QUEUES_STORAGE_KEY = "prisma_playback_queues_v2";
const ACTIVE_QUEUE_KEY = "prisma_playback_active_queue_id_v2";
const SETTINGS_STORAGE_KEY = "prisma_playback_settings_v2";

const INITIAL_DEFAULT_QUEUE: MusicQueue = {
  id: DEFAULT_QUEUE_ID,
  name: DEFAULT_QUEUE_NAME,
  items: [],
  currentIndex: 0,
};

const DEFAULT_SETTINGS: MusicPlaybackSettings = {
  repeatMode: "off",
  shuffleMode: false,
  jumpToNextQueue: false,
  loopQueues: false,
  pauseOnSongEnd: false,
  stopOnSongEnd: false,
};

export interface PlaybackQueueState {
  queues: MusicQueue[];
  activeQueueId: string;
  activeQueue: MusicQueue;
  queue: MusicQueue; // Alias de compatibilidad hacia activeQueue
  currentItem: MusicQueueItem | null;
  currentSongIndex: number;
  repeatMode: RepeatMode;
  shuffleMode: boolean;
  jumpToNextQueue: boolean;
  loopQueues: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;

  playQueue: (
    items: MusicQueueItem[],
    startIndex?: number,
    name?: string,
    queueId?: string,
  ) => MusicQueueItem | null;
  playFolder: (
    folderName: string,
    folderItems: MusicQueueItem[],
    startIndex?: number,
  ) => MusicQueueItem | null;
  playQueueAt: (index: number) => MusicQueueItem | null;
  playNext: (item: MusicQueueItem) => void;
  addToQueue: (itemOrItems: MusicQueueItem | MusicQueueItem[], targetQueueId?: string) => void;
  switchQueue: (queueId: string, startIndex?: number) => MusicQueueItem | null;
  addQueue: (name: string, items?: MusicQueueItem[]) => string;
  duplicateQueue: (queueId: string, newName?: string) => string;
  saveActiveQueueAs: (newName: string) => string;
  removeQueue: (queueId: string) => void;
  renameQueue: (queueId: string, newName: string) => void;
  shuffleActiveQueue: () => void;
  rewindActiveQueue: () => void;
  advanceNext: () => { item: MusicQueueItem; replay: boolean; newQueueId?: string } | null;
  advancePrevious: (
    currentPositionSeconds?: number,
  ) => { item: MusicQueueItem; replay: boolean; newQueueId?: string } | null;
  reorder: (fromIndex: number, toIndex: number) => void;
  moveQueue: (fromIndex: number, toIndex: number) => void;
  remove: (index: number) => void;
  clear: () => void;
  clearQueue: (queueId: string) => void;
  clearAllQueues: () => void;
  syncItemMetadata: (items: MusicQueueItem[]) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleJumpToNextQueue: () => void;
  toggleLoopQueues: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setShuffleMode: (enabled: boolean) => void;
  setJumpToNextQueue: (enabled: boolean) => void;
  setLoopQueues: (enabled: boolean) => void;
  pauseOnSongEnd: boolean;
  stopOnSongEnd: boolean;
  setPauseOnSongEnd: (enabled: boolean) => void;
  setStopOnSongEnd: (enabled: boolean) => void;
  setSongEndMode: (mode: "stop" | "pause" | "next") => void;
}

export function usePlaybackQueue(): PlaybackQueueState {
  const [queues, setQueues] = useState<MusicQueue[]>(() => {
    try {
      const saved = localStorage.getItem(QUEUES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as MusicQueue[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((q) => ({
            ...q,
            name:
              q.id === DEFAULT_QUEUE_ID && (q.name === "Cola Principal" || !q.name)
                ? DEFAULT_QUEUE_NAME
                : q.name,
            currentIndex: resolveRestoredItemIndex(q, null, q.currentIndex ?? 0),
          }));
        }
      }
    } catch {}
    return [INITIAL_DEFAULT_QUEUE];
  });

  const [activeQueueId, setActiveQueueId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_QUEUE_KEY);
      if (savedId && savedId.trim().length > 0) {
        return savedId;
      }
    } catch {}
    return DEFAULT_QUEUE_ID;
  });

  const [settings, setSettings] = useState<MusicPlaybackSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<MusicPlaybackSettings>;
        return {
          repeatMode:
            parsed.repeatMode === "all" || parsed.repeatMode === "one" || parsed.repeatMode === "off"
              ? parsed.repeatMode
              : "off",
          shuffleMode: Boolean(parsed.shuffleMode),
          jumpToNextQueue: Boolean(parsed.jumpToNextQueue),
          loopQueues: Boolean(parsed.loopQueues),
          pauseOnSongEnd: Boolean(parsed.pauseOnSongEnd),
          stopOnSongEnd: Boolean(parsed.stopOnSongEnd),
        };
      }
    } catch {}
    return DEFAULT_SETTINGS;
  });

  // Persistir colas
  useEffect(() => {
    try {
      localStorage.setItem(QUEUES_STORAGE_KEY, JSON.stringify(queues));
    } catch {}
  }, [queues]);

  // Persistir cola activa
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_QUEUE_KEY, activeQueueId);
    } catch {}
  }, [activeQueueId]);

  // Persistir ajustes
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const activeQueue = useMemo(() => {
    return queues.find((q) => q.id === activeQueueId) ?? queues[0] ?? INITIAL_DEFAULT_QUEUE;
  }, [queues, activeQueueId]);

  const currentSongIndex = activeQueue.currentIndex ?? 0;
  const currentItem = activeQueue.items[currentSongIndex] ?? null;

  const playQueue = useCallback(
    (
      items: MusicQueueItem[],
      startIndex = 0,
      name = DEFAULT_QUEUE_NAME,
      queueId?: string,
    ): MusicQueueItem | null => {
      if (items.length === 0) return null;
      // Cuando se reproduce desde la biblioteca general o un álbum/carpeta sin especificar una lista personalizada,
      // SIEMPRE se reproduce en la cola principal (DEFAULT_QUEUE_ID).
      // Esto GARANTIZA que ninguna cola personalizada o lista creada por el usuario sea borrada o sobreescrita.
      const targetQueueId = queueId ?? DEFAULT_QUEUE_ID;
      const safeIndex = Math.max(0, Math.min(startIndex, items.length - 1));

      let finalItems = [...items];
      let finalIndex = safeIndex;

      if (settings.shuffleMode) {
        finalItems = shuffleQueueKeepingCurrentFirst(items, safeIndex);
        finalIndex = 0;
      }

      const target = finalItems[finalIndex] ?? null;

      setQueues((prevQueues) => {
        const exists = prevQueues.some((q) => q.id === targetQueueId);
        if (exists) {
          return prevQueues.map((q) =>
            q.id === targetQueueId
              ? {
                  ...q,
                  name: targetQueueId === DEFAULT_QUEUE_ID ? (name || DEFAULT_QUEUE_NAME) : q.name,
                  items: finalItems,
                  currentIndex: finalIndex,
                }
              : q,
          );
        } else {
          const newQueue: MusicQueue = {
            id: targetQueueId,
            name: name || DEFAULT_QUEUE_NAME,
            items: finalItems,
            currentIndex: finalIndex,
          };
          return [...prevQueues, newQueue];
        }
      });

      setActiveQueueId(targetQueueId);
      return target;
    },
    [settings.shuffleMode],
  );

  const playFolder = useCallback(
    (
      folderName: string,
      folderItems: MusicQueueItem[],
      startIndex = 0,
    ): MusicQueueItem | null => {
      // La cola lleva directamente el nombre del álbum/carpeta, sin prefijos extra.
      // Si ya existe una cola con el mismo nombre (re-click del mismo álbum), se reutiliza para no duplicar.
      const existing = queues.find((q) => q.name === folderName);
      const targetQueueId = existing?.id ?? `queue_${Date.now()}`;
      return playQueue(folderItems, startIndex, folderName, targetQueueId);
    },
    [playQueue, queues],
  );

  const playQueueAt = useCallback(
    (index: number): MusicQueueItem | null => {
      const currentQ = queues.find((q) => q.id === activeQueueId) ?? queues[0];
      if (!currentQ || currentQ.items.length === 0) return null;
      const safeIdx = Math.max(0, Math.min(index, currentQ.items.length - 1));
      const target = currentQ.items[safeIdx] ?? null;

      setQueues((prevQueues) => {
        return prevQueues.map((q) => {
          if (q.id === activeQueueId) {
            return { ...q, currentIndex: safeIdx };
          }
          return q;
        });
      });
      return target;
    },
    [queues, activeQueueId],
  );

  const playNext = useCallback(
    (item: MusicQueueItem) => {
      setQueues((prevQueues) => {
        return prevQueues.map((q) => {
          if (q.id === activeQueueId) {
            if (q.items.length === 0) {
              return { ...q, items: [item], currentIndex: 0 };
            }
            const nextItems = [...q.items];
            nextItems.splice(q.currentIndex + 1, 0, item);
            return { ...q, items: nextItems };
          }
          return q;
        });
      });
    },
    [activeQueueId],
  );

  const addToQueue = useCallback(
    (itemOrItems: MusicQueueItem | MusicQueueItem[], targetQueueId?: string) => {
      const toAdd = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
      if (toAdd.length === 0) return;
      const targetId = targetQueueId ?? activeQueueId;

      setQueues((prevQueues) => {
        const exists = prevQueues.some((q) => q.id === targetId);
        if (exists) {
          return prevQueues.map((q) =>
            q.id === targetId ? { ...q, items: [...q.items, ...toAdd] } : q,
          );
        } else {
          return [
            ...prevQueues,
            {
              id: targetId,
              name: "Nueva Cola",
              items: toAdd,
              currentIndex: 0,
            },
          ];
        }
      });
    },
    [activeQueueId],
  );

  const switchQueue = useCallback(
    (queueId: string, startIndex = 0): MusicQueueItem | null => {
      const targetQ = queues.find((q) => q.id === queueId);
      if (!targetQ) return null;

      setActiveQueueId(queueId);

      if (targetQ.items.length === 0) {
        return null;
      }

      const safeIndex = Math.max(0, Math.min(startIndex, targetQ.items.length - 1));
      const target = targetQ.items[safeIndex] ?? null;

      setQueues((prev) =>
        prev.map((q) => (q.id === queueId ? { ...q, currentIndex: safeIndex } : q)),
      );

      return target;
    },
    [queues],
  );

  const addQueue = useCallback((name: string, items: MusicQueueItem[] = []): string => {
    const newId = `queue_${Date.now()}`;
    const newQueue: MusicQueue = {
      id: newId,
      name,
      items,
      currentIndex: 0,
    };
    setQueues((prev) => [...prev, newQueue]);
    return newId;
  }, []);

  const duplicateQueue = useCallback(
    (queueId: string, newName?: string): string => {
      const sourceQ = queues.find((q) => q.id === queueId);
      const newId = `queue_${Date.now()}`;
      const name = newName ?? `${sourceQ?.name ?? "Cola"} (Copia)`;
      const newQueue: MusicQueue = {
        id: newId,
        name,
        items: sourceQ ? [...sourceQ.items] : [],
        currentIndex: 0,
      };
      setQueues((prev) => [...prev, newQueue]);
      return newId;
    },
    [queues],
  );

  const saveActiveQueueAs = useCallback(
    (newName: string): string => {
      return duplicateQueue(activeQueueId, newName);
    },
    [duplicateQueue, activeQueueId],
  );

  const removeQueue = useCallback(
    (queueId: string) => {
      setQueues((prev) => {
        const remaining = prev.filter((q) => q.id !== queueId);
        // Si no quedan colas, mantener la cola por defecto vacía para que la interfaz nunca quede sin colas
        return remaining.length > 0 ? remaining : [INITIAL_DEFAULT_QUEUE];
      });
      if (activeQueueId === queueId) {
        const remaining = queues.filter((q) => q.id !== queueId);
        const fallbackId = remaining.length > 0 ? remaining[0].id : DEFAULT_QUEUE_ID;
        setActiveQueueId(fallbackId);
      }
    },
    [activeQueueId, queues],
  );

  const renameQueue = useCallback((queueId: string, newName: string) => {
    setQueues((prev) =>
      prev.map((q) => (q.id === queueId ? { ...q, name: newName } : q)),
    );
  }, []);

  const shuffleActiveQueue = useCallback(() => {
    setQueues((prevQueues) => {
      return prevQueues.map((q) => {
        if (q.id === activeQueueId) {
          if (q.items.length <= 1) return q;
          const shuffled = shuffleQueueKeepingCurrentFirst(q.items, q.currentIndex);
          return { ...q, items: shuffled, currentIndex: 0 };
        }
        return q;
      });
    });
  }, [activeQueueId]);

  const rewindActiveQueue = useCallback(() => {
    setQueues((prevQueues) => {
      return prevQueues.map((q) => {
        if (q.id === activeQueueId) {
          if (q.items.length <= 1) return q;
          const rewound = rewindQueue(q.items, q.currentIndex);
          return { ...q, items: rewound, currentIndex: 0 };
        }
        return q;
      });
    });
  }, [activeQueueId]);

  const moveQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueues((prev) => moveQueueInList(prev, fromIndex, toIndex));
  }, []);

  const advanceNext = useCallback((): {
    item: MusicQueueItem;
    replay: boolean;
    newQueueId?: string;
  } | null => {
    const currentQ = activeQueue;
    if (currentQ.items.length === 0) return null;

    if (settings.repeatMode === "one") {
      const item = currentQ.items[currentQ.currentIndex];
      return item ? { item, replay: true } : null;
    }

    const nextIndex = currentQ.currentIndex + 1;
    if (nextIndex < currentQ.items.length) {
      const item = currentQ.items[nextIndex];
      setQueues((prev) =>
        prev.map((q) => (q.id === activeQueueId ? { ...q, currentIndex: nextIndex } : q)),
      );
      return { item, replay: false };
    }

    if (settings.repeatMode === "all") {
      const item = currentQ.items[0];
      setQueues((prev) =>
        prev.map((q) => (q.id === activeQueueId ? { ...q, currentIndex: 0 } : q)),
      );
      return { item, replay: false };
    }

    // Saltar a siguiente cola (A -> B -> C) o bucle de colas (C -> A)
    if (settings.jumpToNextQueue) {
      const playableQueues = queues.filter((q) => q.items.length > 0);
      const currentQIdx = playableQueues.findIndex((q) => q.id === activeQueueId);
      if (currentQIdx >= 0 && currentQIdx < playableQueues.length - 1) {
        const nextQ = playableQueues[currentQIdx + 1];
        setQueues((prev) =>
          prev.map((q) => (q.id === nextQ.id ? { ...q, currentIndex: 0 } : q)),
        );
        setActiveQueueId(nextQ.id);
        return { item: nextQ.items[0], replay: false, newQueueId: nextQ.id };
      } else if (settings.loopQueues && playableQueues.length > 0) {
        const firstQ = playableQueues[0];
        setQueues((prev) =>
          prev.map((q) => (q.id === firstQ.id ? { ...q, currentIndex: 0 } : q)),
        );
        setActiveQueueId(firstQ.id);
        return { item: firstQ.items[0], replay: false, newQueueId: firstQ.id };
      }
    } else if (settings.loopQueues && currentQ.items.length > 0) {
      const item = currentQ.items[0];
      setQueues((prev) =>
        prev.map((q) => (q.id === activeQueueId ? { ...q, currentIndex: 0 } : q)),
      );
      return { item, replay: false };
    }

    return null;
  }, [activeQueue, activeQueueId, queues, settings]);

  const advancePrevious = useCallback(
    (
      currentPositionSeconds = 0,
    ): { item: MusicQueueItem; replay: boolean; newQueueId?: string } | null => {
      const currentQ = activeQueue;
      if (currentQ.items.length === 0) return null;

      // Si ha transcurrido más de 3 segundos, reiniciar la pista actual
      if (currentPositionSeconds > 3) {
        const item = currentQ.items[currentQ.currentIndex];
        return item ? { item, replay: true } : null;
      }

      if (currentQ.currentIndex > 0) {
        const prevIndex = currentQ.currentIndex - 1;
        const item = currentQ.items[prevIndex];
        setQueues((prev) =>
          prev.map((q) => (q.id === activeQueueId ? { ...q, currentIndex: prevIndex } : q)),
        );
        return { item, replay: false };
      }

      if (settings.repeatMode === "all" && currentQ.items.length > 1) {
        const lastIndex = currentQ.items.length - 1;
        const item = currentQ.items[lastIndex];
        setQueues((prev) =>
          prev.map((q) => (q.id === activeQueueId ? { ...q, currentIndex: lastIndex } : q)),
        );
        return { item, replay: false };
      }

      if (settings.jumpToNextQueue) {
        const playableQueues = queues.filter((q) => q.items.length > 0);
        const currentQIdx = playableQueues.findIndex((q) => q.id === activeQueueId);
        if (currentQIdx > 0) {
          const prevQ = playableQueues[currentQIdx - 1];
          const lastIdx = prevQ.items.length - 1;
          setQueues((prev) =>
            prev.map((q) => (q.id === prevQ.id ? { ...q, currentIndex: lastIdx } : q)),
          );
          setActiveQueueId(prevQ.id);
          return { item: prevQ.items[lastIdx], replay: false, newQueueId: prevQ.id };
        } else if (settings.loopQueues && playableQueues.length > 0) {
          const lastQ = playableQueues[playableQueues.length - 1];
          const lastIdx = lastQ.items.length - 1;
          setQueues((prev) =>
            prev.map((q) => (q.id === lastQ.id ? { ...q, currentIndex: lastIdx } : q)),
          );
          setActiveQueueId(lastQ.id);
          return { item: lastQ.items[lastIdx], replay: false, newQueueId: lastQ.id };
        }
      } else if (settings.loopQueues && currentQ.items.length > 1) {
        const lastIndex = currentQ.items.length - 1;
        const item = currentQ.items[lastIndex];
        setQueues((prev) =>
          prev.map((q) => (q.id === activeQueueId ? { ...q, currentIndex: lastIndex } : q)),
        );
        return { item, replay: false };
      }

      // Rebobinar canción 0 al inicio
      const item = currentQ.items[0];
      return item ? { item, replay: true } : null;
    },
    [activeQueue, activeQueueId, queues, settings],
  );

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setQueues((prevQueues) => {
        return prevQueues.map((q) => {
          if (q.id === activeQueueId) {
            const res = moveItemKeepingCurrent(q.items, q.currentIndex, fromIndex, toIndex);
            return { ...q, items: res.items, currentIndex: res.currentIndex };
          }
          return q;
        });
      });
    },
    [activeQueueId],
  );

  const remove = useCallback(
    (index: number) => {
      setQueues((prevQueues) => {
        return prevQueues.map((q) => {
          if (q.id === activeQueueId) {
            const res = removeItemFromQueue(q.items, q.currentIndex, index);
            return { ...q, items: res.items, currentIndex: res.currentIndex };
          }
          return q;
        });
      });
    },
    [activeQueueId],
  );

  const clear = useCallback(() => {
    setQueues((prevQueues) => {
      return prevQueues.map((q) => {
        if (q.id === activeQueueId) {
          return { ...q, items: [], currentIndex: 0 };
        }
        return q;
      });
    });
  }, [activeQueueId]);

  const clearQueue = useCallback((queueId: string) => {
    setQueues((prevQueues) => {
      return prevQueues.map((q) => {
        if (q.id === queueId) {
          return { ...q, items: [], currentIndex: 0 };
        }
        return q;
      });
    });
  }, []);

  const clearAllQueues = useCallback(() => {
    setQueues([INITIAL_DEFAULT_QUEUE]);
    setActiveQueueId(DEFAULT_QUEUE_ID);
  }, []);

  const syncItemMetadata = useCallback((items: MusicQueueItem[]) => {
    const metadataByPath = new Map(
      items.map((item) => [item.path.trim().replace(/\\/g, "/").toLowerCase(), item]),
    );

    setQueues((previousQueues) => {
      let changed = false;
      const nextQueues = previousQueues.map((queue) => {
        let queueChanged = false;
        const nextItems = queue.items.map((item) => {
          const metadata = metadataByPath.get(item.path.trim().replace(/\\/g, "/").toLowerCase());
          if (!metadata || (metadata.title === item.title && metadata.artist === item.artist)) {
            return item;
          }
          queueChanged = true;
          changed = true;
          return { ...item, title: metadata.title, artist: metadata.artist };
        });
        return queueChanged ? { ...queue, items: nextItems } : queue;
      });
      return changed ? nextQueues : previousQueues;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setSettings((prev) => {
      const nextShuffle = !prev.shuffleMode;
      if (nextShuffle) {
        shuffleActiveQueue();
      }
      return { ...prev, shuffleMode: nextShuffle };
    });
  }, [shuffleActiveQueue]);

  const toggleRepeat = useCallback(() => {
    setSettings((prev) => {
      const nextRepeat: RepeatMode =
        prev.repeatMode === "off" ? "all" : prev.repeatMode === "all" ? "one" : "off";
      return { ...prev, repeatMode: nextRepeat };
    });
  }, []);

  const toggleJumpToNextQueue = useCallback(() => {
    setSettings((prev) => ({ ...prev, jumpToNextQueue: !prev.jumpToNextQueue }));
  }, []);

  const toggleLoopQueues = useCallback(() => {
    setSettings((prev) => ({ ...prev, loopQueues: !prev.loopQueues }));
  }, []);

  const setRepeatMode = useCallback((mode: RepeatMode) => {
    setSettings((prev) => ({ ...prev, repeatMode: mode }));
  }, []);

  const setShuffleMode = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, shuffleMode: enabled }));
  }, []);

  const setJumpToNextQueue = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, jumpToNextQueue: enabled }));
  }, []);

  const setLoopQueues = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, loopQueues: enabled }));
  }, []);

  const setPauseOnSongEnd = useCallback((enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      pauseOnSongEnd: enabled,
      stopOnSongEnd: enabled ? false : prev.stopOnSongEnd,
    }));
  }, []);

  const setStopOnSongEnd = useCallback((enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      stopOnSongEnd: enabled,
      pauseOnSongEnd: enabled ? false : prev.pauseOnSongEnd,
    }));
  }, []);

  const setSongEndMode = useCallback((mode: "stop" | "pause" | "next") => {
    setSettings((prev) => ({
      ...prev,
      stopOnSongEnd: mode === "stop",
      pauseOnSongEnd: mode === "pause",
    }));
  }, []);

  const playableQueues = useMemo(() => queues.filter((q) => q.items.length > 0), [queues]);
  const currentQIdx = playableQueues.findIndex((q) => q.id === activeQueueId);
  const hasNextQueue = currentQIdx >= 0 && currentQIdx < playableQueues.length - 1;
  const hasPrevQueue = currentQIdx > 0;

  const canGoNext =
    activeQueue.items.length > 0 &&
    (settings.repeatMode !== "off" ||
      activeQueue.currentIndex + 1 < activeQueue.items.length ||
      (settings.jumpToNextQueue && hasNextQueue) ||
      (settings.loopQueues && playableQueues.length > 0));

  const canGoPrevious =
    activeQueue.items.length > 0 &&
    (settings.repeatMode !== "off" ||
      activeQueue.currentIndex > 0 ||
      (settings.jumpToNextQueue && hasPrevQueue) ||
      (settings.loopQueues && playableQueues.length > 0));

  return {
    queues,
    activeQueueId,
    activeQueue,
    queue: activeQueue,
    currentItem,
    currentSongIndex,
    repeatMode: settings.repeatMode,
    shuffleMode: settings.shuffleMode,
    jumpToNextQueue: settings.jumpToNextQueue,
    loopQueues: settings.loopQueues,
    canGoNext,
    canGoPrevious,
    playQueue,
    playFolder,
    playQueueAt,
    playNext,
    addToQueue,
    switchQueue,
    addQueue,
    duplicateQueue,
    saveActiveQueueAs,
    removeQueue,
    renameQueue,
    shuffleActiveQueue,
    rewindActiveQueue,
    advanceNext,
    advancePrevious,
    reorder,
    moveQueue,
    remove,
    clear,
    clearQueue,
    clearAllQueues,
    syncItemMetadata,
    toggleShuffle,
    toggleRepeat,
    toggleJumpToNextQueue,
    toggleLoopQueues,
    setRepeatMode,
    setShuffleMode,
    setJumpToNextQueue,
    setLoopQueues,
    pauseOnSongEnd: settings.pauseOnSongEnd,
    stopOnSongEnd: settings.stopOnSongEnd,
    setPauseOnSongEnd,
    setStopOnSongEnd,
    setSongEndMode,
  };
}
