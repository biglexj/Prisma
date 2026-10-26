import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { liveWallpapersApi } from "../services/liveWallpapersApi";
import { normalizeComposition, type CompositionConfig } from "../compositor/config";

/** Escrituras serializadas: arrastrar un control no pierde el último valor. */
export function useCompositionConfig() {
  const [config, setConfig] = useState<CompositionConfig | null>(null);
  const [error, setError] = useState("");
  const latest = useRef<CompositionConfig | null>(null);
  const alive = useRef(false), dirty = useRef(false), writing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = useCallback(async () => {
    if (writing.current || !dirty.current || !latest.current) return;
    writing.current = true;
    dirty.current = false;
    try { await liveWallpapersApi.setCompositorConfig(latest.current); }
    catch (reason) { if (alive.current) setError(String(reason)); }
    finally {
      writing.current = false;
      if (dirty.current) void flush();
    }
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
  return { config, error, update };
}
