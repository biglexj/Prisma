import { useCallback, useEffect, useState } from "react";
import type { FavoriteMediaType, FavoritesStore } from "../features/collections/model/types";
import { favoritesGetAll, favoritesToggle } from "../features/collections/tauri/client";

const FAVORITES_STORAGE_KEY = "prisma_favorites_v2";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "m4v"]);

export function detectMediaType(path: string): FavoriteMediaType {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "music";
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

let globalFavoritesStore: FavoritesStore = {
  music: [],
  images: [],
  videos: [],
};

let globalFavoritesSet: Set<string> = new Set();
let isInitialLoaded = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function updateGlobalFromStore(data: FavoritesStore) {
  // Asegurar listas sanitizadas por extensión
  const sanitized: FavoritesStore = {
    music: [],
    images: [],
    videos: [],
  };

  const allEntries: Array<[string[], FavoriteMediaType]> = [
    [data.music || [], "music"],
    [data.images || [], "image"],
    [data.videos || [], "video"],
  ];

  const seenNorm = new Set<string>();

  for (const [list, originalType] of allEntries) {
    for (const path of list) {
      if (!path) continue;
      const norm = normalizePath(path);
      if (seenNorm.has(norm)) continue;
      seenNorm.add(norm);

      const detected = detectMediaType(path);
      const actualType = detected !== originalType ? detected : originalType;
      if (actualType === "image") {
        sanitized.images.push(path);
      } else if (actualType === "video") {
        sanitized.videos.push(path);
      } else {
        sanitized.music.push(path);
      }
    }
  }

  globalFavoritesStore = sanitized;
  globalFavoritesSet = new Set(
    [...sanitized.music, ...sanitized.images, ...sanitized.videos].map(normalizePath)
  );

  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {}
}

export async function refreshFavorites(): Promise<FavoritesStore> {
  try {
    const data = await favoritesGetAll();
    updateGlobalFromStore(data);
    isInitialLoaded = true;
    notifyListeners();
    return globalFavoritesStore;
  } catch (err) {
    console.warn("Error cargando favoritos desde backend Tauri:", err);
    // Fallback a localStorage
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          updateGlobalFromStore(parsed);
        }
      }
    } catch {}
    isInitialLoaded = true;
    notifyListeners();
    return globalFavoritesStore;
  }
}

// Carga inicial
void refreshFavorites();

export function useFavorites() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    if (!isInitialLoaded) {
      void refreshFavorites();
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Soporta ambas firmas: isFavorite(path, mediaType?) y isFavorite(mediaType, path)
  const isFavorite = useCallback(
    (arg1: string | null | undefined, arg2?: string): boolean => {
      if (!arg1) return false;
      if (arg1 === "music" || arg1 === "image" || arg1 === "video") {
        const mediaType = arg1 as FavoriteMediaType;
        const path = arg2;
        if (!path) return false;
        const norm = normalizePath(path);
        const list =
          mediaType === "music"
            ? globalFavoritesStore.music
            : mediaType === "image"
            ? globalFavoritesStore.images
            : globalFavoritesStore.videos;
        return list.some((p) => normalizePath(p) === norm);
      }

      const path = arg1;
      const mediaType = arg2 as FavoriteMediaType | undefined;
      if (mediaType) {
        const norm = normalizePath(path);
        const list =
          mediaType === "music"
            ? globalFavoritesStore.music
            : mediaType === "image"
            ? globalFavoritesStore.images
            : globalFavoritesStore.videos;
        return list.some((p) => normalizePath(p) === norm);
      }

      return globalFavoritesSet.has(normalizePath(path));
    },
    []
  );

  const toggleFavorite = useCallback(
    (path: string | null | undefined, mediaType?: FavoriteMediaType): boolean => {
      if (!path) return false;
      const norm = normalizePath(path);
      const actualType = mediaType || detectMediaType(path);
      const listKey = actualType === "music" ? "music" : actualType === "image" ? "images" : "videos";

      let nextState = false;
      if (globalFavoritesSet.has(norm)) {
        globalFavoritesSet.delete(norm);
        globalFavoritesStore[listKey] = globalFavoritesStore[listKey].filter(
          (p) => normalizePath(p) !== norm
        );
        nextState = false;
      } else {
        globalFavoritesSet.add(norm);
        if (!globalFavoritesStore[listKey].some((p) => normalizePath(p) === norm)) {
          globalFavoritesStore[listKey].push(path);
        }
        nextState = true;
      }

      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(globalFavoritesStore));
      } catch {}
      notifyListeners();

      // Persistir asíncronamente en backend Tauri
      void favoritesToggle(path, actualType).catch((err) => {
        console.warn("Error persistiendo favorito en backend:", err);
      });

      return nextState;
    },
    []
  );

  const toggle = useCallback(
    async (mediaType: FavoriteMediaType, path: string): Promise<boolean> => {
      return toggleFavorite(path, mediaType);
    },
    [toggleFavorite]
  );

  const addFavorite = useCallback(
    (path: string, mediaType?: FavoriteMediaType) => {
      if (!path) return;
      const norm = normalizePath(path);
      if (globalFavoritesSet.has(norm)) return;
      toggleFavorite(path, mediaType);
    },
    [toggleFavorite]
  );

  const removeFavorite = useCallback(
    (path: string, mediaType?: FavoriteMediaType) => {
      if (!path) return;
      const norm = normalizePath(path);
      if (!globalFavoritesSet.has(norm)) return;
      toggleFavorite(path, mediaType);
    },
    [toggleFavorite]
  );

  return {
    favorites: globalFavoritesSet,
    store: globalFavoritesStore,
    loading: !isInitialLoaded,
    refresh: refreshFavorites,
    isFavorite,
    toggleFavorite,
    toggle,
    addFavorite,
    removeFavorite,
    counts: {
      music: globalFavoritesStore.music.length,
      images: globalFavoritesStore.images.length,
      videos: globalFavoritesStore.videos.length,
      total:
        globalFavoritesStore.music.length +
        globalFavoritesStore.images.length +
        globalFavoritesStore.videos.length,
    },
  };
}
