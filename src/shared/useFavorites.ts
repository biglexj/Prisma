import { useCallback, useEffect, useState } from "react";

const FAVORITES_STORAGE_KEY = "prisma_favorites_v1";

let globalFavoritesSet: Set<string> = new Set();
const listeners = new Set<() => void>();

function loadInitialFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((item): item is string => typeof item === "string"));
      }
    }
  } catch {}
  return new Set();
}

globalFavoritesSet = loadInitialFavorites();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function saveFavoritesToStorage() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(globalFavoritesSet)));
  } catch {}
}

export function useFavorites() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const isFavorite = useCallback((path: string | null | undefined): boolean => {
    if (!path) return false;
    return globalFavoritesSet.has(path);
  }, []);

  const toggleFavorite = useCallback((path: string | null | undefined): boolean => {
    if (!path) return false;
    let nextState = false;
    if (globalFavoritesSet.has(path)) {
      globalFavoritesSet.delete(path);
      nextState = false;
    } else {
      globalFavoritesSet.add(path);
      nextState = true;
    }
    saveFavoritesToStorage();
    notifyListeners();
    return nextState;
  }, []);

  const addFavorite = useCallback((path: string) => {
    if (!path || globalFavoritesSet.has(path)) return;
    globalFavoritesSet.add(path);
    saveFavoritesToStorage();
    notifyListeners();
  }, []);

  const removeFavorite = useCallback((path: string) => {
    if (!path || !globalFavoritesSet.has(path)) return;
    globalFavoritesSet.delete(path);
    saveFavoritesToStorage();
    notifyListeners();
  }, []);

  return {
    favorites: globalFavoritesSet,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
  };
}
