import { useEffect, useState } from "react";
import { musicLibraryClient } from "./tauri/client";

const MAX_CACHE_ITEMS = 96;
const artworkCache = new Map<string, string | null>();
const pendingArtwork = new Map<string, Promise<string | null>>();

export function useMusicArtwork(path: string | null, enabled = true) {
  const [artwork, setArtwork] = useState<string | null | undefined>(() =>
    path ? artworkCache.get(path) : null,
  );

  useEffect(() => {
    if (!path) {
      setArtwork(null);
      return;
    }
    const cached = artworkCache.get(path);
    if (cached !== undefined) {
      setArtwork(cached);
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
  if (artworkCache.has(path)) {
    return Promise.resolve(artworkCache.get(path) ?? null);
  }
  const existingRequest = pendingArtwork.get(path);
  if (existingRequest) return existingRequest;
  const request = musicLibraryClient
    .artwork(path)
    .catch(() => null)
    .then((dataUrl) => {
      artworkCache.delete(path);
      artworkCache.set(path, dataUrl);
      if (artworkCache.size > MAX_CACHE_ITEMS) {
        const oldestPath = artworkCache.keys().next().value;
        if (oldestPath) artworkCache.delete(oldestPath);
      }
      return dataUrl;
    })
    .finally(() => pendingArtwork.delete(path));
  pendingArtwork.set(path, request);
  return request;
}
