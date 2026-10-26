import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { liveWallpapersApi } from "../services/liveWallpapersApi";
import { normalizeComposition, type CompositionConfig } from "../compositor/config";

/** Escrituras serializadas: arrastrar un control no pierde el último valor. */
export function useCompositionConfig() {
  const [config, setConfig] = useState<CompositionConfig | null>(null);
  const [error, setError] = useState("");
  const latest = useRef<CompositionConfig | null>(null);
  const alive = useRef(false), dirty = useRef(false);
  const writing = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = useCallback((): Promise<boolean> => {
    if (writing.current) return writing.current;
    writing.current = (async () => {
      try {
        while (dirty.current && latest.current) {
          dirty.current = false;
          await liveWallpapersApi.setCompositorConfig(latest.current);
        }
        return true;
      } catch (reason) {
        if (alive.current) setError(String(reason));
        return false;
      }
    })().finally(() => { writing.current = null; });
    return writing.current;
  }, []);
  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    void liveWallpapersApi.getCompositorConfig().then(value => {
      if (cancelled) return;
      latest.current = normalizeComposition(value);
      setConfig(latest.current);
    }).catch(reason => { if (alive.current) setError(String(reason)); });
    let off: (() => void) | undefined;
    void listen<string>("prisma://compositor-error", event => { if (alive.current) setError(event.payload); })
      .then(unlisten => { if (!cancelled) off = unlisten; else unlisten(); })
      .catch(reason => { if (!cancelled) setError(String(reason)); });
    return () => {
      alive.current = false;
      cancelled = true;
      clearTimeout(timer.current);
      off?.();
      void flush();
    };
  }, [flush]);
  const update = useCallback((change: (current: CompositionConfig) => CompositionConfig) => {
    if (!latest.current) return;
    latest.current = normalizeComposition(change(latest.current));
    setConfig(latest.current);
    setError("");
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 180);
  }, [flush]);
  const select = useCallback(async (change: (current: CompositionConfig) => CompositionConfig, enabled: boolean) => {
    update(change);
    clearTimeout(timer.current);
    if (!await flush() || enabled) return;
    try { await liveWallpapersApi.setCompositorEnabled(true); }
    catch (reason) { if (alive.current) setError(String(reason)); }
  }, [update, flush]);
  return { config, error, update, select };
}
