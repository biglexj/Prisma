import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type QuickLookShortcutMode = "space" | "ctrl_space" | "alt_space" | "shift_space" | "disabled";

interface SystemSettings {
  quickLookShortcut: QuickLookShortcutMode;
  autostart: boolean;
  minimizeToTray: boolean;
}

const STORAGE_KEY = "prisma.system-settings.v1";

const DEFAULT_SETTINGS: SystemSettings = {
  quickLookShortcut: "space",
  autostart: false,
  minimizeToTray: true,
};

function loadStoredSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(loadStoredSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar estado real desde el backend de Rust al iniciar
  useEffect(() => {
    let isMounted = true;

    async function syncWithBackend() {
      try {
        const [shortcut, autostart, minimizeToTray] = await Promise.all([
          invoke<string>("quick_look_get_shortcut").catch(() => "space"),
          invoke<boolean>("autostart_get_status").catch(() => false),
          invoke<boolean>("get_minimize_to_tray").catch(() => true),
        ]);

        if (isMounted) {
          const synced: SystemSettings = {
            quickLookShortcut: (shortcut as QuickLookShortcutMode) || "space",
            autostart,
            minimizeToTray,
          };
          setSettings(synced);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
          setIsLoaded(true);
        }
      } catch {
        if (isMounted) setIsLoaded(true);
      }
    }

    syncWithBackend();

    return () => {
      isMounted = false;
    };
  }, []);

  const setQuickLookShortcut = useCallback(async (mode: QuickLookShortcutMode) => {
    try {
      await invoke("quick_look_set_shortcut", { shortcut: mode });
      setSettings((prev) => {
        const next = { ...prev, quickLookShortcut: mode };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error("Error al configurar atajo de Quick Look:", err);
    }
  }, []);

  const setAutostart = useCallback(async (enabled: boolean) => {
    try {
      await invoke("autostart_set", { enabled });
      setSettings((prev) => {
        const next = { ...prev, autostart: enabled };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error("Error al configurar inicio automático:", err);
    }
  }, []);

  const setMinimizeToTray = useCallback(async (enabled: boolean) => {
    try {
      await invoke("set_minimize_to_tray", { enabled });
      setSettings((prev) => {
        const next = { ...prev, minimizeToTray: enabled };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error("Error al configurar minimizar a la bandeja:", err);
    }
  }, []);

  return {
    isLoaded,
    quickLookShortcut: settings.quickLookShortcut,
    autostart: settings.autostart,
    minimizeToTray: settings.minimizeToTray,
    setQuickLookShortcut,
    setAutostart,
    setMinimizeToTray,
  };
}
