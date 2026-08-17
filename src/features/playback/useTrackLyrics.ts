import { useCallback, useEffect, useState } from "react";
import { musicLibraryClient } from "../music_library/tauri/client";
import { parseLrc, type ParsedLyrics } from "./model/lrcParser";

const lyricsCache = new Map<string, ParsedLyrics | null>();

/**
 * Hook para cargar y parsear letras de la canción activa.
 * Busca automáticamente archivos compañero .lrc o tags incrustados mediante el backend.
 */
export function useTrackLyrics(path: string | null) {
  const [lyrics, setLyrics] = useState<ParsedLyrics | null>(() => {
    if (!path) return null;
    return lyricsCache.get(path) ?? null;
  });
  const [loading, setLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const refetch = useCallback(() => {
    if (path) {
      lyricsCache.delete(path);
      setRefreshCount((c) => c + 1);
    }
  }, [path]);

  const updateLyrics = useCallback((newRawLyrics: string) => {
    if (path && newRawLyrics.trim().length > 0) {
      const parsed = parseLrc(newRawLyrics);
      lyricsCache.set(path, parsed);
      setLyrics(parsed);
    } else if (path) {
      lyricsCache.set(path, null);
      setLyrics(null);
    }
  }, [path]);

  useEffect(() => {
    if (!path) {
      setLyrics(null);
      setLoading(false);
      return;
    }

    if (refreshCount === 0 && lyricsCache.has(path)) {
      setLyrics(lyricsCache.get(path) ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    musicLibraryClient
      .lyrics(path)
      .then((rawLrc) => {
        if (cancelled) return;
        if (rawLrc && rawLrc.trim().length > 0) {
          const parsed = parseLrc(rawLrc);
          lyricsCache.set(path, parsed);
          setLyrics(parsed);
        } else {
          lyricsCache.set(path, null);
          setLyrics(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          lyricsCache.set(path, null);
          setLyrics(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, refreshCount]);

  return { lyrics, loading, refetch, updateLyrics };
}
