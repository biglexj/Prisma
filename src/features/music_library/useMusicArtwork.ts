import { useEffect, useRef, useState } from "react";
import { musicLibraryClient } from "./tauri/client";

const MAX_CACHE_ITEMS = 800;
const MAX_CACHE_BYTES = 32 * 1024 * 1024; // 32 MiB budget
const MAX_CONCURRENT_REQUESTS = 4;

interface CacheEntry {
  data: string | null;
  bytes: number;
}

const artworkCache = new Map<string, CacheEntry>();
const pendingArtwork = new Map<string, Promise<string | null>>();

export function isMusicArtworkCached(path: string | null): boolean {
  return path ? artworkCache.has(path) : false;
}
let totalEstimatedBytes = 0;

let activeWorkers = 0;
const requestQueue: Array<() => void> = [];

function pumpQueue() {
  while (activeWorkers < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
    const nextTask = requestQueue.shift();
    if (nextTask) {
      activeWorkers++;
      nextTask();
    }
  }
}

function estimateBytes(dataUrl: string | null): number {
  return dataUrl ? dataUrl.length * 2 : 64;
}

/**
 * Hook de carátula de música optimizado con cola de peticiones y caché LRU estricto.
 */
export function useMusicArtwork(path: string | null, enabled = true) {
  const [artwork, setArtwork] = useState<string | null>(() => {
    if (!path) return null;
    const entry = artworkCache.get(path);
    return entry ? entry.data : null;
  });

  const activePathRef = useRef<string | null>(path);

  useEffect(() => {
    activePathRef.current = path;

    if (!path) {
      setArtwork(null);
      return;
    }

    const cached = artworkCache.get(path);
    if (cached !== undefined) {
      // Hit inmediato en caché LRU (0ms delay)
      artworkCache.delete(path);
      artworkCache.set(path, cached);
      setArtwork(cached.data);
      return;
    }

    if (!enabled) return;

    let cancelled = false;

    requestArtwork(path).then((dataUrl) => {
      if (!cancelled && activePathRef.current === path) {
        setArtwork(dataUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, path]);

  return artwork;
}

/**
 * Precarga de carátulas para canciones adyacentes en la cola de reproducción.
 */
export function prefetchArtwork(path: string | null | undefined): void {
  if (!path || artworkCache.has(path) || pendingArtwork.has(path)) return;
  void requestArtwork(path);
}

function requestArtwork(path: string): Promise<string | null> {
  const cached = artworkCache.get(path);
  if (cached !== undefined) {
    artworkCache.delete(path);
    artworkCache.set(path, cached);
    return Promise.resolve(cached.data);
  }

  const existingRequest = pendingArtwork.get(path);
  if (existingRequest) return existingRequest;

  const request = new Promise<string | null>((resolve) => {
    const task = () => {
      musicLibraryClient
        .artwork(path)
        .catch(() => null)
        .then((dataUrl) => {
          const bytes = estimateBytes(dataUrl);
          const existing = artworkCache.get(path);
          if (existing) {
            totalEstimatedBytes -= existing.bytes;
            artworkCache.delete(path);
          }
          artworkCache.set(path, { data: dataUrl, bytes });
          totalEstimatedBytes += bytes;

          while (
            artworkCache.size > MAX_CACHE_ITEMS ||
            totalEstimatedBytes > MAX_CACHE_BYTES
          ) {
            const oldestKey = artworkCache.keys().next().value;
            if (!oldestKey) break;
            const entry = artworkCache.get(oldestKey);
            if (entry) totalEstimatedBytes -= entry.bytes;
            artworkCache.delete(oldestKey);
          }
          resolve(dataUrl);
        })
        .finally(() => {
          activeWorkers--;
          pendingArtwork.delete(path);
          pumpQueue();
        });
    };

    requestQueue.push(task);
    pumpQueue();
  });

  pendingArtwork.set(path, request);
  return request;
}
