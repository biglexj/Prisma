import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface MobileAudioDevice { id: string; name: string; address: string; fingerprint: string }
export interface MobileAudioStatus {
  enabled: boolean; connection: "off" | "connecting" | "connected" | "reconnecting";
  device: MobileAudioDevice | null; volume: number; captureDeviceId: string | null;
  shortcut: string; defaultShortcut: string; shortcutError: string | null; error: string | null; sampleRate: number;
}
const INITIAL: MobileAudioStatus = { enabled: false, connection: "off", device: null, volume: 1,
  captureDeviceId: null, shortcut: "Ctrl+Shift+Alt+M", defaultShortcut: "Ctrl+Shift+Alt+M", shortcutError: null, error: null, sampleRate: 0 };

export function useMobileAudioOutput() {
  const desktopAvailable = isTauri();
  const [status, setStatus] = useState(INITIAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef(status);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    if (!desktopAvailable) return () => { mounted.current = false; };
    let disposed = false;
    const apply = (next: MobileAudioStatus) => { if (!disposed) { statusRef.current = next; setStatus(next); } };
    const unsubscribe = listen<MobileAudioStatus>("prisma://mobile-audio-status", event => apply(event.payload));
    const unsubscribeError = listen<string>("prisma://mobile-audio-error", event => { if (!disposed) setError(event.payload); });
    void invoke<MobileAudioStatus>("mobile_audio_status").then(apply).catch(() => {});
    return () => {
      disposed = true; mounted.current = false;
      void unsubscribe.then(stop => stop()).catch(() => {});
      void unsubscribeError.then(stop => stop()).catch(() => {});
    };
  }, [desktopAvailable]);

  const action = useCallback(async (command: string, args?: Record<string, unknown>) => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const next = await invoke<MobileAudioStatus>(command, args);
      if (mounted.current) { statusRef.current = next; setStatus(next); }
      return true;
    } catch (cause) {
      if (mounted.current) setError(typeof cause === "string" ? cause : "No se pudo cambiar la salida móvil");
      return false;
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }, []);
  const toggle = useCallback(() => action("mobile_audio_set_enabled", { enabled: !statusRef.current.enabled }), [action]);
  return {
    status, busy, error, desktopAvailable,
    toggle,
    configure: (volume: number, captureDeviceId: string | null) => action("mobile_audio_configure", { volume, captureDeviceId }),
    setShortcut: (shortcut: string) => action("mobile_audio_set_shortcut", { shortcut }),
    selectPhone: (address: string) => action("mobile_audio_select_phone", { address }),
  };
}
