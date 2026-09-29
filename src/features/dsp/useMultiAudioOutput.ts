import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { AudioEndpointInfo, MultiOutputConfig, MultiOutputDevice } from "./model/types";
import { dspClient } from "./tauri/client";
import { includePrimaryOutput, outputErrorMessage } from "./multiOutputState";

const STORAGE_KEY = "prisma_dsp_multi_output";

function savedConfig(): MultiOutputConfig {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (stored && typeof stored.enabled === "boolean" && Array.isArray(stored.devices)) {
      return {
        enabled: stored.enabled,
        devices: stored.devices.filter((item: MultiOutputDevice) =>
          typeof item?.id === "string" && typeof item?.gain === "number" && item.gain >= 0 && item.gain <= 1,
        ).map((item: MultiOutputDevice) => ({
          id: item.id,
          gain: item.gain,
          delayMs: Number.isFinite(item.delayMs) ? Math.max(0, Math.min(2_000, Math.round(item.delayMs / 10) * 10)) : 0,
        })),
      };
    }
  } catch { /* Preferir la configuración vacía ante datos locales corruptos. */ }
  return { enabled: false, devices: [] };
}

export function useMultiAudioOutput(endpoints: AudioEndpointInfo[], primary: string | null) {
  const [config, setConfig] = useState<MultiOutputConfig>(savedConfig);
  const configRef = useRef(config);
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const gainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((next: MultiOutputConfig) => {
    configRef.current = next;
    setConfig(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setError(null);
  }, []);

  useEffect(() => {
    let disposed = false;
    const restore = async () => {
      try {
        const stored = savedConfig();
        await dspClient.setMultiOutputDevices(stored.devices);
        const next = await dspClient.toggleMultiOutput(stored.enabled);
        if (!disposed) save(next);
      } catch (cause) {
        if (!disposed) {
          console.warn("No se pudieron restaurar las salidas múltiples:", cause);
          setError(outputErrorMessage(cause));
        }
      } finally {
        if (!disposed) { setReady(true); setBusy(false); }
      }
    };
    void restore();
    return () => { disposed = true; };
  }, [save]);

  useEffect(() => {
    let disposed = false;
    const toggleListener = listen<MultiOutputConfig>("prisma://multi-output-shortcut-toggled", (event) => {
      if (!disposed) save(event.payload);
    });
    const errorListener = listen<string>("prisma://multi-output-shortcut-error", (event) => {
      if (!disposed) setError(outputErrorMessage(event.payload));
    });
    void dspClient.getGlobalMultiOutputShortcutError().then((message) => {
      if (!disposed) setShortcutError(message ? "El atajo global no está disponible. Usa Ctrl + Mayús + O dentro de Prisma." : null);
    }).catch((cause) => {
      console.warn("No se pudo comprobar el atajo global:", cause);
      if (!disposed) setShortcutError("No se pudo comprobar el atajo global. El atajo de Prisma sigue disponible.");
    });
    return () => {
      disposed = true;
      void toggleListener.then((unlisten) => unlisten());
      void errorListener.then((unlisten) => unlisten());
    };
  }, [save]);

  const setDevices = useCallback(async (devices: MultiOutputDevice[]) => {
    if (gainTimer.current) clearTimeout(gainTimer.current);
    setBusy(true);
    try {
      if (configRef.current.enabled && devices.length < 2) await dspClient.toggleMultiOutput(false);
      const next = await dspClient.setMultiOutputDevices(devices);
      save(next);
    } catch (cause) { console.warn("No se pudieron actualizar las salidas:", cause); setError(outputErrorMessage(cause)); }
    finally { setBusy(false); }
  }, [save]);

  useEffect(() => {
    if (!ready || busy) return;
    const current = configRef.current;
    const next = includePrimaryOutput(current.devices, endpoints, primary);
    if (next !== current.devices) void setDevices(next);
  }, [ready, busy, endpoints, primary, setDevices]);

  const updateDevice = useCallback((id: string, values: Partial<MultiOutputDevice>) => {
    const current = configRef.current;
    const next = { ...current, devices: current.devices.map((device) =>
      device.id === id ? { ...device, ...values } : device,
    ) };
    save(next);
    if (gainTimer.current) clearTimeout(gainTimer.current);
    gainTimer.current = setTimeout(() => {
      void dspClient.setMultiOutputDevices(next.devices).catch((cause) => {
        console.warn("No se pudieron ajustar las salidas:", cause);
        setError(outputErrorMessage(cause));
      });
    }, 80);
  }, [save]);

  const setGain = useCallback((id: string, gain: number) => {
    updateDevice(id, { gain: Math.max(0, Math.min(1, gain)) });
  }, [updateDevice]);

  const setDelay = useCallback((id: string, delayMs: number) => {
    updateDevice(id, { delayMs: Math.max(0, Math.min(2_000, Math.round(delayMs / 10) * 10)) });
  }, [updateDevice]);

  useEffect(() => () => { if (gainTimer.current) clearTimeout(gainTimer.current); }, []);

  const toggle = useCallback(async () => {
    setBusy(true);
    try { save(await dspClient.toggleMultiOutput(!configRef.current.enabled)); return true; }
    catch (cause) { console.warn("No se pudo alternar la duplicación:", cause); setError(outputErrorMessage(cause)); return false; }
    finally { setBusy(false); }
  }, [save]);

  return { config, busy, error, shortcutError, setDevices, setGain, setDelay, toggle };
}
