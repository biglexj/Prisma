import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

export type QuickLookShortcutMode = "space" | "alt_space" | "shift_space" | "disabled";
export type ProgressBarStyle =
  | "wavy"
  | "classic"
  | "prism"
  | "soundwave"
  | "fluid"
  | "helix"
  | "neon_pulse"
  | "particles"
  | "vinyl_tape"
  | "elastic_string";

interface SystemSettings {
  quickLookShortcut: QuickLookShortcutMode;
  autostart: boolean;
  minimizeToTray: boolean;
  confirmDeletion: boolean;
  progressBarStyle: ProgressBarStyle;
}

const STORAGE_KEY = "prisma.system-settings.v1";
const SETTINGS_CHANGE_EVENT = "prisma:settings-changed";
const TAURI_SYNC_EVENT = "prisma:settings-sync";

const DEFAULT_SETTINGS: SystemSettings = {
  quickLookShortcut: "space",
  autostart: false,
  minimizeToTray: true,
  confirmDeletion: true,
  progressBarStyle: "wavy",
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

function notifySettingsChanged(newSettings?: SystemSettings) {
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT));
  const payload = newSettings ?? loadStoredSettings();
  void emit(TAURI_SYNC_EVENT, payload).catch(() => {});
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(loadStoredSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Sincronizar estado con el backend de Rust al iniciar y escuchar eventos entre ventanas
  useEffect(() => {
    let isMounted = true;

    async function syncWithBackend() {
      try {
        const stored = loadStoredSettings();

        // Enviar valores guardados de atajo y bandeja al backend de Rust
        if (stored.quickLookShortcut) {
          await invoke("quick_look_set_shortcut", { shortcut: stored.quickLookShortcut }).catch(() => {});
        }
        if (typeof stored.minimizeToTray === "boolean") {
          await invoke("set_minimize_to_tray", { enabled: stored.minimizeToTray }).catch(() => {});
        }

        const autostart = await invoke<boolean>("autostart_get_status").catch(() => false);

        if (isMounted) {
          setSettings((prev) => {
            const synced: SystemSettings = {
              quickLookShortcut: stored.quickLookShortcut ?? prev.quickLookShortcut,
              autostart,
              minimizeToTray: stored.minimizeToTray ?? prev.minimizeToTray,
              confirmDeletion: stored.confirmDeletion ?? prev.confirmDeletion,
              progressBarStyle: stored.progressBarStyle ?? prev.progressBarStyle,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
            return synced;
          });
          setIsLoaded(true);
        }
      } catch {
        if (isMounted) setIsLoaded(true);
      }
    }

    syncWithBackend();

    const handleExternalChange = () => {
      if (isMounted) {
        setSettings(loadStoredSettings());
      }
    };

    window.addEventListener(SETTINGS_CHANGE_EVENT, handleExternalChange);
    window.addEventListener("storage", handleExternalChange);

    const unlistenTauriPromise = listen<SystemSettings>(TAURI_SYNC_EVENT, (event) => {
      if (isMounted && event.payload) {
        setSettings(event.payload);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(event.payload));
        } catch {}
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener(SETTINGS_CHANGE_EVENT, handleExternalChange);
      window.removeEventListener("storage", handleExternalChange);
      unlistenTauriPromise.then((unlisten) => unlisten());
    };
  }, []);

  const setQuickLookShortcut = useCallback(async (mode: QuickLookShortcutMode) => {
    try {
      await invoke("quick_look_set_shortcut", { shortcut: mode });
      setSettings((prev) => {
        const next = { ...prev, quickLookShortcut: mode };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        notifySettingsChanged(next);
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
        notifySettingsChanged(next);
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
        notifySettingsChanged(next);
        return next;
      });
    } catch (err) {
      console.error("Error al configurar minimizar a la bandeja:", err);
    }
  }, []);

  const setConfirmDeletion = useCallback((enabled: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, confirmDeletion: enabled };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  const setProgressBarStyle = useCallback((style: ProgressBarStyle) => {
    setSettings((prev) => {
      const next = { ...prev, progressBarStyle: style };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  return {
    isLoaded,
    quickLookShortcut: settings.quickLookShortcut,
    autostart: settings.autostart,
    minimizeToTray: settings.minimizeToTray,
    confirmDeletion: settings.confirmDeletion,
    progressBarStyle: settings.progressBarStyle,
    setQuickLookShortcut,
    setAutostart,
    setMinimizeToTray,
    setConfirmDeletion,
    setProgressBarStyle,
  };
}
