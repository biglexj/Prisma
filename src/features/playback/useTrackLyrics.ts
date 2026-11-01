import { useCallback, useEffect, useState } from "react";
import { musicLibraryClient } from "../music_library/tauri/client";
import { parseLrc, type ParsedLyrics } from "./model/lrcParser";
import { useSystemSettings } from "../../app/useSystemSettings";
import { searchPublicLyrics, type PublicLyric } from "./services/publicLyricsClient";
import { matchingTrackLyric, publicLyricText } from "./services/trackLyricsMatch";

const lyricsCache = new Map<string, ParsedLyrics | null>();
const onlineCache = new Map<string, { items: PublicLyric[]; selected: string | null }>();
const ONLINE_SELECTION_EVENT = "prisma-track-lyrics-selected";

/**
 * Hook para cargar y parsear letras de la canción activa.
 * Busca automáticamente archivos compañero .lrc o tags incrustados mediante el backend.
 */
export function useTrackLyrics(path: string | null, title = "", artist = "") {
  const { auroraOnlineServicesEnabled, setAuroraOnlineServicesEnabled } = useSystemSettings();
  const [candidates, setCandidates] = useState<PublicLyric[]>([]);
  const [onlineMessage, setOnlineMessage] = useState("");
  const [hasLocalLyrics, setHasLocalLyrics] = useState(false);
  const cacheKey = JSON.stringify([path, title, artist]);
  const [lyrics, setLyrics] = useState<ParsedLyrics | null>(() => {
    if (!path) return null;
    return lyricsCache.get(path) ?? null;
  });
  const [loading, setLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const refetch = useCallback(() => {
    if (path) {
      lyricsCache.delete(path);
      onlineCache.delete(cacheKey);
      setRefreshCount((c) => c + 1);
    }
  }, [path, cacheKey]);

  const updateLyrics = useCallback((newRawLyrics: string) => {
    if (path && newRawLyrics.trim().length > 0) {
      const parsed = parseLrc(newRawLyrics);
      lyricsCache.set(path, parsed);
      setLyrics(parsed);
      setHasLocalLyrics(true);
    } else if (path) {
      lyricsCache.set(path, null);
      setLyrics(null);
    }
  }, [path]);

  const selectOnlineLyrics = useCallback((raw: string) => {
    if (!path || !auroraOnlineServicesEnabled) return;
    const previous = onlineCache.get(cacheKey);
    onlineCache.set(cacheKey, { items: previous?.items ?? [], selected: raw });
    setLyrics(parseLrc(raw));
    window.dispatchEvent(new CustomEvent(ONLINE_SELECTION_EVENT, { detail: { cacheKey, raw } }));
  }, [path, auroraOnlineServicesEnabled, cacheKey]);

  useEffect(() => {
    const handleSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ cacheKey: string; raw: string }>).detail;
      if (detail.cacheKey === cacheKey && auroraOnlineServicesEnabled && !hasLocalLyrics) setLyrics(parseLrc(detail.raw));
    };
    window.addEventListener(ONLINE_SELECTION_EVENT, handleSelection);
    return () => window.removeEventListener(ONLINE_SELECTION_EVENT, handleSelection);
  }, [cacheKey, auroraOnlineServicesEnabled, hasLocalLyrics]);

  useEffect(() => {
    if (!path) {
      setLyrics(null);
      setCandidates([]);
      setOnlineMessage("");
      setHasLocalLyrics(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLyrics(null);
    setCandidates([]);
    setOnlineMessage("");
    setHasLocalLyrics(false);
    setLoading(true);
    const load = async () => {
      try {
        let local = lyricsCache.get(path);
        if (!lyricsCache.has(path)) {
          // Una lectura local fallida tampoco debe bloquear la consulta pública.
          const raw = await musicLibraryClient.lyrics(path).catch(() => null);
          local = raw?.trim() ? parseLrc(raw) : null;
          lyricsCache.set(path, local);
        }
        if (cancelled) return;
        if (local?.lines.length) {
          setLyrics(local);
          setHasLocalLyrics(true);
          return;
        }
        if (!auroraOnlineServicesEnabled || !title.trim()) return;
        let remote = onlineCache.get(cacheKey);
        if (!remote) {
          const result = await searchPublicLyrics(title, artist, 0, controller.signal);
          if (cancelled) return;
          const match = matchingTrackLyric(result.items, title, artist);
          remote = { items: result.items, selected: match ? publicLyricText(match) : null };
          if (onlineCache.size >= 100) onlineCache.delete(onlineCache.keys().next().value!);
          onlineCache.set(cacheKey, remote);
        }
        setCandidates(remote.items);
        if (remote.selected) setLyrics(parseLrc(remote.selected));
        else if (!remote.items.length) setOnlineMessage("No hay coincidencias en Biglex J para estos metadatos.");
      } catch {
        if (!cancelled) {
          setOnlineMessage("No se pudieron consultar las letras. Puedes reintentar o buscarlas desde Editar letra.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [path, title, artist, cacheKey, refreshCount, auroraOnlineServicesEnabled]);

  return { lyrics, loading, refetch, updateLyrics, candidates, onlineMessage, hasLocalLyrics,
    onlineEnabled: auroraOnlineServicesEnabled, enableOnline: () => setAuroraOnlineServicesEnabled(true), selectOnlineLyrics };
}
