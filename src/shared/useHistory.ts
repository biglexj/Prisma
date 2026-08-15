import { useCallback, useEffect, useState } from "react";
import type { FavoriteMediaType } from "../features/collections/model/types";
import { detectMediaType } from "./useFavorites";

const HISTORY_STORAGE_KEY = "prisma_history_v1";
const MAX_HISTORY_PER_TYPE = 100;

export interface HistoryItem {
  path: string;
  playedAt: number;
  playCount?: number;
}

export type HistoryCategory = "music" | "video" | "image" | "playlist";

export interface HistoryStore {
  music: HistoryItem[];
  images: HistoryItem[];
  videos: HistoryItem[];
  playlists: HistoryItem[];
  lastPlayedKind?: HistoryCategory;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

let globalHistoryStore: HistoryStore = {
  music: [],
  images: [],
  videos: [],
  playlists: [],
  lastPlayedKind: "music",
};

const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function saveToLocalStorage(store: HistoryStore) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

function loadFromLocalStorage(): HistoryStore {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          music: Array.isArray(parsed.music) ? parsed.music : [],
          images: Array.isArray(parsed.images) ? parsed.images : [],
          videos: Array.isArray(parsed.videos) ? parsed.videos : [],
          playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
          lastPlayedKind: parsed.lastPlayedKind || "music",
        };
      }
    }
  } catch {}
  return { music: [], images: [], videos: [], playlists: [], lastPlayedKind: "music" };
}

globalHistoryStore = loadFromLocalStorage();

export function addToHistory(path: string, mediaType?: HistoryCategory) {
  if (!path) return;
  const actualType: HistoryCategory = mediaType || (detectMediaType(path) as HistoryCategory);
  const norm = normalizePath(path);
  const now = Date.now();

  const currentList = globalHistoryStore[
    actualType === "music"
      ? "music"
      : actualType === "image"
      ? "images"
      : actualType === "video"
      ? "videos"
      : "playlists"
  ] || [];
  const existing = currentList.find((item) => normalizePath(item.path) === norm);
  const playCount = (existing?.playCount || 0) + 1;

  const filtered = currentList.filter((item) => normalizePath(item.path) !== norm);
  const updated = [{ path, playedAt: now, playCount }, ...filtered].slice(0, MAX_HISTORY_PER_TYPE);

  if (actualType === "image") {
    globalHistoryStore = { ...globalHistoryStore, images: updated, lastPlayedKind: "image" };
  } else if (actualType === "video") {
    globalHistoryStore = { ...globalHistoryStore, videos: updated, lastPlayedKind: "video" };
  } else if (actualType === "playlist") {
    globalHistoryStore = { ...globalHistoryStore, playlists: updated, lastPlayedKind: "playlist" };
  } else {
    globalHistoryStore = { ...globalHistoryStore, music: updated, lastPlayedKind: "music" };
  }

  saveToLocalStorage(globalHistoryStore);
  notifyListeners();
}

export function clearHistory(type?: HistoryCategory) {
  if (!type) {
    globalHistoryStore = { music: [], images: [], videos: [], playlists: [], lastPlayedKind: "music" };
  } else if (type === "image") {
    globalHistoryStore = { ...globalHistoryStore, images: [] };
  } else if (type === "video") {
    globalHistoryStore = { ...globalHistoryStore, videos: [] };
  } else if (type === "playlist") {
    globalHistoryStore = { ...globalHistoryStore, playlists: [] };
  } else {
    globalHistoryStore = { ...globalHistoryStore, music: [] };
  }
  saveToLocalStorage(globalHistoryStore);
  notifyListeners();
}

export function useHistory() {
  const [store, setStore] = useState<HistoryStore>(globalHistoryStore);

  useEffect(() => {
    const handleChange = () => setStore(globalHistoryStore);
    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  const add = useCallback((path: string, mediaType?: HistoryCategory) => {
    addToHistory(path, mediaType);
  }, []);

  const clear = useCallback((type?: HistoryCategory) => {
    clearHistory(type);
  }, []);

  return {
    store,
    addToHistory: add,
    clearHistory: clear,
  };
}
