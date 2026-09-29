import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SystemMediaState } from "./flyoutMedia";

// Reading metadata must not show the flyout or extend its visibility timer.
export function useSystemMedia(enabled: boolean): SystemMediaState | null {
  const [media, setMedia] = useState<SystemMediaState | null>(null);
  useEffect(() => {
    if (!enabled) { setMedia(null); return; }
    let disposed = false;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const next = await invoke<SystemMediaState | null>("flyout_get_system_media");
        if (!disposed) setMedia(next);
      } catch {
        if (!disposed) setMedia(null);
      } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 1000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [enabled]);
  return enabled ? media : null;
}
