import { useEffect, useState } from "react";
import { musicLibraryClient } from "./tauri/client";

const MAX_CACHE_ITEMS = 96;
const MAX_CACHE_BYTES = 24 * 1024 * 1024; // 24 MiB budget

interface CacheEntry {
  data: string | null;
  bytes: number;
}

const artworkCache = new Map<string, CacheEntry>();
const pendingArtwork = new Map<string, Promise<string | null>>();
let totalEstimatedBytes = 0;

function estimateBytes(dataUrl: string | null): number {
  return dataUrl ? dataUrl.length * 2 : 64;
}

export function useMusicArtwork(path: string | null, enabled = true) {
  const [artwork, setArtwork] = useState<string | null | undefined>(() => {
    if (!path) return null;
    const entry = artworkCache.get(path);
    return entry ? entry.data : null;
  });

  useEffect(() => {
    if (!path) {
      setArtwork(null);
      return;
    }
    const cached = artworkCache.get(path);
    if (cached !== undefined) {
      // LRU refresh
      artworkCache.delete(path);
      artworkCache.set(path, cached);
      setArtwork(cached.data);
      return;
    }
    setArtwork(undefined);
    if (!enabled) return;
    let cancelled = false;
    requestArtwork(path).then((dataUrl) => {
      if (!cancelled) setArtwork(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, path]);

  return artwork ?? null;
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
  const request = musicLibraryClient
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
      return dataUrl;
    })
    .finally(() => pendingArtwork.delete(path));
  pendingArtwork.set(path, request);
  return request;
}
